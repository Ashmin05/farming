"""Google Earth Engine client — initialises once at app startup and exposes
a small async-safe wrapper around EE's blocking Python SDK.

EE's Python SDK is synchronous: every call that touches the network (most
importantly `.getInfo()`) blocks the calling thread. Every such call in this
module goes through `_get_info`, which runs it in a worker thread with a
timeout, so a slow or unreachable Earth Engine call can never freeze the
FastAPI event loop for every other request.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import ee

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 20.0

# Roughly central India — used only by the health check to count recent
# Sentinel-2 passes; the location itself has no other significance.
HEALTH_CHECK_LON = 78.9629
HEALTH_CHECK_LAT = 20.5937


class EarthEngineNotConfiguredError(Exception):
    """Raised when an EE call is attempted but no service-account credentials
    are configured. Callers should treat this as "feature unavailable", not
    a server error — see GEE_* in .env.example for what to set."""


class EarthEngineTimeoutError(Exception):
    """Raised when a call to Earth Engine doesn't finish within the timeout."""


class EarthEngineClient:
    """Thin, async-safe wrapper around the `earthengine-api` SDK.

    Construct once (see the `earth_engine_client` singleton below) and call
    `initialize()` once at app startup. If any of `project_id`,
    `service_account_email`, or `key_path` is missing, `configured` stays
    False and every method raises EarthEngineNotConfiguredError instead of
    touching the network — the app must still boot and serve every other
    route normally without an Earth Engine key.
    """

    def __init__(
        self,
        *,
        project_id: str | None,
        service_account_email: str | None,
        key_path: str | None,
    ) -> None:
        self.project_id = project_id
        self.service_account_email = service_account_email
        self.key_path = key_path
        self.configured = False
        self.init_error: str | None = None

    def initialize(self) -> None:
        """Call once at startup. Never raises — failures are recorded on
        `init_error` and surfaced via `configured`, since a missing or
        invalid Earth Engine key must not prevent the rest of the API from
        starting."""
        if not (self.service_account_email and self.key_path and self.project_id):
            self.configured = False
            self.init_error = (
                "GEE_SERVICE_ACCOUNT_EMAIL, GEE_KEY_PATH, or GEE_PROJECT_ID is not set."
            )
            logger.info("Earth Engine not configured — %s", self.init_error)
            return

        try:
            credentials = ee.ServiceAccountCredentials(self.service_account_email, self.key_path)
            ee.Initialize(credentials, project=self.project_id)
            self.configured = True
            self.init_error = None
            logger.info("Earth Engine initialised for project %s", self.project_id)
        except Exception as exc:  # noqa: BLE001 — any EE/auth failure must not crash startup
            self.configured = False
            self.init_error = str(exc)
            logger.warning("Earth Engine initialisation failed: %s", exc)

    async def _get_info(self, ee_object, *, timeout: float = DEFAULT_TIMEOUT_SECONDS):
        """Runs a blocking EE `.getInfo()` call in a worker thread with a
        timeout, so it never blocks the event loop."""
        try:
            return await asyncio.wait_for(asyncio.to_thread(ee_object.getInfo), timeout=timeout)
        except asyncio.TimeoutError as exc:
            raise EarthEngineTimeoutError(
                f"Earth Engine call did not complete within {timeout}s."
            ) from exc

    async def count_recent_sentinel2_images(
        self,
        lon: float = HEALTH_CHECK_LON,
        lat: float = HEALTH_CHECK_LAT,
        days: int = 30,
    ) -> int:
        """Counts Sentinel-2 L2A scenes covering (lon, lat) in the last
        `days` days — a trivial, cheap computation used to prove the EE
        connection actually works end-to-end (see GET /health/earth-engine).
        """
        if not self.configured:
            raise EarthEngineNotConfiguredError(
                self.init_error or "Earth Engine is not configured."
            )

        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days)

        point = ee.Geometry.Point([lon, lat])
        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(point)
            .filterDate(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
        )
        return await self._get_info(collection.size())


def _build_client() -> EarthEngineClient:
    # Imported lazily so importing this module never requires app.core.config
    # to already be fully set up (keeps this module easy to unit test too).
    from app.core.config import settings

    return EarthEngineClient(
        project_id=settings.GEE_PROJECT_ID,
        service_account_email=settings.GEE_SERVICE_ACCOUNT_EMAIL,
        key_path=settings.GEE_KEY_PATH,
    )


# Singleton reused across the app's lifetime — constructed here, initialised
# in main.py's lifespan handler via EarthEngineClient.initialize().
earth_engine_client = _build_client()
