import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.mandi_price import MandiPrice
from app.models.user import User
from app.repositories.farm_repository import FarmRepository
from app.repositories.mandi_price_repository import MandiPriceRepository
from app.schemas.market import (
    FarmMarketResponse,
    MandiPriceResponse,
    MarketPricesResponse,
    NearbyMandiResponse,
    PriceProvenanceResponse,
)
from app.services.farm_service import FarmNotFoundError, FarmService
from app.services.price_service import PriceProvenance, PriceService

router = APIRouter(tags=["market"])


def get_price_service(session: AsyncSession = Depends(get_db)) -> PriceService:
    return PriceService(MandiPriceRepository(session))


def get_farm_service(session: AsyncSession = Depends(get_db)) -> FarmService:
    return FarmService(FarmRepository(session))


def _price(row: MandiPrice) -> dict:
    return {
        "state": row.state,
        "district": row.district,
        "market": row.market,
        "commodity": row.commodity,
        "variety": row.variety,
        "grade": row.grade,
        "arrival_date": row.arrival_date,
        "min_price": row.min_price,
        "max_price": row.max_price,
        "modal_price": row.modal_price,
    }


def _provenance(p: PriceProvenance) -> PriceProvenanceResponse:
    return PriceProvenanceResponse(source=p.source, is_live=p.is_live, as_of=p.as_of)


@router.get("/market/prices", response_model=MarketPricesResponse)
async def get_market_prices(
    commodity: str = Query(min_length=1, description='Agmarknet commodity or crop name, e.g. "Onion", "Rice"'),
    state: str | None = Query(default=None, description="e.g. Maharashtra"),
    district: str | None = Query(default=None, description="e.g. Nashik"),
    price_service: PriceService = Depends(get_price_service),
) -> MarketPricesResponse:
    """Latest stored mandi price per market (Rs/quintal) -- a cache read of
    what the nightly sync pulled from Agmarknet via data.gov.in, never a live
    call. Public: prices hold no user data. `provenance.is_live` is false
    when the last sync failed or is overdue; the prices are then the last
    stored day."""
    quote = await price_service.latest_prices(commodity, state=state, district=district)
    return MarketPricesResponse(
        commodity=commodity,
        state=state,
        district=district,
        prices=[MandiPriceResponse(**_price(row)) for row in quote.prices],
        provenance=_provenance(quote.provenance),
    )


@router.get("/farms/{farm_id}/market", response_model=FarmMarketResponse)
async def get_farm_market(
    farm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    farm_service: FarmService = Depends(get_farm_service),
    price_service: PriceService = Depends(get_price_service),
) -> FarmMarketResponse:
    """Latest prices for the farm's crop at mandis in its own district
    first, then the rest of its state. 404 (never 403) if not your farm."""
    try:
        farm = await farm_service.get_farm(current_user, farm_id)
    except FarmNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found.") from exc

    quote = await price_service.nearby_mandis(farm)
    return FarmMarketResponse(
        farm_id=farm.id,
        crop=farm.crop,
        commodities=quote.commodities,
        state=farm.state,
        district=farm.district,
        mandis=[NearbyMandiResponse(**_price(m.price), scope=m.scope) for m in quote.mandis],
        provenance=_provenance(quote.provenance),
    )
