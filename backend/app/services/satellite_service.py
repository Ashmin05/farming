from app.core.satellite_health import compute_health_score, crop_stage_benchmark_ndvi, days_since
from app.integrations.earth_engine_client import (
    EarthEngineClient,
    EarthEngineNotConfiguredError,
    EarthEngineTimeoutError,
    NoSentinelImageryAvailableError,
)
from app.models.farm import Farm
from app.models.satellite_observation import SatelliteObservation
from app.repositories.satellite_repository import SatelliteRepository


class SatelliteAnalysisError(Exception):
    """Raised when a satellite refresh can't complete: Earth Engine isn't
    configured, timed out, or no Sentinel-2 imagery was available in the
    analysis window. Safe to return to the client as a 503 (see router)."""


class SatelliteService:
    def __init__(
        self, satellite_repository: SatelliteRepository, earth_engine_client: EarthEngineClient
    ) -> None:
        self.satellite_repository = satellite_repository
        self.earth_engine_client = earth_engine_client

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
