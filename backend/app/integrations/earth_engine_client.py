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
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

import ee
from google.auth import default as google_auth_default

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 20.0
FIELD_ANALYSIS_TIMEOUT_SECONDS = 60.0  # reduceRegion over a whole collection is slower than a count
TIMESERIES_TIMEOUT_SECONDS = 120.0  # up to ~120 days of scenes, two reduceRegions each

# Per-field Sentinel-2 analysis (see EarthEngineClient.analyze_field).
FIELD_ANALYSIS_WINDOW_DAYS = 45
ACCEPTABLE_CLOUD_PCT = 20.0
REFLECTANCE_SCALE = 0.0001  # Sentinel-2 SR bands are Int16, scaled by 1e-4 to reflectance
REGION_REDUCE_SCALE_M = 10  # native resolution of the visible/NIR S2 bands
NDVI_HEALTHY_THRESHOLD = 0.6
NDVI_STRESSED_THRESHOLD = 0.3
# SCL (Scene Classification Layer) classes to mask out: cloud shadow (3),
# cloud medium probability (8), cloud high probability (9), thin cirrus (10).
SCL_CLOUD_SHADOW_CLASSES = [3, 8, 9, 10]

# Roughly central India — used only by the health check to count recent
# Sentinel-2 passes; the location itself has no other significance.
HEALTH_CHECK_LON = 78.9629
HEALTH_CHECK_LAT = 20.5937

# Scopes Earth Engine needs from Application Default Credentials. Only used
# on the ADC path (see _initialize_with_application_default_credentials) --
# the service-account path gets its scope from the key file itself.
ADC_SCOPES = [
    "https://www.googleapis.com/auth/earthengine",
    "https://www.googleapis.com/auth/cloud-platform",
]

ADC_LOGIN_HINT = f"gcloud auth application-default login --scopes={','.join(ADC_SCOPES)}"


class EarthEngineNotConfiguredError(Exception):
    """Raised when an EE call is attempted but no usable Earth Engine
    credentials are configured (neither a service account nor Application
    Default Credentials). Callers should treat this as "feature
    unavailable", not a server error — see GEE_* in .env.example for what
    to set."""


class EarthEngineTimeoutError(Exception):
    """Raised when a call to Earth Engine doesn't finish within the timeout."""


class NoSentinelImageryAvailableError(Exception):
    """Raised when no Sentinel-2 scene at all covers the field in the
    analysis window (regardless of cloud cover) -- distinct from a timeout
    or a missing credential."""


@dataclass
class IndexStats:
    mean: float
    min: float
    max: float


@dataclass
class FieldAnalysisResult:
    """Result of EarthEngineClient.analyze_field -- a real Sentinel-2
    vegetation/moisture analysis over one farm's polygon."""

    image_date: date
    satellite: str  # "S2A" / "S2B"
    cloud_pct: float  # cloud+shadow fraction over the FIELD itself, not the whole scene
    is_fallback: bool  # True if no scene in the window was under ACCEPTABLE_CLOUD_PCT
    ndvi: IndexStats
    ndwi: IndexStats
    evi: IndexStats
    ndmi: IndexStats
    healthy_pct: float  # % of field pixels with NDVI > NDVI_HEALTHY_THRESHOLD
    moderate_pct: float  # % with NDVI_STRESSED_THRESHOLD <= NDVI <= NDVI_HEALTHY_THRESHOLD
    stressed_pct: float  # % with NDVI < NDVI_STRESSED_THRESHOLD


@dataclass
class TimeseriesPoint:
    """One scene's field-mean indices, from EarthEngineClient.build_field_timeseries.
    Unlike FieldAnalysisResult this carries no selection/classification --
    just raw per-scene numbers, for SatelliteService to filter and store."""

    image_date: date
    satellite: str
    cloud_pct: float
    ndvi_mean: float
    ndwi_mean: float
    evi_mean: float


def _short_satellite_name(spacecraft_name: str | None) -> str:
    if not spacecraft_name:
        return "S2"
    if "2A" in spacecraft_name:
        return "S2A"
    if "2B" in spacecraft_name:
        return "S2B"
    return spacecraft_name


class EarthEngineClient:
    """Thin, async-safe wrapper around the `earthengine-api` SDK.

    Construct once (see the `earth_engine_client` singleton below) and call
    `initialize()` once at app startup. Two auth paths, tried in this order:

    1. **Service account** (production) — used when `service_account_email`
       and `key_path` are both set. Needs a downloaded JSON key, which some
       GCP organizations block via the `iam.disableServiceAccountKeyCreation`
       policy — see path 2 when that applies.
    2. **Application Default Credentials** (local development) — used
       whenever a service-account key isn't configured, as long as
       `project_id` is set. Uses whatever's logged in locally via
       `gcloud auth application-default login` — no key file, so it works
       even when service-account key creation is blocked by org policy.

    If neither path is usable, `configured` stays False and every method
    raises EarthEngineNotConfiguredError instead of touching the network —
    the app must still boot and serve every other route normally without a
    working Earth Engine connection.
    """

    def __init__(
        self,
        *,
        project_id: str | None,
        service_account_email: str | None = None,
        key_path: str | None = None,
    ) -> None:
        self.project_id = project_id
        self.service_account_email = service_account_email
        self.key_path = key_path
        self.configured = False
        self.auth_mode: str | None = None  # "service_account" | "application_default" | None
        self.init_error: str | None = None

    def initialize(self) -> None:
        """Call once at startup. Never raises — failures are recorded on
        `init_error` and surfaced via `configured`, since a missing or
        invalid Earth Engine credential must not prevent the rest of the
        API from starting."""
        if not self.project_id:
            self.configured = False
            self.auth_mode = None
            self.init_error = "GEE_PROJECT_ID is not set."
            logger.info("Earth Engine not configured — %s", self.init_error)
            return

        if self.service_account_email and self.key_path:
            self._initialize_with_service_account()
        else:
            self._initialize_with_application_default_credentials()

    def _initialize_with_service_account(self) -> None:
        try:
            credentials = ee.ServiceAccountCredentials(self.service_account_email, self.key_path)
            ee.Initialize(credentials, project=self.project_id)
            self.configured = True
            self.auth_mode = "service_account"
            self.init_error = None
            logger.info("Earth Engine initialised (service account) for project %s", self.project_id)
        except Exception as exc:  # noqa: BLE001 — any EE/auth failure must not crash startup
            self.configured = False
            self.auth_mode = None
            self.init_error = str(exc)
            logger.warning("Earth Engine service-account initialisation failed: %s", exc)

    def _initialize_with_application_default_credentials(self) -> None:
        try:
            credentials, _ = google_auth_default(scopes=ADC_SCOPES)
            ee.Initialize(credentials, project=self.project_id)
            self.configured = True
            self.auth_mode = "application_default"
            self.init_error = None
            logger.info(
                "Earth Engine initialised (application default credentials) for project %s",
                self.project_id,
            )
        except Exception as exc:  # noqa: BLE001 — any EE/auth failure must not crash startup
            self.configured = False
            self.auth_mode = None
            self.init_error = (
                f"No usable Earth Engine credentials found. Run: {ADC_LOGIN_HINT} "
                f"(original error: {exc})"
            )
            logger.warning("Earth Engine ADC initialisation failed: %s", exc)

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

    async def analyze_field(
        self,
        polygon_geojson: dict,
        *,
        days: int = FIELD_ANALYSIS_WINDOW_DAYS,
    ) -> FieldAnalysisResult:
        """Runs a real Sentinel-2 NDVI/NDWI/EVI/NDMI analysis over a farm's
        polygon.

        Picks the most recent scene in the last `days` days with under
        ACCEPTABLE_CLOUD_PCT cloud+shadow cover *over the field itself* (not
        the whole scene) -- falling back to the single least-cloudy scene in
        the window (flagged via `is_fallback=True`) if none qualify. Raises
        NoSentinelImageryAvailableError if the window has no Sentinel-2
        coverage of the field at all.

        Cloud/shadow masking uses the scene's SCL (Scene Classification
        Layer) band rather than a COPERNICUS/S2_CLOUD_PROBABILITY join --
        SCL ships on S2_SR_HARMONIZED itself, so this needs only one
        collection and one image per candidate scene.
        """
        if not self.configured:
            raise EarthEngineNotConfiguredError(self.init_error or "Earth Engine is not configured.")

        geometry = ee.Geometry(polygon_geojson)
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days)

        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(geometry)
            .filterDate(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
        )

        def _tag_field_cloud_pct(image):
            scl = image.select("SCL")
            is_cloudy = scl.remap(SCL_CLOUD_SHADOW_CLASSES, [1] * len(SCL_CLOUD_SHADOW_CLASSES), 0)
            raw_cloud_fraction = (
                is_cloudy.rename("cloud")
                .reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=geometry,
                    scale=REGION_REDUCE_SCALE_M,
                    bestEffort=True,
                )
                .get("cloud")
            )
            # reduceRegion always includes the "cloud" key in its output, but
            # its VALUE is null whenever this particular scene has zero
            # pixels actually intersecting the field at the pixel-grid level
            # (its bounding footprint can still pass filterBounds while the
            # field falls in a gap between swaths, or right at a tile edge).
            # Unlike a genuinely missing key, dict.get(key, default) does
            # NOT rescue a present-but-null value -- and neither does
            # .unmask() on the source band, since there's no pixel grid
            # there at all to unmask. ee.List(...).reduce(firstNonNull()) is
            # EE's standard null-coalescing idiom for exactly this. Treating
            # "no data" as maximally cloudy (1.0) also correctly excludes
            # such a scene from selection unless it's the only candidate.
            cloud_fraction = ee.List([raw_cloud_fraction, 1]).reduce(ee.Reducer.firstNonNull())
            return image.set("FIELD_CLOUD_PCT", ee.Number(cloud_fraction).multiply(100))

        # select([]) drops pixel bands (properties are untouched) so this
        # getInfo() call only pulls image metadata, not pixel data.
        tagged = collection.map(_tag_field_cloud_pct)
        candidates = await self._get_info(
            tagged.select([]), timeout=FIELD_ANALYSIS_TIMEOUT_SECONDS
        )
        features = (candidates or {}).get("features", [])
        if not features:
            raise NoSentinelImageryAvailableError(
                f"No Sentinel-2 imagery found for this field in the last {days} days."
            )

        selected = self._select_best_image(features)
        image = ee.Image(selected["id"])

        scl = image.select("SCL")
        keep_mask = scl.remap(SCL_CLOUD_SHADOW_CLASSES, [0] * len(SCL_CLOUD_SHADOW_CLASSES), 1)
        masked = image.updateMask(keep_mask)
        scaled = masked.select(["B2", "B3", "B4", "B8", "B11"]).multiply(REFLECTANCE_SCALE)

        ndvi = scaled.normalizedDifference(["B8", "B4"]).rename("NDVI")
        ndwi = scaled.normalizedDifference(["B3", "B8"]).rename("NDWI")
        ndmi = scaled.normalizedDifference(["B8", "B11"]).rename("NDMI")
        evi = scaled.expression(
            "2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))",
            {"NIR": scaled.select("B8"), "RED": scaled.select("B4"), "BLUE": scaled.select("B2")},
        ).rename("EVI")
        indices = ndvi.addBands([ndwi, evi, ndmi])

        stats_reducer = (
            ee.Reducer.mean()
            .combine(ee.Reducer.min(), sharedInputs=True)
            .combine(ee.Reducer.max(), sharedInputs=True)
        )
        stats = indices.reduceRegion(
            reducer=stats_reducer, geometry=geometry, scale=REGION_REDUCE_SCALE_M, bestEffort=True
        )

        classified = (
            ndvi.gt(NDVI_HEALTHY_THRESHOLD)
            .rename("healthy")
            .addBands(
                ndvi.gte(NDVI_STRESSED_THRESHOLD).And(ndvi.lte(NDVI_HEALTHY_THRESHOLD)).rename("moderate")
            )
            .addBands(ndvi.lt(NDVI_STRESSED_THRESHOLD).rename("stressed"))
        )
        classification = classified.reduceRegion(
            reducer=ee.Reducer.mean(), geometry=geometry, scale=REGION_REDUCE_SCALE_M, bestEffort=True
        )

        combined = (
            stats.combine(classification)
            .set("image_date", image.date().format("YYYY-MM-dd"))
            .set("satellite", image.get("SPACECRAFT_NAME"))
        )
        result = await self._get_info(combined, timeout=FIELD_ANALYSIS_TIMEOUT_SECONDS)

        # reduceRegion can legitimately return a key with a JSON `null` value
        # (not an absent key) if the *selected* scene still has zero valid
        # (unmasked) pixels for that particular band over the field -- e.g. a
        # fallback scene with heavy but not total cloud cover concentrated
        # over one band's swath. `dict.get(key, 0.0)` alone does NOT rescue a
        # present-but-None value (only a missing key), so this explicitly
        # treats both as "nothing detected" (0.0) rather than crashing.
        def _stat(key: str) -> float:
            value = result.get(key)
            return 0.0 if value is None else value

        return FieldAnalysisResult(
            image_date=datetime.strptime(result["image_date"], "%Y-%m-%d").date(),
            satellite=_short_satellite_name(result.get("satellite")),
            cloud_pct=round(selected["cloud_pct"], 1),
            is_fallback=selected["is_fallback"],
            ndvi=IndexStats(mean=_stat("NDVI_mean"), min=_stat("NDVI_min"), max=_stat("NDVI_max")),
            ndwi=IndexStats(mean=_stat("NDWI_mean"), min=_stat("NDWI_min"), max=_stat("NDWI_max")),
            evi=IndexStats(mean=_stat("EVI_mean"), min=_stat("EVI_min"), max=_stat("EVI_max")),
            ndmi=IndexStats(mean=_stat("NDMI_mean"), min=_stat("NDMI_min"), max=_stat("NDMI_max")),
            healthy_pct=round(_stat("healthy") * 100, 1),
            moderate_pct=round(_stat("moderate") * 100, 1),
            stressed_pct=round(_stat("stressed") * 100, 1),
        )

    @staticmethod
    def _select_best_image(features: list[dict]) -> dict:
        """Picks the most recent scene under ACCEPTABLE_CLOUD_PCT field
        cloud cover, or the single least-cloudy scene in the window if none
        qualify (flagged as a fallback). Pure Python, no EE calls -- makes
        the selection logic trivially unit-testable."""
        parsed = [
            {
                "id": feature["id"],
                "time_start": feature["properties"]["system:time_start"],
                "cloud_pct": feature["properties"]["FIELD_CLOUD_PCT"],
            }
            for feature in features
        ]
        under_threshold = [p for p in parsed if p["cloud_pct"] < ACCEPTABLE_CLOUD_PCT]
        if under_threshold:
            best = max(under_threshold, key=lambda p: p["time_start"])
            return {**best, "is_fallback": False}
        best = min(parsed, key=lambda p: p["cloud_pct"])
        return {**best, "is_fallback": True}

    async def build_field_timeseries(
        self, polygon_geojson: dict, *, start: date, end: date
    ) -> list[TimeseriesPoint]:
        """Returns one TimeseriesPoint per Sentinel-2 scene covering the
        field between `start` and `end` (inclusive), regardless of cloud
        cover -- callers (SatelliteService) filter by cloud_pct themselves.

        Computes NDVI/NDWI/EVI and field cloud % for *every* candidate scene
        in a single `.map()` over the collection, then a single `getInfo()`
        call -- never one Earth Engine round trip per scene. This is the
        same principle as analyze_field's scene-selection step, just
        computing full stats for every scene instead of picking just one.
        """
        if not self.configured:
            raise EarthEngineNotConfiguredError(self.init_error or "Earth Engine is not configured.")

        geometry = ee.Geometry(polygon_geojson)
        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(geometry)
            .filterDate(start.strftime("%Y-%m-%d"), (end + timedelta(days=1)).strftime("%Y-%m-%d"))
        )

        def _tag_indices_and_cloud(image):
            scl = image.select("SCL")
            keep_mask = scl.remap(SCL_CLOUD_SHADOW_CLASSES, [0] * len(SCL_CLOUD_SHADOW_CLASSES), 1)
            is_cloudy = scl.remap(SCL_CLOUD_SHADOW_CLASSES, [1] * len(SCL_CLOUD_SHADOW_CLASSES), 0)

            masked = image.updateMask(keep_mask)
            scaled = masked.select(["B2", "B3", "B4", "B8"]).multiply(REFLECTANCE_SCALE)
            ndvi = scaled.normalizedDifference(["B8", "B4"]).rename("NDVI")
            ndwi = scaled.normalizedDifference(["B3", "B8"]).rename("NDWI")
            evi = scaled.expression(
                "2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))",
                {"NIR": scaled.select("B8"), "RED": scaled.select("B4"), "BLUE": scaled.select("B2")},
            ).rename("EVI")
            index_stats = ndvi.addBands([ndwi, evi]).reduceRegion(
                reducer=ee.Reducer.mean(), geometry=geometry, scale=REGION_REDUCE_SCALE_M, bestEffort=True
            )

            raw_cloud_fraction = (
                is_cloudy.rename("cloud")
                .reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=geometry,
                    scale=REGION_REDUCE_SCALE_M,
                    bestEffort=True,
                )
                .get("cloud")
            )
            # See analyze_field's _tag_field_cloud_pct for why this null-coalesce
            # is needed: reduceRegion always includes the key, just with a null
            # value, when the field has zero valid pixels for this scene.
            cloud_fraction = ee.List([raw_cloud_fraction, 1]).reduce(ee.Reducer.firstNonNull())

            return (
                image.set(index_stats)
                .set("TS_CLOUD_PCT", ee.Number(cloud_fraction).multiply(100))
                .set("TS_IMAGE_DATE", image.date().format("YYYY-MM-dd"))
                .set("TS_SATELLITE", image.get("SPACECRAFT_NAME"))
            )

        tagged = collection.map(_tag_indices_and_cloud)
        raw = await self._get_info(tagged.select([]), timeout=TIMESERIES_TIMEOUT_SECONDS)
        features = (raw or {}).get("features", [])

        points: list[TimeseriesPoint] = []
        for feature in features:
            props = feature.get("properties", {})
            image_date_str = props.get("TS_IMAGE_DATE")
            ndvi_mean = props.get("NDVI")
            cloud_pct = props.get("TS_CLOUD_PCT")
            if image_date_str is None or ndvi_mean is None or cloud_pct is None:
                continue
            points.append(
                TimeseriesPoint(
                    image_date=datetime.strptime(image_date_str, "%Y-%m-%d").date(),
                    satellite=_short_satellite_name(props.get("TS_SATELLITE")),
                    cloud_pct=round(cloud_pct, 1),
                    ndvi_mean=ndvi_mean,
                    ndwi_mean=props.get("NDWI") or 0.0,
                    evi_mean=props.get("EVI") or 0.0,
                )
            )
        points.sort(key=lambda p: p.image_date)
        return points


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
