"use client";

// Recent history (solid) continuing into the forecast (dashed), with the
// expected range shaded. The forecast segment starts at the last actual
// price so the two lines join.

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ForecastPoint, HistoryPoint } from "@/lib/api/market-client";
import { longDate, rupees, shortDate } from "./format";

interface Point {
  date: string;
  /** UTC ms -- a real time axis, so 7/14/30 days ahead are spaced honestly. */
  t: number;
  label: string;
  actual: number | null;
  forecast: number | null;
  band: [number, number] | null;
  horizon?: number;
}

function ForecastTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="rounded-xl border border-farm-border-color bg-white/95 px-3 py-2 shadow-md text-[11px] space-y-0.5">
      <p className="font-bold text-farm-dark">{longDate(p.date)}</p>
      {p.actual !== null && (
        <p>
          Actual modal <strong className="text-farm-green">{rupees(p.actual)}</strong>
        </p>
      )}
      {p.horizon !== undefined && p.forecast !== null && (
        <>
          <p>
            {p.horizon}-day estimate <strong className="text-sky-700">{rupees(p.forecast)}</strong>
          </p>
          {p.band && (
            <p className="text-farm-muted">
              Expected range {rupees(p.band[0])} – {rupees(p.band[1])}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function ForecastChart({
  history,
  forecasts,
  selectedHorizon,
  height = 260,
}: {
  history: HistoryPoint[];
  forecasts: ForecastPoint[];
  selectedHorizon: number;
  height?: number;
}) {
  const base = forecasts[0];
  const points: Point[] = history.map((h) => ({
    date: h.date,
    t: Date.parse(h.date),
    label: shortDate(h.date),
    actual: h.modal_price,
    forecast: null,
    band: null,
  }));
  if (base) {
    // Join the forecast line to the last actual price.
    const joinIdx = points.findIndex((p) => p.date === base.base_date);
    const join = { forecast: base.base_price, band: [base.base_price, base.base_price] as [number, number] };
    if (joinIdx >= 0) Object.assign(points[joinIdx], join);
    else points.push({ date: base.base_date, t: Date.parse(base.base_date), label: shortDate(base.base_date), actual: base.base_price, ...join });
    for (const f of forecasts) {
      points.push({
        date: f.forecast_date,
        t: Date.parse(f.forecast_date),
        label: shortDate(f.forecast_date),
        actual: null,
        forecast: f.predicted_price,
        band: f.lower_bound !== null && f.upper_bound !== null ? [f.lower_bound, f.upper_bound] : null,
        horizon: f.horizon_days,
      });
    }
  }
  const selected = forecasts.find((f) => f.horizon_days === selectedHorizon);
  const values = points.flatMap((p) => [p.actual, p.forecast, ...(p.band ?? [])].filter((v): v is number => v !== null));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(20, (hi - lo) * 0.1);

  return (
    <div className="w-full" style={{ height }} role="img" aria-label="Price history and forecast chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => shortDate(new Date(t).toISOString())}
            tick={{ fontSize: 10, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.max(0, Math.floor((lo - pad) / 50) * 50), Math.ceil((hi + pad) / 50) * 50]}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip content={ForecastTooltip} cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} />
          {base && <ReferenceLine x={Date.parse(base.base_date)} stroke="#94a3b8" strokeDasharray="2 4" label={{ value: "Latest price", position: "insideTopLeft", fontSize: 10, fill: "#94a3b8" }} />}
          <Area dataKey="band" name="Expected range" stroke="none" fill="#0ea5e9" fillOpacity={0.14} isAnimationActive={false} connectNulls />
          <Line dataKey="actual" name="Actual modal price" stroke="#2d7a3a" strokeWidth={2.25} dot={false} isAnimationActive={false} />
          <Line
            dataKey="forecast"
            name="Estimated price"
            stroke="#0369a1"
            strokeWidth={2}
            strokeDasharray="6 5"
            dot={(props: { cx?: number; cy?: number; payload?: Point; index?: number }) => {
              const { cx, cy, payload, index } = props;
              if (cx === undefined || cy === undefined || payload?.horizon === undefined) return <g key={`d-${index}`} />;
              const isSel = payload.horizon === selected?.horizon_days;
              return <circle key={`d-${index}`} cx={cx} cy={cy} r={isSel ? 5 : 3.5} fill={isSel ? "#0369a1" : "#ffffff"} stroke="#0369a1" strokeWidth={2} />;
            }}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
