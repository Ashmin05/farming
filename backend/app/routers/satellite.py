import logging
import uuid
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.deps import get_current_user
from app.integrations.earth_engine_client import earth_engine_client
from app.models.index_timeseries import IndexTimeseriesPoint
from app.models.user import User
from app.repositories.farm_alert_repository import FarmAlertRepository
from app.repositories.farm_repository import FarmRepository
from app.repositories.index_timeseries_repository import IndexTimeseriesRepository
from app.repositories.satellite_layer_repository import SatelliteLayerRepository
from app.repositories.satellite_repository import SatelliteRepository
from app.repositories.stress_zone_repository import StressZoneRepository
from app.schemas.map_layers import SatelliteLayersResponse, StressZoneResponse, TileLayerUrls
from app.schemas.satellite import SatelliteObservationResponse, observation_to_response
from app.schemas.timeseries import TimeseriesPointResponse
from app.services.farm_service import FarmNotFoundError, FarmService
from app.services.satellite_service import SatelliteAnalysisError, SatelliteService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/farms", tags=["satellite"])


def get_farm_service(session: AsyncSession = Depends(get_db)) -> FarmService:
    return FarmService(FarmRepository(session))


def get_satellite_service(session: AsyncSession = Depends(get_db)) -> SatelliteService:
    return SatelliteService(
        SatelliteRepository(session),
        earth_engine_client,
        IndexTimeseriesRepository(session),
        FarmAlertRepository(session),
        SatelliteLayerRepository(session),
        StressZoneRepository(session),
    )


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


@router.get("/{farm_id}/satellite/timeseries", response_model=list[TimeseriesPointResponse])
async def get_satellite_timeseries(
    farm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
    satellite_service: SatelliteService = Depends(get_satellite_service),
) -> list[IndexTimeseriesPoint]:
    """Cache-only read of the farm's accumulated NDVI/NDWI/EVI history,
    oldest first -- never calls Earth Engine. Populated by the nightly
    scheduler job (app/jobs/scheduler.py), not by this request."""
    try:
        farm = await farm_service.get_farm(current_user, farm_id)
    except FarmNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found.") from exc

    return await satellite_service.get_timeseries(farm)


@router.get("/{farm_id}/satellite/layers", response_model=SatelliteLayersResponse)
async def get_satellite_layers(
    farm_id: uuid.UUID,
    date: date_type | None = Query(default=None, description="Defaults to the farm's latest analysis date"),
    current_user: User = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
    satellite_service: SatelliteService = Depends(get_satellite_service),
) -> SatelliteLayersResponse:
    """Visualised, farm-polygon-clipped Sentinel-2 tile URLs (true color,
    NDVI, NDWI, EVI, a stress classification) plus vectorized stress zones
    for one scene. Cached for MAP_LAYERS_CACHE_HOURS and regenerated on
    request after that -- this can be a real Earth Engine round trip, not
    just a cache read, unlike /latest and /timeseries."""
    try:
        farm = await farm_service.get_farm(current_user, farm_id)
    except FarmNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found.") from exc

    try:
        layer_set, zones = await satellite_service.get_or_build_layers(farm, date)
    except SatelliteAnalysisError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return SatelliteLayersResponse(
        farm_id=farm.id,
        image_date=layer_set.image_date,
        layers=TileLayerUrls(
            true_color=layer_set.true_color_tile_url,
            ndvi=layer_set.ndvi_tile_url,
            ndwi=layer_set.ndwi_tile_url,
            evi=layer_set.evi_tile_url,
            stress=layer_set.stress_tile_url,
        ),
        generated_at=layer_set.generated_at,
        expires_at=layer_set.expires_at,
        stress_zones=[
            StressZoneResponse(
                id=zone.id,
                zone_type=zone.zone_type,
                area_ha=zone.area_ha,
                geometry_geojson=zone.geometry_geojson,
                suggested_action=zone.suggested_action,
            )
            for zone in zones
        ],
    )


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
