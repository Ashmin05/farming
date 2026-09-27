"use client";

import { useQuery } from "@tanstack/react-query";
import { marketApi } from "@/lib/api/market-client";
import { isRealFarmId } from "@/lib/hooks/useFarmSatelliteAnalysis";

/**
 * TanStack Query hooks over /market-prices. Everything is served from the
 * backend's precomputed tables (refreshed nightly), so a few minutes of
 * client-side caching is plenty.
 */
const STALE = 5 * 60 * 1000;

export function useMarketCommodities(state?: string) {
  return useQuery({ queryKey: ["market", "commodities", state ?? ""], queryFn: () => marketApi.commodities(state), staleTime: STALE });
}

export function useMarketLocations(commodityId?: number) {
  return useQuery({
    queryKey: ["market", "locations", commodityId],
    queryFn: () => marketApi.locations(commodityId),
    enabled: commodityId !== undefined,
    staleTime: STALE,
  });
}

export function useLatestPrices(commodityId?: number, state?: string, district?: string) {
  return useQuery({
    queryKey: ["market", "latest", commodityId, state ?? "", district ?? ""],
    queryFn: () => marketApi.latest({ commodityId: commodityId as number, state, district }),
    enabled: commodityId !== undefined,
    staleTime: STALE,
  });
}

export function usePriceHistory(marketId?: number, commodityId?: number, from?: string, to?: string) {
  return useQuery({
    queryKey: ["market", "history", marketId, commodityId, from ?? "", to ?? ""],
    queryFn: () => marketApi.history({ marketId: marketId as number, commodityId: commodityId as number, from, to }),
    enabled: marketId !== undefined && commodityId !== undefined,
    staleTime: STALE,
  });
}

export function useMarketAnalytics(marketId?: number, commodityId?: number) {
  return useQuery({
    queryKey: ["market", "analytics", marketId, commodityId],
    queryFn: () => marketApi.analytics({ marketId: marketId as number, commodityId: commodityId as number }),
    enabled: marketId !== undefined && commodityId !== undefined,
    staleTime: STALE,
  });
}

export function usePriceForecast(marketId?: number, commodityId?: number) {
  return useQuery({
    queryKey: ["market", "forecast", marketId, commodityId],
    queryFn: () => marketApi.forecast({ marketId: marketId as number, commodityId: commodityId as number }),
    enabled: marketId !== undefined && commodityId !== undefined,
    staleTime: STALE,
  });
}

export function useNearbyMarkets(
  commodityId?: number,
  opts: { lat?: number | null; lon?: number | null; state?: string; district?: string; radiusKm?: number } = {}
) {
  const hasOrigin = (opts.lat !== undefined && opts.lat !== null) || !!opts.state;
  return useQuery({
    queryKey: ["market", "nearby", commodityId, opts.lat ?? null, opts.lon ?? null, opts.state ?? "", opts.district ?? "", opts.radiusKm ?? 100],
    queryFn: () => marketApi.nearby({ commodityId: commodityId as number, ...opts }),
    enabled: commodityId !== undefined && hasOrigin,
    staleTime: STALE,
  });
}

/** The signed-in owner's farm mapped to mandi commodities. No-op for demo farms. */
export function useFarmMarketPrices(farmId?: string) {
  const isRealFarm = isRealFarmId(farmId);
  return useQuery({
    queryKey: ["market", "farm", farmId],
    queryFn: () => marketApi.farm(farmId as string),
    enabled: isRealFarm,
    staleTime: STALE,
  });
}
