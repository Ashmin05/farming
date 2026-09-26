"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLatestSatelliteAnalysis,
  refreshSatelliteAnalysis,
  SatelliteApiError,
  SatelliteObservation,
} from "@/lib/api/satellite-client";

// Real backend farm ids are UUIDs (backend/app/models/farm.py). Guest/demo
// farms use ids like "farm-1" or "farm-<timestamp>" that never hit the
// backend at all -- this hook is a deliberate no-op for those, so it never
// makes a network call (and never shows an error) for a farm that was never
// going to have a real analysis.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRealFarmId(farmId: string | undefined): boolean {
  return !!farmId && UUID_RE.test(farmId);
}

export function useFarmSatelliteAnalysis(farmId: string | undefined) {
  const isRealFarm = isRealFarmId(farmId);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["satellite-latest", farmId],
    queryFn: () => getLatestSatelliteAnalysis(farmId as string),
    enabled: isRealFarm,
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshSatelliteAnalysis(farmId as string),
    onSuccess: (observation: SatelliteObservation) => {
      queryClient.setQueryData(["satellite-latest", farmId], observation);
    },
  });

  const refresh = useCallback(() => {
    if (!isRealFarm) return;
    refreshMutation.mutate();
  }, [isRealFarm, refreshMutation]);

  return {
    isRealFarm,
    observation: isRealFarm ? query.data ?? null : null,
    isLoading: isRealFarm && query.isLoading,
    isRefreshing: refreshMutation.isPending,
    refreshError:
      refreshMutation.error instanceof SatelliteApiError ? refreshMutation.error.message : null,
    refresh,
  };
}
