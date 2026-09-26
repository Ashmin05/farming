/**
 * Real backend client for /farms/{id}/satellite/* (backend/app/routers/satellite.py).
 * Used only for real, signed-in-owned farms — see useFarmSatelliteAnalysis.ts for the
 * hook that decides whether a given farm id is real (backend UUID) or a guest/demo id.
 */
import { getAccessToken } from "@/lib/auth/auth-client";

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(
  /\/api\/v1\/?$/,
  ""
);

export class SatelliteApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface IndexStats {
  mean: number;
  min: number;
  max: number;
}

export interface SatelliteProvenance {
  source: string;
  is_live: boolean;
  as_of: string; // ISO date
  cloud_pct: number;
}

export interface SatelliteObservation {
  id: string;
  farm_id: string;
  image_date: string; // ISO date
  satellite: string; // "S2A" / "S2B"
  cloud_pct: number;
  is_fallback: boolean;
  ndvi: IndexStats;
  ndwi: IndexStats;
  evi: IndexStats;
  ndmi: IndexStats;
  healthy_pct: number;
  moderate_pct: number;
  stressed_pct: number;
  health_score: number;
  provenance: SatelliteProvenance;
  created_at: string;
}

function extractErrorMessage(payload: unknown, status: number): string {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  return `Request failed (${status})`;
}

async function satelliteFetch<T>(farmId: string, path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new SatelliteApiError("Not signed in.", 401);

  const res = await fetch(`${API_ROOT}/farms/${farmId}/satellite${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new SatelliteApiError(extractErrorMessage(payload, res.status), res.status);
  }
  return res.json() as Promise<T>;
}

/**
 * Cache-only read — never triggers a live Earth Engine query. Returns `null`
 * (rather than throwing) when no analysis has run yet for this farm, since
 * that's an expected, common state for a brand-new farm.
 */
export async function getLatestSatelliteAnalysis(farmId: string): Promise<SatelliteObservation | null> {
  try {
    return await satelliteFetch<SatelliteObservation>(farmId, "/latest");
  } catch (err) {
    if (err instanceof SatelliteApiError && err.status === 404) return null;
    throw err;
  }
}

/** Runs a real, live Sentinel-2 query via Earth Engine — slower than the
 * cache read above, so only call this on an explicit user action. */
export async function refreshSatelliteAnalysis(farmId: string): Promise<SatelliteObservation> {
  return satelliteFetch<SatelliteObservation>(farmId, "/refresh", { method: "POST" });
}

export interface TileLayerUrls {
  true_color: string;
  ndvi: string;
  ndwi: string;
  evi: string;
  stress: string;
}

export interface StressZone {
  id: string;
  zone_type: "water_stress" | "nutrient_pest_suspected";
  area_ha: number;
  geometry_geojson: GeoJSON.Geometry;
  suggested_action: string;
}

export interface SatelliteLayers {
  farm_id: string;
  image_date: string; // ISO date
  layers: TileLayerUrls;
  generated_at: string;
  expires_at: string;
  stress_zones: StressZone[];
}

/**
 * Visualised, farm-polygon-clipped Sentinel-2 tile URLs (true color, NDVI,
 * NDWI, EVI, stress classification) plus vectorized stress zones for one
 * scene. Backend-cached for ~12h; can be a real Earth Engine round trip
 * (several seconds), not just a cache read, so callers should show a
 * loading state. Returns `null` when no analysis has run yet for this farm
 * (an expected state for a brand-new farm) instead of throwing.
 */
export async function getSatelliteLayers(farmId: string, date?: string): Promise<SatelliteLayers | null> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  try {
    return await satelliteFetch<SatelliteLayers>(farmId, `/layers${query}`);
  } catch (err) {
    if (err instanceof SatelliteApiError && err.status === 503) return null;
    throw err;
  }
}
