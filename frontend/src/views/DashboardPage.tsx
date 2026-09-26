"use client";

// ==============================================================================
// 📊 FARMER DASHBOARD
// ==============================================================================
// Route URL: /dashboard
// Design Principles:
// 1. Greeting hero + farm selector up top.
// 2. Four at-a-glance stat cards (NDVI, soil, moisture, weather).
// 3. One-line weather/advisory banner.
// 4. Smart Suggestion + Harvest Estimation side by side.
// 5. Live Mandi Price & Agri News, then Quick Tools.
// ==============================================================================

import { useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { useFarmStore, useUserStore, applyLiveSatellite } from "@/lib/stores/farmStore";
import { useFarmSatelliteAnalysis } from "@/lib/hooks/useFarmSatelliteAnalysis";
import {
  Satellite, Droplets, TrendingUp, AlertTriangle,
  ShieldCheck, Thermometer, CheckCircle2,
  ChevronRight, ChevronDown, Sparkles, Brain, Newspaper,
  Calculator, Sprout, Leaf, BadgeCheck, CloudSun
} from "lucide-react";

function useGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { farms, mounted } = useFarmStore();
  const { profile } = useUserStore();
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farms[0]?.id || "farm-1");
  const greeting = useGreeting();

  // Calculator modal state
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcAcreage, setCalcAcreage] = useState<number>(3);
  const [calcCrop, setCalcCrop] = useState<string>("Onion");

  const currentFarm = farms.find((f) => f.id === selectedFarmId) || farms[0];
  const { observation: satelliteObservation } = useFarmSatelliteAnalysis(currentFarm?.id);
  const currentSatellite = currentFarm && satelliteObservation
    ? applyLiveSatellite(currentFarm.satellite, satelliteObservation)
    : currentFarm?.satellite;

  // Until the real (per-account) farm list has loaded client-side, `farms`
  // is still the SSR-safe placeholder — render an empty shell rather than
  // flash it (keep the sidebar so the layout doesn't jump).
  if (!mounted) {
    return <AppLayout>{null}</AppLayout>;
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
          <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-farm-muted flex items-center gap-1">
                Crop Health (NDVI)
                {satelliteObservation && (
                  <span title="Live Sentinel-2 data">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                  </span>
                )}
              </span>
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Leaf className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-farm-dark">{currentSatellite!.meanNdvi.toFixed(2)}</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                {currentSatellite!.canopyVigourLabel}
              </span>
            </div>
            <p className="text-xs text-farm-muted mt-2">{currentSatellite!.healthyCanopyPercent}% healthy cover</p>
          </div>

          {/* Soil Condition */}
          <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-farm-muted">Soil Condition</span>
              <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-farm-dark">pH {currentFarm.soil.ph}</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                {currentFarm.soil.healthRating}
              </span>
            </div>
            <p className="text-xs text-farm-muted mt-2">
              N: {currentFarm.soil.nitrogen} · P: {currentFarm.soil.phosphorus} · K: {currentFarm.soil.potassium}
            </p>
          </div>

          {/* Canopy Moisture */}
          <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-farm-muted">Canopy Moisture</span>
              <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Droplets className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-farm-dark">{currentFarm.water.soilMoisturePercent}%</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  currentFarm.water.status === "Optimal" ? "bg-sky-100 text-sky-800" : "bg-red-100 text-red-800"
                }`}
              >
                {currentFarm.water.status}
              </span>
            </div>
            <p className="text-xs text-farm-muted mt-2 truncate" title={currentFarm.water.nextRecommendedAction}>
              Last watered: {currentFarm.water.lastIrrigationDaysAgo}d ago
            </p>
          </div>

          {/* Field Weather */}
          <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-farm-muted">Field Weather</span>
              <span className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Thermometer className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-farm-dark">{currentFarm.weather.currentTemp}°C</span>
              <span className="text-xs text-farm-muted font-medium">{currentFarm.weather.condition}</span>
            </div>
            <p className="text-xs text-farm-muted mt-2 flex items-center gap-2">
              <span>💧 {currentFarm.weather.humidity}%</span>
              <span>💨 {currentFarm.weather.windKmh} km/h</span>
            </p>
          </div>
        </div>

        {/* ── Weather/Advisory Banner ── */}
        {primaryAlert ? (
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
                {currentFarm.weather.currentTemp}°C temperature conditions.
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

        {/* ── Live Mandi Price & Agri News ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-farm-dark flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-farm-green" />
              Live Mandi Price Pulse & Agri News
            </h2>
            <span className="text-xs text-farm-muted">Updated today from APMC records</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-farm-border-color p-4 shadow-xs hover:shadow-card transition-all">
              <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Mandi Price Alert
              </span>
              <h3 className="font-bold text-xs text-farm-dark mt-2">
                Nashik Onion Mandi: Model price holds steady at ₹2,400/Qtl
              </h3>
              <p className="text-[11px] text-farm-muted mt-1 leading-relaxed">
                Wholesale arrivals at Lasalgaon APMC average 18,000 quintals daily with sustained export demand.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-farm-border-color p-4 shadow-xs hover:shadow-card transition-all">
              <span className="text-[10px] uppercase font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                Wheat Procurement
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
              <h3 className="font-bold text-xs text-farm-dark mt-2">
                Free Soil Health Card testing drive active in Maharashtra talukas
              </h3>
              <p className="text-[11px] text-farm-muted mt-1 leading-relaxed">
                Village agriculture assistants collecting soil samples for micronutrient and organic carbon tests.
              </p>
            </div>
          </div>
        </div>

        {/* ── Quick Tools ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-farm-dark flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-farm-green" />
            Quick Tools
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              href={`/satellite?farm=${currentFarm.id}`}
              className="bg-white rounded-2xl border border-farm-border-color p-4 hover:border-farm-green hover:shadow-card transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Satellite className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-farm-dark group-hover:text-farm-green">Satellite Analysis</p>
              <p className="text-[11px] text-farm-muted mt-0.5">NDVI · NDWI · Stress</p>
            </Link>

            <button
              type="button"
              onClick={() => setCalcOpen(!calcOpen)}
              className="text-left bg-white rounded-2xl border border-farm-border-color p-4 hover:border-farm-green hover:shadow-card transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Calculator className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-farm-dark group-hover:text-farm-green">Fertilizer & NPK</p>
              <p className="text-[11px] text-farm-muted mt-0.5">Dosage calculator</p>
            </button>

            <Link
              href="/ai-chat"
              className="bg-white rounded-2xl border border-farm-border-color p-4 hover:border-purple-400 hover:shadow-card transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Brain className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-farm-dark group-hover:text-purple-700">KrishiBot AI</p>
              <p className="text-[11px] text-farm-muted mt-0.5">Ask crop questions</p>
            </Link>

            <Link
              href="/weather"
              className="bg-white rounded-2xl border border-farm-border-color p-4 hover:border-sky-400 hover:shadow-card transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <CloudSun className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-farm-dark group-hover:text-sky-700">Weather Forecast</p>
              <p className="text-[11px] text-farm-muted mt-0.5">7 day forecast</p>
            </Link>
          </div>

          {/* Quick Interactive Fertilizer Calculator Widget */}
          {calcOpen && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 animate-in fade-in space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-farm-dark">Quick Fertilizer Dosage</span>
                <button onClick={() => setCalcOpen(false)} className="text-xs text-farm-muted hover:text-farm-dark">
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-farm-muted block mb-0.5">Acreage</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={calcAcreage}
                    onChange={(e) => setCalcAcreage(parseFloat(e.target.value) || 1)}
                    className="w-full px-2 py-1 bg-white border border-farm-border-color rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-farm-muted block mb-0.5">Crop</label>
                  <select
                    value={calcCrop}
                    onChange={(e) => setCalcCrop(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-farm-border-color rounded-lg text-xs"
                  >
                    <option value="Onion">Onion</option>
                    <option value="Wheat">Wheat</option>
                    <option value="Rice">Rice</option>
                    <option value="Sugarcane">Sugarcane</option>
                  </select>
                </div>
              </div>
              <div className="p-2.5 bg-white rounded-xl text-xs space-y-1 border border-emerald-200/60">
                <div className="flex justify-between">
                  <span className="text-farm-muted">Urea (46% N):</span>
                  <strong className="text-farm-dark">{(calcAcreage * 45).toFixed(0)} kg</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-farm-muted">DAP (18:46):</span>
                  <strong className="text-farm-dark">{(calcAcreage * 30).toFixed(0)} kg</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-farm-muted">MOP (Potash):</span>
                  <strong className="text-farm-dark">{(calcAcreage * 25).toFixed(0)} kg</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
