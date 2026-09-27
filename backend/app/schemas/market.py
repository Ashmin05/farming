import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel


class PriceProvenanceResponse(BaseModel):
    source: str  # "Agmarknet via data.gov.in"
    is_live: bool  # false when the last sync failed or is overdue -- data is the last stored day
    as_of: date | None  # newest arrival_date among the prices returned


class MandiPriceResponse(BaseModel):
    state: str
    district: str
    market: str
    commodity: str
    variety: str
    grade: str | None
    arrival_date: date
    min_price: float  # Rs/quintal
    max_price: float  # Rs/quintal
    modal_price: float  # Rs/quintal


class MarketPricesResponse(BaseModel):
    commodity: str
    state: str | None
    district: str | None
    prices: list[MandiPriceResponse]
    provenance: PriceProvenanceResponse


class NearbyMandiResponse(MandiPriceResponse):
    scope: Literal["district", "state"]  # same district as the farm, or elsewhere in its state


class FarmMarketResponse(BaseModel):
    farm_id: uuid.UUID
    crop: str
    commodities: list[str]  # Agmarknet names searched for the farm's crop
    state: str | None
    district: str | None
    mandis: list[NearbyMandiResponse]  # same district first, then the rest of the state
    provenance: PriceProvenanceResponse
