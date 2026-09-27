"""Nightly jobs, run on the existing asyncio event loop via AsyncIOScheduler
-- no separate process or thread pool needed:

1. For every farm, check for new clear Sentinel-2 passes and update its
   NDVI/NDWI/EVI timeseries + alerts.
2. For every farm, refresh its environment report (rainfall/temperature/
   soil moisture; soil properties only on a farm's first-ever refresh).
3. Pull the day's mandi prices from Agmarknet via data.gov.in into
   mandi_prices (also runnable by hand: scripts/sync_mandi_prices.py).

Started once at FastAPI startup (see app/main.py's lifespan).
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.database import AsyncSessionLocal
from app.integrations.agmarknet_client import agmarknet_client
from app.integrations.earth_engine_client import earth_engine_client
from app.repositories.environment_snapshot_repository import EnvironmentSnapshotRepository
from app.repositories.farm_alert_repository import FarmAlertRepository
from app.repositories.farm_repository import FarmRepository
from app.repositories.index_timeseries_repository import IndexTimeseriesRepository
from app.repositories.mandi_price_repository import MandiPriceRepository
from app.repositories.satellite_repository import SatelliteRepository
from app.services.price_service import PriceService
from app.services.satellite_service import SatelliteAnalysisError, SatelliteService

logger = logging.getLogger(__name__)

TIMESERIES_JOB_ID = "nightly_satellite_timeseries_refresh"
ENVIRONMENT_JOB_ID = "nightly_environment_refresh"
MANDI_PRICES_JOB_ID = "nightly_mandi_price_sync"

scheduler = AsyncIOScheduler()


async def run_nightly_timeseries_refresh() -> None:
    """Rebuilds every farm's NDVI/NDWI/EVI timeseries and generates any new
    alerts. Skips quietly if Earth Engine isn't configured at all; skips a
    single farm (logging why) rather than aborting the whole batch if that
    farm's analysis fails -- one bad farm must never block the rest."""
    if not earth_engine_client.configured:
        logger.info("Nightly satellite timeseries job skipped -- Earth Engine not configured.")
        return

    async with AsyncSessionLocal() as session:
        farm_repository = FarmRepository(session)
        satellite_service = SatelliteService(
            SatelliteRepository(session),
            earth_engine_client,
            IndexTimeseriesRepository(session),
            FarmAlertRepository(session),
        )

        # Ids, not ORM objects: the per-farm rollback below expires every
        # loaded object, and an expired attribute can't lazy-load in async.
        farm_ids = [farm.id for farm in await farm_repository.list_all()]
        logger.info("Nightly satellite timeseries job starting for %d farm(s).", len(farm_ids))

        refreshed = 0
        for farm_id in farm_ids:
            try:
                farm = await farm_repository.get_by_id(farm_id)
                if farm is None:  # deleted since the job started
                    continue
                await satellite_service.build_timeseries(farm)
                refreshed += 1
            except SatelliteAnalysisError as exc:
                logger.info("Timeseries refresh skipped for farm %s: %s", farm_id, exc)
            except Exception:  # noqa: BLE001 -- one bad farm must not kill the batch
                logger.exception("Unexpected error refreshing timeseries for farm %s", farm_id)
                # A failed commit leaves the shared session unusable (every
                # later farm would raise PendingRollbackError) -- reset it.
                await session.rollback()

        logger.info(
            "Nightly satellite timeseries job finished: %d/%d farm(s) refreshed.",
            refreshed,
            len(farm_ids),
        )


async def run_nightly_environment_refresh() -> None:
    """Refreshes every farm's environment report (rainfall/temperature/soil
    moisture; soil pH/organic carbon/texture only on a farm's first-ever
    refresh -- see SatelliteService.refresh_environment). Same
    skip-quietly/skip-one-farm error handling as the timeseries job."""
    if not earth_engine_client.configured:
        logger.info("Nightly environment refresh job skipped -- Earth Engine not configured.")
        return

    async with AsyncSessionLocal() as session:
        farm_repository = FarmRepository(session)
        satellite_service = SatelliteService(
            SatelliteRepository(session),
            earth_engine_client,
            environment_snapshot_repository=EnvironmentSnapshotRepository(session),
        )

        # Ids, not ORM objects: the per-farm rollback below expires every
        # loaded object, and an expired attribute can't lazy-load in async.
        farm_ids = [farm.id for farm in await farm_repository.list_all()]
        logger.info("Nightly environment refresh job starting for %d farm(s).", len(farm_ids))

        refreshed = 0
        for farm_id in farm_ids:
            try:
                farm = await farm_repository.get_by_id(farm_id)
                if farm is None:  # deleted since the job started
                    continue
                await satellite_service.refresh_environment(farm)
                refreshed += 1
            except SatelliteAnalysisError as exc:
                logger.info("Environment refresh skipped for farm %s: %s", farm_id, exc)
            except Exception:  # noqa: BLE001 -- one bad farm must not kill the batch
                logger.exception("Unexpected error refreshing environment for farm %s", farm_id)
                await session.rollback()  # same reason as the timeseries job above

        logger.info(
            "Nightly environment refresh job finished: %d/%d farm(s) refreshed.",
            refreshed,
            len(farm_ids),
        )


async def run_nightly_mandi_price_sync() -> None:
    """Syncs the day's mandi prices. Skips quietly without an API key; a
    failed sync is recorded (responses then serve the last stored day with
    is_live=false) rather than raised -- see PriceService.sync_prices."""
    async with AsyncSessionLocal() as session:
        sync = await PriceService(MandiPriceRepository(session), agmarknet_client).sync_prices()
        if sync is not None and not sync.succeeded:
            logger.warning("Nightly mandi price sync failed: %s", sync.error)


def start_scheduler() -> None:
    """Call once at app startup. Safe to call more than once -- a job with
    the same id replaces the previous registration instead of duplicating."""
    scheduler.add_job(
        run_nightly_timeseries_refresh,
        trigger=CronTrigger(hour=2, minute=0),  # 02:00 server time -- a quiet, low-traffic window
        id=TIMESERIES_JOB_ID,
        replace_existing=True,
    )
    scheduler.add_job(
        run_nightly_environment_refresh,
        trigger=CronTrigger(hour=2, minute=30),  # staggered after the timeseries job, same reasoning
        id=ENVIRONMENT_JOB_ID,
        replace_existing=True,
    )
    scheduler.add_job(
        run_nightly_mandi_price_sync,
        # 23:00 server time -- after most mandis have reported the day's arrivals
        trigger=CronTrigger(hour=23, minute=0),
        id=MANDI_PRICES_JOB_ID,
        replace_existing=True,
    )
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started (timeseries 02:00, environment 02:30, mandi prices 23:00).")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
