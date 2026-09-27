"""Mandi prices: cache-only reads for the API, plus the sync that fills the
cache from Agmarknet via data.gov.in (nightly job + manual script)."""

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from app.integrations.agmarknet_client import (
    MAX_RECORDS_PER_SYNC,
    AgmarknetClient,
    AgmarknetNotConfiguredError,
)
from app.models.farm import Farm
from app.models.mandi_price import MandiPrice, MandiPriceSync
from app.repositories.mandi_price_repository import MandiPriceRepository

logger = logging.getLogger(__name__)

PRICE_SOURCE = "Agmarknet via data.gov.in"
# Prices count as live only if the last sync succeeded this recently -- a
# nightly job that silently stopped running must not keep claiming "live".
LIVE_MAX_AGE = timedelta(hours=36)

# FasalSetu's crop names (frontend FarmsPage CROPS) -> Agmarknet commodity
# names where they differ. Anything not listed is looked up as-is.
CROP_TO_COMMODITIES: dict[str, list[str]] = {
    "rice": ["Rice", "Paddy(Dhan)(Common)", "Paddy(Dhan)(Basmati)"],
    "soybean": ["Soyabean"],
    "chilli": ["Chili Red", "Green Chilli"],
    "cotton": ["Cotton", "Kapas"],
}


def commodities_for_crop(crop: str) -> list[str]:
    return CROP_TO_COMMODITIES.get(crop.strip().lower(), [crop.strip()])


@dataclass(frozen=True)
class PriceProvenance:
    source: str
    is_live: bool
    as_of: date | None  # newest arrival_date among the returned prices


@dataclass(frozen=True)
class PriceQuote:
    prices: list[MandiPrice]
    provenance: PriceProvenance


@dataclass(frozen=True)
class NearbyMandi:
    price: MandiPrice
    scope: Literal["district", "state"]


@dataclass(frozen=True)
class NearbyMandisQuote:
    commodities: list[str]
    mandis: list[NearbyMandi]
    provenance: PriceProvenance


class PriceService:
    def __init__(self, repository: MandiPriceRepository, client: AgmarknetClient | None = None) -> None:
        self.repository = repository
        self.client = client

    async def latest_prices(
        self, commodity: str, state: str | None = None, district: str | None = None
    ) -> PriceQuote:
        """Latest stored report per mandi for `commodity` (a crop name like
        "Rice" is mapped to Agmarknet's names). Never calls data.gov.in."""
        prices = await self.repository.latest_prices(
            commodities_for_crop(commodity), state=state, district=district
        )
        return PriceQuote(prices=prices, provenance=await self._provenance(prices))

    async def nearby_mandis(self, farm: Farm) -> NearbyMandisQuote:
        """Latest prices for the farm's crop: mandis in the farm's own
        district first, then the rest of its state. Empty when the farm has
        no state set."""
        commodities = commodities_for_crop(farm.crop)
        mandis: list[NearbyMandi] = []
        if farm.state:
            state_rows = await self.repository.latest_prices(commodities, state=farm.state)
            district = (farm.district or "").strip().lower()
            in_district = [r for r in state_rows if district and r.district.lower() == district]
            elsewhere = [r for r in state_rows if not (district and r.district.lower() == district)]
            mandis = [NearbyMandi(r, "district") for r in in_district] + [
                NearbyMandi(r, "state") for r in elsewhere
            ]
        return NearbyMandisQuote(
            commodities=commodities,
            mandis=mandis,
            provenance=await self._provenance([m.price for m in mandis]),
        )

    async def _provenance(self, prices: list[MandiPrice]) -> PriceProvenance:
        """is_live only when the most recent sync succeeded within
        LIVE_MAX_AGE. After a failed (or overdue) sync the API keeps serving
        the last stored day, flagged is_live=False."""
        last = await self.repository.latest_finished_sync()
        is_live = False
        if last is not None and last.succeeded and last.finished_at is not None:
            finished_at = last.finished_at
            if finished_at.tzinfo is None:  # SQLite drops tzinfo; the value is UTC
                finished_at = finished_at.replace(tzinfo=timezone.utc)
            is_live = datetime.now(timezone.utc) - finished_at <= LIVE_MAX_AGE
        as_of = max((p.arrival_date for p in prices), default=None)
        return PriceProvenance(source=PRICE_SOURCE, is_live=is_live, as_of=as_of)

    async def sync_prices(
        self,
        *,
        state: str | None = None,
        commodity: str | None = None,
        max_records: int = MAX_RECORDS_PER_SYNC,
    ) -> MandiPriceSync | None:
        """Pulls the current data.gov.in rows and upserts them, recording the
        run in mandi_price_syncs. Never raises for a data.gov.in or DB
        failure -- the failed run is recorded (so responses flip to
        is_live=False) and returned. Returns None, recording nothing, when no
        API key is configured."""
        assert self.client is not None, "client required for sync_prices"
        if not self.client.configured:
            logger.info("Mandi price sync skipped -- DATA_GOV_IN_API_KEY is not set.")
            return None

        sync = await self.repository.start_sync()
        sync_id = sync.id
        try:
            records = await self.client.fetch_all(state=state, commodity=commodity, max_records=max_records)
            count = await self.repository.upsert_many(records)
        except AgmarknetNotConfiguredError:
            raise  # checked above; unreachable unless the key vanished mid-run
        except Exception as exc:  # noqa: BLE001 -- any failure must be recorded, not lost
            logger.exception("Mandi price sync failed")
            await self.repository.session.rollback()
            sync = await self.repository.session.get(MandiPriceSync, sync_id)
            return await self.repository.finish_sync(sync, succeeded=False, error=f"{type(exc).__name__}: {exc}")

        logger.info("Mandi price sync finished: %d row(s) upserted.", count)
        return await self.repository.finish_sync(sync, succeeded=True, records_upserted=count)
