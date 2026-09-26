from datetime import datetime, timedelta, timezone

from app.core.satellite_health import compute_health_score, crop_stage_benchmark_ndvi, days_since
from app.integrations.earth_engine_client import (
    EarthEngineClient,
    EarthEngineNotConfiguredError,
    EarthEngineTimeoutError,
    NoSentinelImageryAvailableError,
)
from app.ml.crop_benchmarks import benchmark_ndvi_for_crop
from app.models.farm import Farm
from app.models.farm_alert import FarmAlert
from app.models.index_timeseries import IndexTimeseriesPoint
from app.models.satellite_observation import SatelliteObservation
from app.repositories.farm_alert_repository import FarmAlertRepository
from app.repositories.index_timeseries_repository import IndexTimeseriesRepository
from app.repositories.satellite_repository import SatelliteRepository

# Timeseries points with field cloud cover at/above this are dropped before
# being stored -- too cloudy to trust for a trend line or alert.
TIMESERIES_CLOUD_THRESHOLD = 30.0

# How far back build_timeseries looks, capped regardless of how old the
# farm's sowing_date is -- keeps the Earth Engine query bounded for an
# old/perennial field (see build_timeseries).
TIMESERIES_LOOKBACK_DAYS = 120

# Alert thresholds -- see _generate_alerts for what each one means.
NDVI_DROP_RELATIVE_THRESHOLD = 0.15
BELOW_BENCHMARK_ABSOLUTE_THRESHOLD = 0.1
# Rough day-after-sowing window treated as "vegetative stage" for the water-
# stress rule -- deliberately generic (not per-crop) since it only gates
# *when* NDWI-below-0 is worth flagging, not what NDVI is expected.
VEGETATIVE_STAGE_DAYS = (20, 90)


class SatelliteAnalysisError(Exception):
    """Raised when a satellite refresh can't complete: Earth Engine isn't
    configured, timed out, or no Sentinel-2 imagery was available in the
    analysis window. Safe to return to the client as a 503 (see router)."""


class SatelliteService:
    def __init__(
        self,
        satellite_repository: SatelliteRepository,
        earth_engine_client: EarthEngineClient,
        index_timeseries_repository: IndexTimeseriesRepository | None = None,
        farm_alert_repository: FarmAlertRepository | None = None,
    ) -> None:
        self.satellite_repository = satellite_repository
        self.earth_engine_client = earth_engine_client
        # Optional: only refresh_analysis()/get_latest() are usable without
        # these (existing callers, e.g. the on-farm-create background
        # refresh, don't need the timeseries/alerts machinery at all).
        self.index_timeseries_repository = index_timeseries_repository
        self.farm_alert_repository = farm_alert_repository

    async def get_latest(self, farm: Farm) -> SatelliteObservation | None:
        """Cache-only read -- never touches Earth Engine."""
        return await self.satellite_repository.get_latest_by_farm(farm.id)

    async def refresh_analysis(self, farm: Farm) -> SatelliteObservation:
        """Runs a live Sentinel-2 analysis for `farm`'s polygon and stores
        the result as a new cached observation."""
        try:
            result = await self.earth_engine_client.analyze_field(farm.polygon_geojson)
        except (
            EarthEngineNotConfiguredError,
            EarthEngineTimeoutError,
            NoSentinelImageryAvailableError,
        ) as exc:
            raise SatelliteAnalysisError(str(exc)) from exc

        benchmark_ndvi = crop_stage_benchmark_ndvi(days_since(farm.sowing_date, result.image_date))
        health_score = compute_health_score(
            mean_ndvi=result.ndvi.mean,
            benchmark_ndvi=benchmark_ndvi,
            stressed_pct=result.stressed_pct,
        )

        return await self.satellite_repository.create(
            farm_id=farm.id,
            image_date=result.image_date,
            satellite=result.satellite,
            cloud_pct=result.cloud_pct,
            is_fallback=result.is_fallback,
            ndvi_mean=result.ndvi.mean,
            ndvi_min=result.ndvi.min,
            ndvi_max=result.ndvi.max,
            ndwi_mean=result.ndwi.mean,
            ndwi_min=result.ndwi.min,
            ndwi_max=result.ndwi.max,
            evi_mean=result.evi.mean,
            evi_min=result.evi.min,
            evi_max=result.evi.max,
            ndmi_mean=result.ndmi.mean,
            ndmi_min=result.ndmi.min,
            ndmi_max=result.ndmi.max,
            healthy_pct=result.healthy_pct,
            moderate_pct=result.moderate_pct,
            stressed_pct=result.stressed_pct,
            health_score=health_score,
        )

    async def get_timeseries(self, farm: Farm) -> list[IndexTimeseriesPoint]:
        """Cache-only read of the accumulated NDVI/NDWI/EVI history -- never
        touches Earth Engine. Populated by build_timeseries, normally via
        the nightly scheduler job (app/jobs/scheduler.py)."""
        assert self.index_timeseries_repository is not None, "index_timeseries_repository required"
        return await self.index_timeseries_repository.list_by_farm(farm.id)

    async def get_alerts(self, farm: Farm) -> list[FarmAlert]:
        assert self.farm_alert_repository is not None, "farm_alert_repository required"
        return await self.farm_alert_repository.list_by_farm(farm.id)

    async def build_timeseries(self, farm: Farm) -> list[IndexTimeseriesPoint]:
        """Rebuilds `farm`'s NDVI/NDWI/EVI timeseries from Sentinel-2 (from
        its sowing date, or TIMESERIES_LOOKBACK_DAYS back, whichever is more
        recent, through today), storing every clear (< 30% field cloud)
        pass, then runs the alert rules over the updated series. Called by
        the nightly scheduler job for every farm -- this is the "check every
        farm for a new clear pass" step.
        """
        assert self.index_timeseries_repository is not None, "index_timeseries_repository required"
        assert self.farm_alert_repository is not None, "farm_alert_repository required"

        today = datetime.now(timezone.utc).date()
        lookback_start = today - timedelta(days=TIMESERIES_LOOKBACK_DAYS)
        start = max(farm.sowing_date, lookback_start)

        try:
            raw_points = await self.earth_engine_client.build_field_timeseries(
                farm.polygon_geojson, start=start, end=today
            )
        except (EarthEngineNotConfiguredError, EarthEngineTimeoutError) as exc:
            raise SatelliteAnalysisError(str(exc)) from exc

        clear_points = [p for p in raw_points if p.cloud_pct < TIMESERIES_CLOUD_THRESHOLD]

        for point in clear_points:
            days = days_since(farm.sowing_date, point.image_date)
            benchmark = benchmark_ndvi_for_crop(farm.crop, days)
            await self.index_timeseries_repository.upsert(
                farm_id=farm.id,
                image_date=point.image_date,
                satellite=point.satellite,
                cloud_pct=point.cloud_pct,
                ndvi_mean=point.ndvi_mean,
                ndwi_mean=point.ndwi_mean,
                evi_mean=point.evi_mean,
                benchmark_ndvi=benchmark,
            )

        series = await self.index_timeseries_repository.list_by_farm(farm.id)
        await self._generate_alerts(farm, series)
        return series

    async def _generate_alerts(self, farm: Farm, series: list[IndexTimeseriesPoint]) -> None:
        """Three rules, each checked at every point with a preceding point:
        (a) NDVI dropped more than NDVI_DROP_RELATIVE_THRESHOLD (relative)
            between two consecutive clear passes.
        (b) NDVI has been more than BELOW_BENCHMARK_ABSOLUTE_THRESHOLD below
            the crop-stage benchmark for two consecutive passes.
        (c) NDWI fell below 0 during the vegetative stage (possible water
            stress) -- doesn't need a preceding point.
        Alerts are de-duplicated per (farm, type, detected_at) so re-running
        this over the same historical points (the nightly job re-scans a
        rolling window) doesn't create duplicates.
        """
        assert self.farm_alert_repository is not None, "farm_alert_repository required"

        for i, point in enumerate(series):
            days = days_since(farm.sowing_date, point.image_date)

            if i > 0:
                prev = series[i - 1]
                if prev.ndvi_mean > 0:
                    relative_drop = (prev.ndvi_mean - point.ndvi_mean) / prev.ndvi_mean
                    if relative_drop > NDVI_DROP_RELATIVE_THRESHOLD:
                        await self._create_alert_if_new(
                            farm.id,
                            "ndvi_drop",
                            "warning",
                            point.image_date,
                            f"NDVI dropped {relative_drop * 100:.0f}% between {prev.image_date} and "
                            f"{point.image_date} ({prev.ndvi_mean:.2f} -> {point.ndvi_mean:.2f}).",
                        )

                prev_below = prev.benchmark_ndvi - prev.ndvi_mean > BELOW_BENCHMARK_ABSOLUTE_THRESHOLD
                curr_below = point.benchmark_ndvi - point.ndvi_mean > BELOW_BENCHMARK_ABSOLUTE_THRESHOLD
                if prev_below and curr_below:
                    await self._create_alert_if_new(
                        farm.id,
                        "below_benchmark",
                        "warning",
                        point.image_date,
                        f"NDVI has been more than {BELOW_BENCHMARK_ABSOLUTE_THRESHOLD:.1f} below the "
                        f"{farm.crop} benchmark for two consecutive passes (latest: "
                        f"{point.ndvi_mean:.2f} vs. benchmark {point.benchmark_ndvi:.2f}).",
                    )

            if (
                days is not None
                and VEGETATIVE_STAGE_DAYS[0] <= days <= VEGETATIVE_STAGE_DAYS[1]
                and point.ndwi_mean < 0
            ):
                await self._create_alert_if_new(
                    farm.id,
                    "water_stress",
                    "critical",
                    point.image_date,
                    f"NDWI ({point.ndwi_mean:.2f}) fell below 0 during the vegetative stage "
                    f"(day {days} after sowing) -- possible water stress.",
                )

    async def _create_alert_if_new(self, farm_id, alert_type: str, severity: str, detected_at, message: str) -> None:
        assert self.farm_alert_repository is not None, "farm_alert_repository required"
        if await self.farm_alert_repository.exists(farm_id, alert_type, detected_at):
            return
        await self.farm_alert_repository.create(
            farm_id=farm_id,
            alert_type=alert_type,
            severity=severity,
            detected_at=detected_at,
            message=message,
        )
