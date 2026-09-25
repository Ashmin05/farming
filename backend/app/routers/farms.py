import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.farm import Farm
from app.models.user import User
from app.repositories.farm_repository import FarmRepository
from app.schemas.farm import FarmCreateRequest, FarmResponse, FarmUpdateRequest
from app.services.farm_service import FarmError, FarmNotFoundError, FarmService

router = APIRouter(prefix="/farms", tags=["farms"])


def get_farm_service(session: AsyncSession = Depends(get_db)) -> FarmService:
    return FarmService(FarmRepository(session))


@router.get("", response_model=list[FarmResponse])
async def list_farms(
    current_user: User = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
) -> list[Farm]:
    return await farm_service.list_farms(current_user)


@router.post("", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
async def create_farm(
    payload: FarmCreateRequest,
    current_user: User = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
) -> Farm:
    try:
        return await farm_service.create_farm(
            current_user,
            name=payload.name,
            crop=payload.crop,
            variety=payload.variety,
            sowing_date=payload.sowing_date,
            irrigation_method=payload.irrigation_method,
            polygon_geojson=payload.polygon_geojson,
            state=payload.state,
            district=payload.district,
            address=payload.address,
        )
    except FarmError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{farm_id}", response_model=FarmResponse)
async def get_farm(
    farm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
) -> Farm:
    try:
        return await farm_service.get_farm(current_user, farm_id)
    except FarmNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found.") from exc


@router.patch("/{farm_id}", response_model=FarmResponse)
async def update_farm(
    farm_id: uuid.UUID,
    payload: FarmUpdateRequest,
    current_user: User = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
) -> Farm:
    try:
        return await farm_service.update_farm(
            current_user,
            farm_id,
            name=payload.name,
            crop=payload.crop,
            variety=payload.variety,
            sowing_date=payload.sowing_date,
            irrigation_method=payload.irrigation_method,
            polygon_geojson=payload.polygon_geojson,
            state=payload.state,
            district=payload.district,
            address=payload.address,
        )
    except FarmNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found.") from exc
    except FarmError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farm(
    farm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
) -> None:
    try:
        await farm_service.delete_farm(current_user, farm_id)
    except FarmNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found.") from exc
