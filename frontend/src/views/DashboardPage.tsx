"use client";

// ==============================================================================
// 📊 FARMER DASHBOARD
// ==============================================================================
// Route URL: /dashboard
// Design Principles:
// 1. Greeting hero + farm selector up top.
// 2. Four at-a-glance stat cards (NDVI, soil, moisture, weather). For a
//    signed-in user's real farm, NDVI/health, soil and moisture come from the
//    backend (/satellite/latest, /environment) with SourceBadges and
//    loading/empty/error states; guests keep demo values.
// 3. Real farms: satellite alerts strip with mark-as-read (/alerts).
//    Guests: the demo weather/advisory banner.
// 4. Smart Suggestion + Harvest Estimation side by side.
// 5. Mandi Price Pulse (real prices for the farm's crop) & sample agri news, then Quick Tools.
// ==============================================================================

import { useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { useFarmStore, useUserStore, applyLiveSatellite, applyLiveWeather } from "@/lib/stores/farmStore";
import { useFarmSatelliteAnalysis } from "@/lib/hooks/useFarmSatelliteAnalysis";
import { useFarmEnvironment } from "@/lib/hooks/useFarmEnvironment";
import { useFarmWeather } from "@/lib/hooks/useFarmWeather";
import SourceBadge, { LiveSource } from "@/components/SourceBadge";
import SatelliteStatusState from "@/components/satellite/SatelliteStatusState";
import AlertsStrip from "@/components/dashboard/AlertsStrip";
import MarketPriceCard from "@/components/dashboard/MarketPriceCard";
import FarmsLoadError from "@/components/FarmsLoadError";
import FarmWeatherReport from "@/components/satellite/FarmWeatherReport";
import {
  Droplets, TrendingUp, AlertTriangle,
  ShieldCheck, Thermometer, CheckCircle2,
  ChevronRight, ChevronDown, Sparkles, Newspaper,
  Sprout, Leaf, CloudSun, Loader2, MoonStar
} from "lucide-react";

function useGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { farms, mounted, loadError, retryLoad } = useFarmStore();
  const { profile } = useUserStore();
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farms[0]?.id || "farm-1");
  const greeting = useGreeting();

  const currentFarm = farms.find((f) => f.id === selectedFarmId) || farms[0];
  const {
    isRealFarm,
    status: satelliteStatus,
    observation: satelliteObservation,
    error: satelliteError,
    retry: retrySatellite,
  } = useFarmSatelliteAnalysis(currentFarm?.id);
  const { report: environment, isLoading: environmentLoading, isError: environmentError, retry: retryEnvironment } =
    useFarmEnvironment(currentFarm?.id);
  const { weather: liveWeather, isLoading: weatherLoading, isError: weatherError, retry: retryWeather } =
    useFarmWeather(currentFarm?.id);
  const currentSatellite = currentFarm && satelliteObservation
    ? applyLiveSatellite(currentFarm.satellite, satelliteObservation)
    : currentFarm?.satellite;
  const currentWeather = currentFarm && liveWeather
    ? applyLiveWeather(currentFarm.weather, liveWeather)
    : currentFarm?.weather;
  const sentinelSource: LiveSource | null = satelliteObservation
    ? { source: "Sentinel-2", asOf: satelliteObservation.image_date, cloudPct: satelliteObservation.cloud_pct }
    : null;

  // Until the real (per-account) farm list has loaded client-side, `farms`
  // is still the SSR-safe placeholder — render an empty shell rather than
  // flash it (keep the sidebar so the layout doesn't jump).
  if (!mounted) {
    return <AppLayout>{null}</AppLayout>;
  }

  if (loadError) {
    return (
      <AppLayout>
        <FarmsLoadError message={loadError} onRetry={() => retryLoad()} />
      </AppLayout>
    );
  }

  if (!currentFarm) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto text-center py-20 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-farm-green-light flex items-center justify-center mx-auto">
            <Sprout className="w-7 h-7 text-farm-green" />
          </div>
          <h2 className="text-xl font-bold text-farm-dark">No farms yet</h2>
          <p className="text-farm-muted text-sm">
            Register your first farm to see live satellite health, weather, and yield insights here.
          </p>
          <Link
            href="/farms"
            className="inline-flex items-center gap-2 bg-farm-green text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-farm-green-dark transition-all shadow-sm"
          >
            Register a Farm
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </AppLayout>
    );
  }

  const primaryAlert = currentFarm.weather.alerts?.[0];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-16">
        {/* ── Greeting Hero + Farm Selector ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-farm-green-light via-white to-sky-50 border border-farm-border-color p-6 sm:p-7">
          <Sprout className="absolute -right-6 -bottom-8 w-40 h-40 text-farm-green/10 pointer-events-none" strokeWidth={1} />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-farm-muted text-sm font-medium">{greeting},</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-farm-dark tracking-tight mt-0.5">
                {profile.name && profile.name !== "Farmer" ? profile.name : "Kisan"} 👋
              </h1>
              <p className="text-farm-muted text-xs sm:text-sm mt-1">Here&apos;s the latest update on your farm</p>
            </div>

            <div className="self-start sm:self-auto relative flex-shrink-0">
              <select
                aria-label="Select Active Farm"
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="appearance-none bg-white border-2 border-farm-green/70 hover:border-farm-green text-farm-dark font-bold text-xs sm:text-sm pl-4 pr-10 py-2.5 rounded-2xl shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-farm-green/20 transition-all"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.crop} · {f.district}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-farm-green absolute right-3.5 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── 4 Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Crop Health (NDVI) */}
          <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group flex flex-col items-center text-center">
            <span className="text-emerald-600 mb-2 group-hover:scale-105 transition-transform">
              <Leaf className="w-7 h-7" />
            </span>
            <span className="text-xs font-medium text-farm-muted mb-2">Crop Health (NDVI)</span>
            {isRealFarm && !satelliteObservation ? (
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <SatelliteStatusState compact status={satelliteStatus} error={satelliteError} onRetry={retrySatellite} />
              </div>
            ) : (
              <>
                <span className="text-2xl font-extrabold text-farm-dark">{currentSatellite!.meanNdvi.toFixed(2)}</span>
                <span className="mt-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {currentSatellite!.canopyVigourLabel}
                </span>
                <p className="text-xs text-farm-muted mt-2">
                  {satelliteObservation && (
                    <>
                      Health score <strong className="text-farm-dark">{satelliteObservation.health_score.toFixed(0)}/100</strong>
                      {" · "}
                    </>
                  )}
                  {currentSatellite!.healthyCanopyPercent}% healthy cover
                </p>
                <div className="mt-2">
                  {sentinelSource ? <SourceBadge live={sentinelSource} /> : <SourceBadge demo />}
                </div>
              </>
            )}
          </div>

          {/* Soil Condition */}
          <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group flex flex-col items-center text-center">
            <span className="text-amber-600 mb-2 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-7 h-7" />
            </span>
            <span className="text-xs font-medium text-farm-muted mb-2">Soil Condition</span>
            {isRealFarm ? (
              environmentLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <p className="text-xs text-farm-muted flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading soil report…
                  </p>
                </div>
              ) : environmentError ? (
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <p className="text-xs text-red-700">
                    Couldn&apos;t load the soil report.{" "}
                    <button onClick={() => retryEnvironment()} className="font-semibold underline">
                      Retry
                    </button>
                  </p>
                </div>
              ) : environment ? (
                <>
                  <span className="text-2xl font-extrabold text-farm-dark">
                    pH {environment.soil.ph !== null ? environment.soil.ph.toFixed(1) : "—"}
                  </span>
                  {environment.soil.texture_class && (
                    <span className="mt-1 text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                      {environment.soil.texture_class}
                    </span>
                  )}
                  <p className="text-xs text-farm-muted mt-2">
                    Organic carbon:{" "}
                    {environment.soil.organic_carbon_g_per_kg !== null
                      ? `${environment.soil.organic_carbon_g_per_kg.toFixed(0)} g/kg`
                      : "—"}
                  </p>
                  <div className="mt-2">
                    <SourceBadge
                      live={{ label: "Soil map", source: "OpenLandMap", asOf: null, resolution: environment.soil.provenance.resolution }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <p className="text-xs text-farm-muted flex flex-col items-center gap-2">
                    <MoonStar className="w-4 h-4 flex-shrink-0" />
                    Soil report is generated by the nightly refresh — check back tomorrow.
                  </p>
                </div>
              )
            ) : (
              <>
                <span className="text-2xl font-extrabold text-farm-dark">pH {currentFarm.soil.ph}</span>
                <span className="mt-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {currentFarm.soil.healthRating}
                </span>
                <p className="text-xs text-farm-muted mt-2">
                  N: {currentFarm.soil.nitrogen} · P: {currentFarm.soil.phosphorus} · K: {currentFarm.soil.potassium}
                </p>
                <div className="mt-2">
                  <SourceBadge demo />
                </div>
              </>
            )}
          </div>

          {/* Canopy Moisture */}
          <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group flex flex-col items-center text-center">
            <span className="text-sky-600 mb-2 group-hover:scale-105 transition-transform">
              <Droplets className="w-7 h-7" />
            </span>
            <span className="text-xs font-medium text-farm-muted mb-2">Canopy Moisture</span>
            {isRealFarm ? (
              satelliteObservation && sentinelSource ? (
                <>
                  <span className="text-2xl font-extrabold text-farm-dark">
                    NDWI {satelliteObservation.ndwi.mean.toFixed(2)}
                  </span>
                  <span
                    className={`mt-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                      satelliteObservation.ndwi.mean >= 0 ? "bg-sky-100 text-sky-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {satelliteObservation.ndwi.mean >= 0 ? "Adequate" : "Dry"}
                  </span>
                  <div className="mt-2">
                    <SourceBadge live={sentinelSource} />
                  </div>
                  {environment && environment.soil_moisture.surface_moisture !== null && (
                    <div className="mt-2 space-y-1 flex flex-col items-center">
                      <p className="text-xs text-farm-muted">
                        Soil moisture {environment.soil_moisture.surface_moisture.toFixed(2)} m³/m³
                      </p>
                      <SourceBadge
                        live={{
                          source: "SMAP",
                          asOf: environment.soil_moisture.provenance.as_of,
                          resolution: environment.soil_moisture.provenance.resolution,
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <p className="text-xs text-farm-muted">Available once the first satellite analysis finishes.</p>
                </div>
              )
            ) : (
              <>
                <span className="text-2xl font-extrabold text-farm-dark">{currentFarm.water.soilMoisturePercent}%</span>
                <span
                  className={`mt-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                    currentFarm.water.status === "Optimal" ? "bg-sky-100 text-sky-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {currentFarm.water.status}
                </span>
                <p className="text-xs text-farm-muted mt-2 truncate" title={currentFarm.water.nextRecommendedAction}>
                  Last watered: {currentFarm.water.lastIrrigationDaysAgo}d ago
                </p>
                <div className="mt-2">
                  <SourceBadge demo />
                </div>
              </>
            )}
          </div>

          {/* Field Weather */}
          <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group flex flex-col items-center text-center">
            <span className="text-orange-600 mb-2 group-hover:scale-105 transition-transform">
              <Thermometer className="w-7 h-7" />
            </span>
            <span className="text-xs font-medium text-farm-muted mb-2">Field Weather</span>
            {isRealFarm && weatherLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <p className="text-xs text-farm-muted flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading forecast…
                </p>
              </div>
            ) : isRealFarm && weatherError ? (
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <p className="text-xs text-red-700">
                  Couldn&apos;t load the forecast.{" "}
                  <button onClick={() => retryWeather()} className="font-semibold underline">
                    Retry
                  </button>
                </p>
              </div>
            ) : (
              currentWeather && (
                <>
                  <span className="text-2xl font-extrabold text-farm-dark">{currentWeather.currentTemp}°C</span>
                  <span className="text-xs text-farm-muted font-medium mt-1">{currentWeather.condition}</span>
                  <p className="text-xs text-farm-muted mt-2 flex items-center justify-center gap-2">
                    <span>💧 {currentWeather.humidity}%</span>
                    <span>💨 {currentWeather.windKmh} km/h</span>
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
                    {isRealFarm && liveWeather ? (
                      <>
                        <SourceBadge live={{ source: "Open-Meteo", asOf: liveWeather.provenance.fetched_at }} />
                        <span className="text-[10px] text-farm-muted">
                          fetched{" "}
                          {new Date(liveWeather.provenance.fetched_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </>
                    ) : (
                      <SourceBadge demo />
                    )}
                  </div>
                </>
              )
            )}
          </div>
        </div>

        {/* ── Satellite alerts (real farms) / demo weather banner (guests) ── */}
        {isRealFarm ? (
          <AlertsStrip farmId={currentFarm.id} />
        ) : primaryAlert ? (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-amber-200/70 text-amber-800 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-amber-950">{primaryAlert.headline}</h3>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                    {primaryAlert.severity}
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-0.5">{primaryAlert.actionAdvice}</p>
              </div>
            </div>
            <Link
              href={`/satellite?farm=${currentFarm.id}`}
              className="self-start sm:self-auto px-4 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-900 hover:bg-amber-100 transition-all flex items-center gap-1 flex-shrink-0"
            >
              View Details <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-farm-dark">No Severe Weather Disruption Forecast</h3>
              <p className="text-xs text-farm-muted mt-0.5">
                Clear conditions prevailing over {currentFarm.district}. Routine farm activities can proceed normally.
              </p>
            </div>
          </div>
        )}

        {/* ── Smart Suggestion + Harvest Estimation, side by side ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Smart Suggestion */}
          <div className="bg-white rounded-2xl border border-farm-border-color p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-farm-muted flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-farm-green" />
              Smart Suggestion
            </h2>
            <div>
              <h3 className="font-bold text-farm-dark text-sm">
                Crop Stage: {currentSatellite!.history[currentSatellite!.history.length - 1]?.stage ?? "Vegetative"} ({currentFarm.crop})
              </h3>
              <p className="text-xs text-farm-muted leading-relaxed mt-1">
                {currentFarm.water.nextRecommendedAction} Foliar nutrient absorption is currently optimal under{" "}
                {currentWeather?.currentTemp ?? currentFarm.weather.currentTemp}°C temperature conditions.
              </p>
            </div>
            <Link
              href={`/ai-chat?q=${encodeURIComponent(
                `Give me a detailed crop-stage advisory for my ${currentFarm.crop} field`
              )}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-farm-green hover:text-farm-green-dark"
            >
              View Detailed Advisory <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Harvest Estimation */}
          <div className="bg-white rounded-2xl border border-farm-border-color p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-farm-muted flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-farm-green" />
                Harvest Estimation
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-farm-green-light text-farm-green flex-shrink-0">
                {currentFarm.yield.harvestWindow}
              </span>
            </div>
            <div>
              <p className="text-xs text-farm-muted">Expected Value</p>
              <p className="text-2xl font-extrabold text-farm-dark">
                ₹{currentFarm.yield.totalEstimatedValue.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-farm-border-color text-xs">
              <div>
                <p className="text-farm-muted">Estimated Yield</p>
                <p className="font-bold text-farm-dark">{currentFarm.yield.estimatedQuintals} Quintals</p>
              </div>
              <div className="text-right">
                <p className="text-farm-muted">Target Mandi Rate</p>
                <p className="font-bold text-farm-dark">₹{currentFarm.yield.expectedPricePerQtl.toLocaleString("en-IN")}/Qtl</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mandi Price Pulse & Agri News ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-farm-dark flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-farm-green" />
              Mandi Price Pulse & Agri News
            </h2>
            <span className="text-xs text-farm-muted">Prices from Agmarknet · news items are samples</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MarketPriceCard farmId={currentFarm?.id} />

            <div className="bg-white rounded-2xl border border-farm-border-color p-4 shadow-xs hover:shadow-card transition-all">
              <span className="text-[10px] uppercase font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                Wheat Procurement
              </span>
              <span className="ml-1.5 text-[10px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Sample
              </span>
              <h3 className="font-bold text-xs text-farm-dark mt-2">
                Central Wheat MSP set at ₹2,275/Qtl for 2026 rabi season
              </h3>
              <p className="text-[11px] text-farm-muted mt-1 leading-relaxed">
                Govt procurement centres set to open in October. Register land records on state portal.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-farm-border-color p-4 shadow-xs hover:shadow-card transition-all">
              <span className="text-[10px] uppercase font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                Soil Scheme
              </span>
              <span className="ml-1.5 text-[10px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Sample
              </span>
              <h3 className="font-bold text-xs text-farm-dark mt-2">
                Free Soil Health Card testing drive active in Maharashtra talukas
              </h3>
              <p className="text-[11px] text-farm-muted mt-1 leading-relaxed">
                Village agriculture assistants collecting soil samples for micronutrient and organic carbon tests.
              </p>
            </div>
          </div>
        </div>

        {/* ── 7-Day Weather Forecast & Details (farmwise location) ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-farm-dark flex items-center gap-2">
            <CloudSun className="w-4 h-4 text-sky-600" />
            7-Day Weather Forecast — {currentFarm.name}
          </h2>

          {isRealFarm && weatherLoading ? (
            <div className="bg-white rounded-2xl border border-farm-border-color p-6 flex items-center justify-center gap-2 text-sm text-farm-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading forecast…
            </div>
          ) : isRealFarm && weatherError ? (
            <div className="bg-white rounded-2xl border border-farm-border-color p-6 text-sm text-red-700 text-center">
              Couldn&apos;t load the forecast.{" "}
              <button onClick={() => retryWeather()} className="font-semibold underline">
                Retry
              </button>
            </div>
          ) : (
            currentWeather && (
              <FarmWeatherReport
                farmName={currentFarm.name}
                location={currentFarm.address}
                crop={currentFarm.crop}
                weather={{ ...currentWeather, forecast10Days: currentWeather.forecast10Days.slice(0, 7) }}
                isLive={isRealFarm && !!liveWeather}
                fetchedAt={liveWeather?.provenance.fetched_at ?? null}
              />
            )
          )}
        </div>
      </div>
    </AppLayout>
  );
}
