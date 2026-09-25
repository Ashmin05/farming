/**
 * Real backend client for /farms (backend/app/routers/farms.py).
 * Used only for signed-in accounts — guests keep the local demo dataset in
 * farmStore.ts. See auth-client.ts for the token storage this reads from.
 */
import { getAccessToken } from "@/lib/auth/auth-client";

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(
  /\/api\/v1\/?$/,
  ""
);

export class FarmApiError extends Error {}

export interface BackendFarm {
  id: string;
  name: string;
  crop: string;
  variety: string | null;
  sowing_date: string;
  irrigation_method: string | null;
  polygon_geojson: GeoJSON.Polygon;
  area_ha: number;
  centroid_lat: number;
  centroid_lng: number;
  state: string | null;
  district: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface FarmCreatePayload {
  name: string;
  crop: string;
  variety?: string | null;
  sowing_date: string;
  irrigation_method?: string | null;
  polygon_geojson: GeoJSON.Polygon;
  state?: string | null;
  district?: string | null;
  address?: string | null;
}

// FastAPI returns `detail` as a plain string for our own HTTPExceptions, but
// as an array of {msg, loc, ...} objects for pydantic validation errors (422).
function extractErrorMessage(payload: unknown, status: number): string {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: unknown }).msg) : String(d)))
      .join(" ");
  }
  return `Request failed (${status})`;
}

async function farmsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new FarmApiError("Not signed in.");

  const res = await fetch(`${API_ROOT}/farms${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new FarmApiError(extractErrorMessage(payload, res.status));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function listFarms(): Promise<BackendFarm[]> {
  return farmsFetch<BackendFarm[]>("");
}

export async function createFarm(payload: FarmCreatePayload): Promise<BackendFarm> {
  return farmsFetch<BackendFarm>("", { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteFarm(farmId: string): Promise<void> {
  await farmsFetch<void>(`/${farmId}`, { method: "DELETE" });
}
