"""Scheduled mandi price work (registered in app/jobs/scheduler.py; each also
runnable by hand from backend/scripts/)."""

from __future__ import annotations

import logging
from datetime import date

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.integrations.market_prices.agmarknet import AgmarknetProvider
from app.integrations.market_prices.registry import configured_providers
from app.models.market_price import PriceIngestionRun
from app.services.market_prices.ingestion import MarketPriceIngestionService
from app.services.market_prices.watchlist import current_queries, watchlist

logger = logging.getLogger(__name__)


async def _close(providers) -> None:
    for provider in providers:
        await provider.aclose()


async def run_market_catalog_sync(session_factory=None) -> PriceIngestionRun:
    """Weekly: refresh states/districts/markets/commodities/varieties/grades
    from Agmarknet 2.0's catalogue."""
    provider = AgmarknetProvider()
    try:
        async with (session_factory or AsyncSessionLocal)() as session:
            run = await MarketPriceIngestionService(session, [provider]).sync_catalog(provider)
    finally:
        await provider.aclose()
    if run.status != "succeeded":
        logger.warning("Market catalogue sync failed: %s", run.error)
    return run


async def run_current_price_ingestion(
    session_factory=None,
    *,
    providers=None,
    today: date | None = None,
) -> PriceIngestionRun:
    """Nightly: re-fetch the last MARKET_PRICE_CURRENT_DAYS days for every
    watched (state, commodity). Failures are recorded on the run, never
    raised -- the API keeps serving what's stored, marked stale."""
    today = today or date.today()
    owned = providers is None
    providers = providers if providers is not None else configured_providers()
    try:
        async with (session_factory or AsyncSessionLocal)() as session:
            pairs = await watchlist(session, include_farms=settings.MARKET_PRICE_INCLUDE_FARM_CROPS)
            queries = current_queries(pairs, today=today, days_back=settings.MARKET_PRICE_CURRENT_DAYS)
            service = MarketPriceIngestionService(session, providers, today=today)
            run = await service.ingest(
                queries, kind="current", params={"pairs": [list(p) for p in pairs], "days_back": settings.MARKET_PRICE_CURRENT_DAYS}
            )
    finally:
        if owned:
            await _close(providers)
    if run.status != "succeeded":
        logger.warning("Market price ingestion %s: %s", run.status, run.error)
    return run
