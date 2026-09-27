"use client";

import { useQuery } from "@tanstack/react-query";
import { getEnvironmentReport } from "@/lib/api/satellite-client";
import { isRealFarmId } from "@/lib/hooks/useFarmSatelliteAnalysis";

/**
 * Rainfall / land-surface temperature / soil moisture / soil properties for
 * a real farm. `report` is null until the backend's nightly job has run for
 * this farm (an expected state, not an error). No-op for guest/demo farms.
 */
export function useFarmEnvironment(farmId: string | undefined) {
  const isRealFarm = isRealFarmId(farmId);

  const query = useQuery({
    queryKey: ["farm-environment", farmId],
    queryFn: () => getEnvironmentReport(farmId as string),
    enabled: isRealFarm,
    staleTime: 30 * 60 * 1000, // refreshed nightly on the backend
  });

  return {
    report: isRealFarm ? query.data ?? null : null,
    isLoading: isRealFarm && query.isLoading,
    isError: query.isError,
    retry: query.refetch,
  };
}
