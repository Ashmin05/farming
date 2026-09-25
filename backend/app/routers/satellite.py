import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.deps import get_current_user
from app.integrations.earth_engine_client import earth_engine_client
from app.models.user import User
from app.repositories.farm_repository import FarmRepository
from app.repositories.satellite_repository import SatelliteRepository
from app.schemas.satellite import SatelliteObservationResponse, observation_to_response
from app.services.farm_service import FarmNotFoundError, FarmService
from app.services.satellite_service import SatelliteAnalysisError, SatelliteService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/farms", tags=["satellite"])


def get_farm_service(session: AsyncSession = Depends(get_db)) -> FarmService:
    return FarmService(FarmRepository(session))


def get_satellite_service(session: AsyncSession = Depends(get_db)) -> SatelliteService:
    return SatelliteService(SatelliteRepository(session), earth_engine_client)


@router.post("/{farm_id}/satellite/refresh", response_model=SatelliteObservationResponse)
async def refresh_satellite_analysis(
    farm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
    satellite_service: SatelliteService = Depends(get_satellite_service),
) -> SatelliteObservationResponse:
    """Runs a live Sentinel-2 analysis for this farm right now and caches
    the result. Slower than /latest (a real Earth Engine round trip) --
    call this when the cached data is stale, not on every page load."""
    try:
        farm = await farm_service.get_farm(current_user, farm_id)
    except FarmNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found.") from exc

    try:
        observation = await satellite_service.refresh_analysis(farm)
    except SatelliteAnalysisError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return observation_to_response(observation)


@router.get("/{farm_id}/satellite/latest", response_model=SatelliteObservationResponse)
async def get_latest_satellite_analysis(
    farm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
    satellite_service: SatelliteService = Depends(get_satellite_service),
) -> SatelliteObservationResponse:
    """Reads the most recently cached analysis only -- never calls Earth
    Engine. Returns 404 if no analysis has run yet for this farm."""
    try:
        farm = await farm_service.get_farm(current_user, farm_id)
    except FarmNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found.") from exc

    observation = await satellite_service.get_latest(farm)
    if observation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No satellite analysis yet for this farm. POST .../satellite/refresh to run one.",
        )
    return observation_to_response(observation)


async def run_background_refresh(farm_id: uuid.UUID) -> None:
    """Runs a satellite refresh in its own DB session, decoupled from
    whatever request triggered it -- used right after a farm is created
    (see farms.py's create_farm, via BackgroundTasks). Never raises: a
    failed background refresh just means no cached observation yet, which
    GET /satellite/latest already reports as a clear 404."""
    async with AsyncSessionLocal() as session:
        farm = await FarmRepository(session).get_by_id(farm_id)
        if farm is None:
            return
        satellite_service = SatelliteService(SatelliteRepository(session), earth_engine_client)
        try:
            await satellite_service.refresh_analysis(farm)
        except SatelliteAnalysisError as exc:
            logger.info("Background satellite refresh skipped for farm %s: %s", farm_id, exc)
