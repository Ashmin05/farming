"use client";

// ==============================================================================
// 📈 MARKET INTELLIGENCE VIEW (URL: /market)
// ==============================================================================
// Real mandi prices from the backend's /market-prices API (Agmarknet 2.0 data,
// refreshed nightly). Nothing on this page is sample data: every number comes
// from the API, and when the API has nothing, the page says so.
//   Filters      crop · state · district · market · period (optionally "my farm")
//   Current      modal / min / max / last updated, freshness warning
//   Trend chart  modal price with the min–max band
//   Summary      7/14/30-day averages, 7/30-day change, trend
//   Outlook      deterministic statements computed by the backend
//   Nearby       sortable mandi comparison (distance where known)
//   Forecast     7/14/30-day estimates with expected range + model facts
// ==============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Info, Loader2, MapPin, RefreshCw, Store, Tractor } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import PriceTrendChart from "@/components/market/PriceTrendChart";
import NearbyMandisTable from "@/components/market/NearbyMandisTable";
import ForecastPanel from "@/components/market/ForecastPanel";
import { changeClass, isoDaysAgo, longDate, pct, rupees, TREND_META } from "@/components/market/format";
import { useFarmStore } from "@/lib/stores/farmStore";
import { isRealFarmId } from "@/lib/hooks/useFarmSatelliteAnalysis";
import {
  useFarmMarketPrices,
  useLatestPrices,
  useMarketAnalytics,
  useMarketCommodities,
  useMarketLocations,
  useNearbyMarkets,
  usePriceForecast,
  usePriceHistory,
} from "@/lib/hooks/useMarketPrices";

const PERIODS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
  { days: 1095, label: "3 years" },
];
const STALE_AFTER_DAYS = 7;

function Section({ title, icon: Icon, right, children }: { title: string; icon?: typeof Store; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-farm-border-color p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold text-farm-dark flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-farm-green" />}
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Notice({ tone = "info", children, action }: { tone?: "info" | "warn" | "error"; children: React.ReactNode; action?: React.ReactNode }) {
  const styles = {
    info: "bg-farm-gray/70 border-farm-border-color text-farm-dark",
    warn: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-rose-50 border-rose-200 text-rose-800",
  }[tone];
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${styles}`} role={tone === "error" ? "alert" : undefined}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-farm-muted py-8 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2">
      <RefreshCw className="w-3 h-3" /> Retry
    </button>
  );
}

function Select({ label, value, onChange, children, disabled }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-farm-muted">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-farm-border-color rounded-lg px-2.5 py-2 text-sm text-farm-dark focus:outline-none focus:border-farm-green disabled:opacity-60"
      >
        {children}
      </select>
    </label>
  );
}

function Stat({ label, value, sub, valueClass = "text-farm-dark" }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-farm-border-color p-3">
      <p className="text-[11px] uppercase tracking-wide text-farm-muted font-semibold">{label}</p>
      <p className={`text-lg font-extrabold mt-0.5 ${valueClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-farm-muted">{sub}</p>}
    </div>
  );
}

function MarketContent() {
  const today = isoDaysAgo(0);
  const { farms, mounted } = useFarmStore();
  const realFarms = useMemo(() => farms.filter((f) => isRealFarmId(f.id)), [farms]);

  const [farmId, setFarmId] = useState<string>("");
  const [commodityId, setCommodityId] = useState<number | undefined>();
  const [state, setState] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [marketId, setMarketId] = useState<number | undefined>();
  const [periodDays, setPeriodDays] = useState(90);

  const farm = realFarms.find((f) => f.id === farmId);
  const farmMarket = useFarmMarketPrices(farm?.id);
  const commodities = useMarketCommodities();
  const locations = useMarketLocations(commodityId);
  const latest = useLatestPrices(commodityId, state || undefined, district || undefined);

  // Default to the signed-in user's first farm -- once, so choosing
  // "none" afterwards sticks.
  const farmDefaulted = useRef(false);
  useEffect(() => {
    if (!mounted || farmDefaulted.current) return;
    farmDefaulted.current = true;
    if (realFarms.length) setFarmId(realFarms[0].id);
  }, [mounted, realFarms]);

  // A farm sets crop + location (the backend maps crop -> mandi commodity).
  useEffect(() => {
    const data = farmMarket.data;
    if (!data?.selected_commodity) return;
    setCommodityId(data.selected_commodity.id);
    setState(data.state ?? "");
    setDistrict("");
    setMarketId(data.nearby[0]?.market_id);
  }, [farmMarket.data]);

  // Otherwise default to the commodity reported by the most markets.
  useEffect(() => {
    if (commodityId !== undefined || !commodities.data?.length) return;
    if (farm && (farmMarket.isLoading || farmMarket.data?.selected_commodity)) return;
    const top = [...commodities.data].sort((a, b) => b.markets - a.markets)[0];
    setCommodityId(top.id);
  }, [commodities.data, commodityId, farm, farmMarket.isLoading, farmMarket.data]);

  // Keep the state valid for the commodity.
  useEffect(() => {
    const states = locations.data;
    if (!states?.length) return;
    if (!states.some((s) => s.name === state)) {
      const biggest = [...states].sort(
        (a, b) => b.districts.reduce((n, d) => n + d.markets, 0) - a.districts.reduce((n, d) => n + d.markets, 0)
      )[0];
      setState(biggest.name);
      setDistrict("");
    }
  }, [locations.data, state]);

  // Keep the market valid for the filters; default to the most active one.
  useEffect(() => {
    const prices = latest.data?.prices;
    if (!prices) return;
    if (!prices.some((p) => p.market_id === marketId)) {
      const fresh = [...prices].sort((a, b) => b.as_of.localeCompare(a.as_of) || b.trading_days_30d - a.trading_days_30d);
      setMarketId(fresh[0]?.market_id);
    }
  }, [latest.data, marketId]);

  const selectedStats = latest.data?.prices.find((p) => p.market_id === marketId);
  const from = isoDaysAgo(periodDays);
  const history = usePriceHistory(marketId, commodityId, from, today);
  const analytics = useMarketAnalytics(marketId, commodityId);
  const forecast = usePriceForecast(marketId, commodityId);
  const forecastHistory = usePriceHistory(marketId, commodityId, isoDaysAgo(90), today);
  const selectedMarket = analytics.data?.market ?? history.data?.market;
  const origin = farm
    ? { lat: farm.center[1], lon: farm.center[0] }
    : { lat: selectedMarket?.latitude ?? null, lon: selectedMarket?.longitude ?? null };
  const nearby = useNearbyMarkets(commodityId, { ...origin, state: state || undefined, district: district || undefined, radiusKm: 100 });

  const commodityName = commodities.data?.find((c) => c.id === commodityId)?.name ?? "";
  const districts = locations.data?.find((s) => s.name === state)?.districts ?? [];
  const staleDays = selectedStats ? Math.round((Date.parse(today) - Date.parse(selectedStats.as_of)) / 86_400_000) : 0;

  // ---- whole-page states ----
  if (commodities.isLoading) return <Loading label="Loading mandi prices…" />;
  if (commodities.isError) {
    return (
      <Notice tone="error" action={<RetryButton onClick={() => commodities.refetch()} />}>
        Mandi prices can&apos;t be loaded right now. {(commodities.error as Error)?.message}
      </Notice>
    );
  }
  if (!commodities.data?.length) {
    return <Notice>No mandi price data has been imported yet. Prices appear here after the nightly import from Agmarknet.</Notice>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <section className="bg-white rounded-2xl border border-farm-border-color p-4 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {realFarms.length > 0 && (
            <Select label="My farm" value={farmId} onChange={(v) => setFarmId(v)}>
              <option value="">— none —</option>
              {realFarms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          )}
          <Select
            label="Crop"
            value={commodityId?.toString() ?? ""}
            onChange={(v) => {
              setCommodityId(Number(v));
              setMarketId(undefined);
            }}
          >
            {commodities.data.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select label="State" value={state} onChange={(v) => { setState(v); setDistrict(""); setMarketId(undefined); }} disabled={!locations.data?.length}>
            {(locations.data ?? []).map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </Select>
          <Select label="District" value={district} onChange={(v) => { setDistrict(v); setMarketId(undefined); }} disabled={!districts.length}>
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.name}>{d.name} ({d.markets})</option>
            ))}
          </Select>
          <Select label="Market" value={marketId?.toString() ?? ""} onChange={(v) => setMarketId(Number(v))} disabled={!latest.data?.prices.length}>
            {(latest.data?.prices ?? [])
              .slice()
              .sort((a, b) => a.market.localeCompare(b.market))
              .map((p) => (
                <option key={p.market_id} value={p.market_id}>{p.market}</option>
              ))}
          </Select>
          <Select label="Period" value={String(periodDays)} onChange={(v) => setPeriodDays(Number(v))}>
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>{p.label}</option>
            ))}
          </Select>
        </div>
        {farm && farmMarket.data?.message && <p className="text-xs text-amber-700 mt-3">{farmMarket.data.message}</p>}
        {farm && farmMarket.isError && <p className="text-xs text-rose-700 mt-3">Your farm&apos;s crop couldn&apos;t be matched right now; choose a crop above.</p>}
      </section>

      {latest.isLoading && <Loading label="Loading latest prices…" />}
      {latest.isError && (
        <Notice tone="error" action={<RetryButton onClick={() => latest.refetch()} />}>
          Latest prices can&apos;t be loaded right now.
        </Notice>
      )}
      {latest.data && latest.data.prices.length === 0 && (
        <Notice>No recent mandi price is available for {commodityName || "this commodity"}{district ? ` in ${district}` : ""}.</Notice>
      )}

      {selectedStats && (
        <>
          {staleDays > STALE_AFTER_DAYS && (
            <Notice tone="warn">
              The latest price from {selectedStats.market} is from {longDate(selectedStats.as_of)} ({staleDays} days ago). This market hasn&apos;t reported {commodityName} recently.
            </Notice>
          )}

          {/* Current price */}
          <Section
            title={`${commodityName} at ${selectedStats.market}`}
            icon={Store}
            right={
              <span className="text-[11px] text-farm-muted">
                {selectedStats.district ? `${selectedStats.district}, ` : ""}{selectedStats.state} · Rs/quintal · {latest.data?.provenance.sources.join(", ")}
              </span>
            }
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Modal price" value={rupees(selectedStats.modal_price)} sub="most common trade price" valueClass="text-farm-green" />
              <Stat label="Min price" value={rupees(selectedStats.min_price)} />
              <Stat label="Max price" value={rupees(selectedStats.max_price)} />
              <Stat
                label="Last updated"
                value={longDate(selectedStats.as_of)}
                sub={selectedStats.arrival_quantity !== null ? `arrivals ${selectedStats.arrival_quantity.toLocaleString("en-IN")} t` : undefined}
              />
            </div>
          </Section>

          {/* Trend chart */}
          <Section title="Price trend" icon={Tractor} right={<span className="text-[11px] text-farm-muted">Modal price with the day&apos;s min–max range</span>}>
            {history.isLoading && <Loading label="Loading price history…" />}
            {history.isError && <Notice tone="error" action={<RetryButton onClick={() => history.refetch()} />}>Price history can&apos;t be loaded right now.</Notice>}
            {history.data && history.data.series.length === 0 && <Notice>No historical prices for this market in the selected period.</Notice>}
            {history.data && history.data.series.length > 0 && <PriceTrendChart series={history.data.series} />}
          </Section>

          {/* Summary + outlook */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Section title="Price summary" right={<TrendPill trend={selectedStats.trend} change={selectedStats.trend_change_pct} />}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Stat label="7-day average" value={rupees(selectedStats.avg_7d)} />
                  <Stat label="14-day average" value={rupees(selectedStats.avg_14d)} />
                  <Stat label="30-day average" value={rupees(selectedStats.avg_30d)} />
                  <Stat label="7-day change" value={pct(selectedStats.change_7d_pct)} valueClass={changeClass(selectedStats.change_7d_pct)} />
                  <Stat label="30-day change" value={pct(selectedStats.change_30d_pct)} valueClass={changeClass(selectedStats.change_30d_pct)} />
                  <Stat
                    label="30-day range"
                    value={`${rupees(selectedStats.min_30d)} – ${rupees(selectedStats.max_30d)}`}
                    sub={`${selectedStats.trading_days_30d} trading days`}
                  />
                </div>
                <p className="text-[11px] text-farm-muted mt-3">
                  Trend compares the last 7 days&apos; average with the 7 days before (±2.5% counts as stable).
                </p>
              </Section>
            </div>
            <Section title="Price outlook">
              {analytics.isLoading && <Loading label="Working out the outlook…" />}
              {analytics.data && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-farm-dark">
                    Price outlook: <span className="capitalize">{analytics.data.outlook.label}</span>
                  </p>
                  <ul className="space-y-1.5 text-sm text-farm-dark list-disc pl-4">
                    {analytics.data.outlook.statements.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-farm-muted">Calculated from the prices and forecast shown on this page.</p>
                </div>
              )}
              {analytics.isError && <Notice tone="error">The outlook can&apos;t be loaded right now.</Notice>}
            </Section>
          </div>

          {/* Nearby */}
          <Section
            title="Nearby mandis"
            icon={MapPin}
            right={<span className="text-[11px] text-farm-muted">{farm ? `From ${farm.name}` : `Around ${selectedStats.market}`} · within 100 km, then same district/state</span>}
          >
            {nearby.isLoading && <Loading label="Finding nearby mandis…" />}
            {nearby.isError && <Notice tone="error" action={<RetryButton onClick={() => nearby.refetch()} />}>Nearby mandis can&apos;t be loaded right now.</Notice>}
            {nearby.data && nearby.data.markets.length === 0 && <Notice>No other mandi near here has reported {commodityName} recently.</Notice>}
            {nearby.data && nearby.data.markets.length > 0 && (
              <>
                <NearbyMandisTable markets={nearby.data.markets} selectedMarketId={marketId} onSelect={setMarketId} today={today} />
                <p className="text-[11px] text-farm-muted mt-2">
                  {nearby.data.note}
                  {nearby.data.attribution && <> · {nearby.data.attribution}</>}
                </p>
              </>
            )}
          </Section>

          {/* Forecast */}
          <Section title="Price forecast" right={<span className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">Estimate</span>}>
            {forecast.isLoading && <Loading label="Loading forecast…" />}
            {forecast.isError && <Notice tone="error" action={<RetryButton onClick={() => forecast.refetch()} />}>The forecast can&apos;t be loaded right now.</Notice>}
            {forecast.data && <ForecastPanel forecast={forecast.data} history={forecastHistory.data?.series ?? []} />}
          </Section>
        </>
      )}
    </div>
  );
}

function TrendPill({ trend, change }: { trend: keyof typeof TREND_META; change: number | null }) {
  const meta = TREND_META[trend];
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      <meta.Icon className="w-3.5 h-3.5" />
      {meta.label}
      {change !== null && <span className="font-normal opacity-80">({pct(change)} week on week)</span>}
    </span>
  );
}

export default function MarketPage() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-4 pb-16">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-farm-dark">Mandi Prices</h1>
          <p className="text-sm text-farm-muted mt-1">
            Daily prices reported by APMC mandis on Agmarknet, with trends, nearby markets and forecasts.
          </p>
        </div>
        <MarketContent />
      </div>
    </AppLayout>
  );
}
