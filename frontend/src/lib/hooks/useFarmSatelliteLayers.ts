"use client";

import { useQuery } from "@tanstack/react-query";
import { getSatelliteLayers } from "@/lib/api/satellite-client";
import { isRealFarmId } from "@/lib/hooks/useFarmSatelliteAnalysis";

/**
 * Visualised Sentinel-2 tile URLs + stress zones for a real farm's map.
 * A no-op for guest/demo farm ids (see isRealFarmId) -- no network call,
 * no loading state, nothing. Can take several seconds on a cache miss
 * (a real Earth Engine round trip), so `isLoading` is worth showing.
 */
export function useFarmSatelliteLayers(farmId: string | undefined, imageDate: string | undefined) {
  const isRealFarm = isRealFarmId(farmId);

  const query = useQuery({
    queryKey: ["satellite-layers", farmId, imageDate ?? "latest"],
    queryFn: () => getSatelliteLayers(farmId as string, imageDate),
    enabled: isRealFarm,
    staleTime: 10 * 60 * 1000, // tile URLs are backend-cached ~12h; no need to refetch often
    retry: false,
  });

  return {
    isRealFarm,
    layers: isRealFarm ? query.data ?? null : null,
    isLoading: isRealFarm && query.isLoading,
    isError: query.isError,
  };
}
