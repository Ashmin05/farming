"use client";

import { useState } from "react";
import { Info, LineChart as LineChartIcon } from "lucide-react";
import type { HistoryPoint, PriceForecast } from "@/lib/api/market-client";
import ForecastChart from "./ForecastChart";
import { changeClass, longDate, MODEL_LABELS, pct, rupees } from "./format";

const HORIZONS = [7, 14, 30] as const;
const BASELINE_MODELS = new Set(["naive", "moving_average", "seasonal_naive"]);

export default function ForecastPanel({ forecast, history }: { forecast: PriceForecast; history: HistoryPoint[] }) {
  const [horizon, setHorizon] = useState<number>(7);

  if (!forecast.available || forecast.forecasts.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-farm-border-color bg-farm-gray/60 p-4">
        <Info className="w-4 h-4 text-farm-muted mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-farm-dark">Forecast unavailable</p>
          <p className="text-farm-muted mt-0.5">{forecast.reason ?? "Forecast unavailable because insufficient historical data exists."}</p>
        </div>
      </div>
    );
  }

  const point = forecast.forecasts.find((f) => f.horizon_days === horizon) ?? forecast.forecasts[0];
  const model = forecast.models.find((m) => m.horizon_days === point.horizon_days);
  const recent = history.slice(-60);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Forecast horizon" className="inline-flex rounded-xl border border-farm-border-color bg-farm-gray p-1">
          {HORIZONS.map((h) => {
            const has = forecast.forecasts.some((f) => f.horizon_days === h);
            const active = point.horizon_days === h;
            return (
              <button
                key={h}
                role="tab"
                aria-selected={active}
                disabled={!has}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active ? "bg-white text-farm-dark shadow-sm" : "text-farm-muted hover:text-farm-dark disabled:opacity-40"
                }`}
              >
                {h} days
              </button>
            );
          })}
        </div>
        <span className="text-[11px] text-farm-muted">
          Estimate from the price on {longDate(point.base_date)} · generated {forecast.generated_at ? longDate(forecast.generated_at) : "—"}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-farm-border-color p-3">
          <p className="text-[11px] uppercase tracking-wide text-farm-muted font-semibold">Estimated price</p>
          <p className="text-xl font-extrabold text-farm-dark mt-0.5">{rupees(point.predicted_price)}</p>
          <p className="text-[11px] text-farm-muted">for {longDate(point.forecast_date)}</p>
        </div>
        <div className="rounded-xl border border-farm-border-color p-3">
          <p className="text-[11px] uppercase tracking-wide text-farm-muted font-semibold">Expected range</p>
          <p className="text-base font-bold text-farm-dark mt-1">
            {rupees(point.lower_bound)} – {rupees(point.upper_bound)}
          </p>
          <p className="text-[11px] text-farm-muted">
            {model?.interval.level ? `${Math.round(model.interval.level * 100)}% range` : "range"}
            {model?.interval.holdout_coverage !== null && model?.interval.holdout_coverage !== undefined
              ? ` · held ${Math.round(model.interval.holdout_coverage * 100)}% of the time in testing`
              : ""}
          </p>
        </div>
        <div className="rounded-xl border border-farm-border-color p-3">
          <p className="text-[11px] uppercase tracking-wide text-farm-muted font-semibold">Change vs latest</p>
          <p className={`text-xl font-extrabold mt-0.5 ${changeClass(point.change_pct)}`}>{pct(point.change_pct)}</p>
          <p className="text-[11px] text-farm-muted">from {rupees(point.base_price)}</p>
        </div>
        <div className="rounded-xl border border-farm-border-color p-3">
          <p className="text-[11px] uppercase tracking-wide text-farm-muted font-semibold">Typical error</p>
          <p className="text-xl font-extrabold text-farm-dark mt-0.5">± {rupees(model?.validation.mae)}</p>
          <p className="text-[11px] text-farm-muted">
            {model?.validation.mape !== null && model?.validation.mape !== undefined ? `about ${model.validation.mape.toFixed(1)}% in testing` : "in testing"}
          </p>
        </div>
      </div>

      <ForecastChart history={recent} forecasts={forecast.forecasts} selectedHorizon={point.horizon_days} />
      <div className="flex flex-wrap gap-4 text-[11px] text-farm-muted">
        <span className="inline-flex items-center gap-1.5"><span className="w-5 h-0.5 bg-farm-green inline-block" /> Actual modal price</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-sky-700 inline-block" /> Estimated price</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-3 bg-sky-500/20 inline-block rounded-sm" /> Expected range</span>
      </div>

      <div className="rounded-xl bg-farm-gray/70 border border-farm-border-color p-3.5 text-xs text-farm-dark space-y-2">
        <p className="flex items-start gap-2">
          <LineChartIcon className="w-3.5 h-3.5 text-farm-green mt-0.5 flex-shrink-0" />
          {model && BASELINE_MODELS.has(model.model_name) ? (
            <span>
              Models trained on historical mandi prices, seasonal patterns, recent trends and arrival data were tested
              against simple baselines. For this crop and horizon none beat the {MODEL_LABELS[model.model_name]?.toLowerCase()} baseline,
              so that is what this estimate uses{model.model_name === "naive" ? ": the latest price carried forward" : ""}.
            </span>
          ) : (
            <span>Forecast is based on historical mandi prices, seasonal patterns, recent price trends, and available arrival data.</span>
          )}
        </p>
        {model && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
            <div className="flex gap-2"><dt className="text-farm-muted">Model:</dt><dd className="font-semibold">{MODEL_LABELS[model.model_name] ?? model.model_name}</dd></div>
            <div className="flex gap-2"><dt className="text-farm-muted">Training period:</dt><dd className="font-semibold">{longDate(model.training_period.from)} – {longDate(model.training_period.to)}</dd></div>
            <div className="flex gap-2">
              <dt className="text-farm-muted">Validation MAE:</dt>
              <dd className="font-semibold">
                {rupees(model.validation.mae)}/quintal
                {model.validation.naive_mae !== null && (
                  <span className="text-farm-muted font-normal"> (no-change baseline {rupees(model.validation.naive_mae)})</span>
                )}
              </dd>
            </div>
            <div className="flex gap-2"><dt className="text-farm-muted">Last model update:</dt><dd className="font-semibold">{longDate(model.trained_at)}</dd></div>
          </dl>
        )}
        <p className="text-[11px] text-farm-muted">{forecast.disclaimer}</p>
      </div>
    </div>
  );
}
