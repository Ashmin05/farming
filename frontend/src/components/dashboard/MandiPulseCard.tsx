"use client";

// Real mandi price for the selected farm's crop, from /farms/{id}/market-prices.
// Demo (guest) farms get a link instead of numbers -- no sample prices are shown
// as if they were live.

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { useFarmMarketPrices } from "@/lib/hooks/useMarketPrices";
import { isRealFarmId } from "@/lib/hooks/useFarmSatelliteAnalysis";
import { changeClass, longDate, pct, rupees, TREND_META } from "@/components/market/format";

export default function MandiPulseCard({ farmId }: { farmId?: string }) {
  const isReal = isRealFarmId(farmId);
  const { data, isLoading, isError } = useFarmMarketPrices(farmId);
  const top = data?.nearby[0];

  return (
    <div className="bg-white rounded-2xl border border-farm-border-color p-4 shadow-xs hover:shadow-card transition-all flex flex-col">
      <span className="self-start text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
        Mandi price
      </span>
      {!isReal && (
        <p className="text-xs text-farm-muted mt-2 leading-relaxed flex-1">
          Sign in and register a farm to see today&apos;s mandi prices for your crop near your field.
        </p>
      )}
      {isReal && isLoading && (
        <p className="text-xs text-farm-muted mt-2 flex items-center gap-1.5 flex-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading prices…
        </p>
      )}
      {isReal && isError && <p className="text-xs text-rose-700 mt-2 flex-1">Mandi prices can&apos;t be loaded right now.</p>}
      {isReal && data && !top && (
        <p className="text-xs text-farm-muted mt-2 flex-1">{data.message ?? "No recent mandi price is available near this farm."}</p>
      )}
      {isReal && top && (
        <div className="mt-2 flex-1 space-y-1">
          <h3 className="font-bold text-xs text-farm-dark">
            {data?.selected_commodity?.name} · {top.market}
            {top.distance_km !== null && <span className="font-normal text-farm-muted"> ({Math.round(top.distance_km)} km)</span>}
          </h3>
          <p className="text-lg font-extrabold text-farm-dark">
            {rupees(top.modal_price)}
            <span className="text-xs font-normal text-farm-muted">/quintal modal</span>
          </p>
          <p className="text-[11px] text-farm-muted">
            <span className={`font-semibold ${changeClass(top.change_7d_pct)}`}>{pct(top.change_7d_pct)}</span> in 7 days ·{" "}
            {TREND_META[top.trend].label} · {longDate(top.as_of)}
          </p>
        </div>
      )}
      <Link href="/market" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-farm-green hover:underline">
        Open mandi prices <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
