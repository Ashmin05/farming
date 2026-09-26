"""Nightly job: for every farm, check for new clear Sentinel-2 passes and
update its NDVI/NDWI/EVI timeseries + alerts.

Started once at FastAPI startup (see app/main.py's lifespan) via
AsyncIOScheduler, which runs jobs directly on the existing asyncio event
loop -- no separate process or thread pool needed.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.database import AsyncSessionLocal
from app.integrations.earth_engine_client import earth_engine_client
from app.repositories.farm_alert_repository import FarmAlertRepository
from app.repositories.farm_repository import FarmRepository
from app.repositories.index_timeseries_repository import IndexTimeseriesRepository
from app.repositories.satellite_repository import SatelliteRepository
from app.services.satellite_service import SatelliteAnalysisError, SatelliteService

logger = logging.getLogger(__name__)

JOB_ID = "nightly_satellite_timeseries_refresh"

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

        farms = await farm_repository.list_all()
        logger.info("Nightly satellite timeseries job starting for %d farm(s).", len(farms))

        refreshed = 0
        for farm in farms:
            try:
                await satellite_service.build_timeseries(farm)
                refreshed += 1
            except SatelliteAnalysisError as exc:
                logger.info("Timeseries refresh skipped for farm %s: %s", farm.id, exc)
            except Exception:  # noqa: BLE001 -- one bad farm must not kill the batch
                logger.exception("Unexpected error refreshing timeseries for farm %s", farm.id)

        logger.info(
            "Nightly satellite timeseries job finished: %d/%d farm(s) refreshed.",
            refreshed,
            len(farms),
        )


def start_scheduler() -> None:
    """Call once at app startup. Safe to call more than once -- a job with
    the same id replaces the previous registration instead of duplicating."""
    scheduler.add_job(
        run_nightly_timeseries_refresh,
        trigger=CronTrigger(hour=2, minute=0),  # 02:00 server time -- a quiet, low-traffic window
        id=JOB_ID,
        replace_existing=True,
    )
    if not scheduler.running:
        scheduler.start()
        logger.info("Satellite timeseries scheduler started (nightly at 02:00).")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
