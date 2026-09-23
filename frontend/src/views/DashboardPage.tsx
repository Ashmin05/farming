"use client";

// ==============================================================================
// 📊 MINIMAL & AESTHETIC FARMER DASHBOARD
// ==============================================================================
// Route URL: /dashboard
// Design Principles:
// 1. Sleek, minimal aesthetic — no clutter, clear visual hierarchy.
// 2. Farm Selector Dropdown at top to switch context dynamically.
// 3. "What's Happening Now": Quick essential overview of the selected farm.
//    (Deep satellite details live on /satellite).
// 4. Actionable Suggestions, Agri News & Market Trends, and Smart Tools.
// 5. Harvest Yield & Valuation placed neatly at the bottom.
// ==============================================================================

import { useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { useFarmStore, useUserStore } from "@/lib/stores/farmStore";
import {
  Satellite, Droplets, TrendingUp, AlertTriangle,
  ShieldCheck, Thermometer, Calendar, CheckCircle2,
  ChevronRight, ChevronDown, Sparkles, Brain, Newspaper, Wrench,
  Calculator, Sprout, Leaf
} from "lucide-react";

export default function DashboardPage() {
  const { farms } = useFarmStore();
  const { profile } = useUserStore();
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farms[0]?.id || "farm-1");

  // Calculator modal state
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcAcreage, setCalcAcreage] = useState<number>(3);
  const [calcCrop, setCalcCrop] = useState<string>("Onion");

  const currentFarm = farms.find((f) => f.id === selectedFarmId) || farms[0];

  if (!currentFarm) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-farm-muted">No farms found. Register your first farm in My Farms.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-16">
        {/* ── Top Bar: Greeting & Sleek Farm Selector Dropdown ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs uppercase font-bold tracking-wider text-farm-green">
                Farm Intelligence Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-farm-dark tracking-tight mt-1">
              Namaste, {profile.name && profile.name !== "Farmer" ? profile.name : "Kisan"} 👋
            </h1>
            <p className="text-farm-muted text-xs sm:text-sm mt-0.5">
              Live farm status, tailored crop suggestions, tools & mandi trends.
            </p>
          </div>

          {/* Farm Selector Dropbox */}
          <div className="self-start sm:self-auto flex items-center gap-2">
            <span className="text-xs font-semibold text-farm-muted hidden sm:inline">Active Farm:</span>
            <div className="relative">
              <select
                aria-label="Select Active Farm"
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="appearance-none bg-white border-2 border-farm-green/70 hover:border-farm-green text-farm-dark font-bold text-xs sm:text-sm pl-4 pr-10 py-2.5 rounded-2xl shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-farm-green/20 transition-all"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    🌿 {f.name} ({f.crop} · {f.district})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-farm-green absolute right-3.5 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Section 1: What is Happening Right Now (Selected Farm Snapshot) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-farm-green" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-farm-dark">
                What&apos;s Happening Now on {currentFarm.name}
              </h2>
            </div>
            <span className="text-xs text-farm-muted">
              {currentFarm.areaAcres} Acres · Planted {currentFarm.plantingDate}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status 1: Canopy Vigour */}
            <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-farm-muted">Crop Canopy Vigour</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Leaf className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-farm-dark">
                  NDVI {currentFarm.satellite.meanNdvi.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {currentFarm.satellite.canopyVigourLabel}
                </span>
              </div>
              <p className="text-xs text-farm-muted mt-2">
                {currentFarm.satellite.healthyCanopyPercent}% healthy vegetative cover
              </p>
            </div>

            {/* Status 2: Soil Health */}
            <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-farm-muted">Soil Condition</span>
                <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-farm-dark">
                  pH {currentFarm.soil.ph}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {currentFarm.soil.healthRating}
                </span>
              </div>
              <p className="text-xs text-farm-muted mt-2">
                N: {currentFarm.soil.nitrogen} · P: {currentFarm.soil.phosphorus} · K: {currentFarm.soil.potassium}
              </p>
            </div>

            {/* Status 3: Water Status */}
            <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-farm-muted">Canopy Moisture</span>
                <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Droplets className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-farm-dark">
                  {currentFarm.water.soilMoisturePercent}%
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  currentFarm.water.status === "Optimal"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-red-100 text-red-800"
                }`}>
                  {currentFarm.water.status}
                </span>
              </div>
              <p className="text-xs text-farm-muted mt-2 truncate" title={currentFarm.water.nextRecommendedAction}>
                Last watered: {currentFarm.water.lastIrrigationDaysAgo}d ago
              </p>
            </div>

            {/* Status 4: Today's Weather */}
            <div className="bg-white rounded-2xl border border-farm-border-color p-4.5 shadow-xs hover:border-farm-green transition-all group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-farm-muted">Field Weather</span>
                <span className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Thermometer className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-farm-dark">
                  {currentFarm.weather.currentTemp}°C
                </span>
                <span className="text-xs text-farm-muted font-medium">
                  {currentFarm.weather.condition}
                </span>
              </div>
              <p className="text-xs text-farm-muted mt-2 flex items-center gap-2">
                <span>💧 {currentFarm.weather.humidity}%</span>
                <span>💨 {currentFarm.weather.windKmh} km/h</span>
              </p>
            </div>
          </div>

          {/* Deep Satellite Callout Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-farm-green/10 via-emerald-50 to-sky-50 border border-farm-green/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-farm-green text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Satellite className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-farm-dark">
                  Need detailed NDVI vegetation maps, NDWI moisture layers, or stress-zone diagnosis?
                </p>
                <p className="text-[11px] text-farm-muted">
                  Full Sentinel-2 multispectral analytics are available in the Satellite section.
                </p>
              </div>
            </div>
            <Link
              href={`/satellite?farm=${currentFarm.id}`}
              className="px-4 py-2 bg-farm-green hover:bg-farm-green-dark text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 flex-shrink-0"
            >
              <span>Open Satellite Intelligence</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* ── Section 2: Actionable Field Suggestions & Active Alerts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-farm-dark flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-farm-green" />
              Smart Suggestions for {currentFarm.name} ({currentFarm.crop})
            </h2>

            <div className="space-y-3">
              {/* Dynamic suggestion 1: Agronomic Advice */}
              <div className="p-4 rounded-2xl bg-white border border-farm-border-color shadow-xs hover:border-farm-green/60 transition-all flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-farm-green flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sprout className="w-4 h-4" />
                </span>
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-farm-dark">
                    Crop Stage Guidance: {currentFarm.crop} ({currentFarm.variety})
                  </h3>
                  <p className="text-xs text-farm-muted leading-relaxed mt-1">
                    {currentFarm.water.nextRecommendedAction} Foliar nutrient absorption is currently optimal under {currentFarm.weather.currentTemp}°C temperature conditions.
                  </p>
                </div>
              </div>

              {/* Dynamic suggestion 2: Weather & Alerts */}
              {currentFarm.weather.alerts && currentFarm.weather.alerts.length > 0 ? (
                currentFarm.weather.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-xs flex items-start gap-3"
                  >
                    <span className="w-8 h-8 rounded-xl bg-amber-200/70 text-amber-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-amber-950">{alert.headline}</h3>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-amber-900 font-medium leading-relaxed mt-1">
                        💡 <strong>Action:</strong> {alert.actionAdvice}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-2xl bg-white border border-farm-border-color shadow-xs flex items-start gap-3">
                  <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-farm-dark">No Severe Weather Disruption Forecast</h3>
                    <p className="text-xs text-farm-muted mt-0.5">
                      Clear conditions prevailing over {currentFarm.district}. Routine farm activities can proceed normally.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Tools Box */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-farm-dark flex items-center gap-2">
              <Wrench className="w-4 h-4 text-farm-green" />
              Smart Farming Tools
            </h2>

            <div className="bg-white rounded-2xl border border-farm-border-color p-4 shadow-xs space-y-2.5">
              <button
                type="button"
                onClick={() => setCalcOpen(!calcOpen)}
                className="w-full text-left p-3 rounded-xl border border-farm-border-color hover:border-farm-green hover:bg-farm-green-light/40 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-farm-green flex items-center justify-center">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-farm-dark group-hover:text-farm-green">
                      Fertilizer & NPK Dosage
                    </p>
                    <p className="text-[11px] text-farm-muted">Acreage calculator</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-farm-muted group-hover:text-farm-green" />
              </button>

              <Link
                href="/ai-chat"
                className="block p-3 rounded-xl border border-farm-border-color hover:border-purple-400 hover:bg-purple-50/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-farm-dark group-hover:text-purple-700">
                        Ask KrishiBot AI
                      </p>
                      <p className="text-[11px] text-farm-muted">Pest & crop diagnostics</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-farm-muted group-hover:text-purple-600" />
                </div>
              </Link>

              <Link
                href={`/satellite?farm=${currentFarm.id}`}
                className="block p-3 rounded-xl border border-farm-border-color hover:border-farm-green hover:bg-farm-green-light/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Satellite className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-farm-dark group-hover:text-farm-green">
                        NDVI Multispectral Map
                      </p>
                      <p className="text-[11px] text-farm-muted">Satellite scan</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-farm-muted group-hover:text-farm-green" />
                </div>
              </Link>
            </div>

            {/* Quick Interactive Fertilizer Calculator Widget */}
            {calcOpen && (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 animate-in fade-in space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-farm-dark">Quick Fertilizer Dosage</span>
                  <button onClick={() => setCalcOpen(false)} className="text-xs text-farm-muted hover:text-farm-dark">✕</button>
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

        {/* ── Section 3: Agricultural News & Live Mandi Price Trends ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-farm-dark flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-farm-green" />
              Live Mandi Price Pulse & Agri News
            </h2>
            <span className="text-xs text-farm-muted">Updated today from APMC records</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* News 1 */}
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

            {/* News 2 */}
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

            {/* News 3 */}
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

        {/* ── Section 4: Harvest Yield & Revenue Estimation (PLACED AT THE LAST AS REQUESTED) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-farm-dark flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-farm-green" />
              Harvest Yield & Revenue Estimation ({currentFarm.name})
            </h2>
            <span className="text-xs text-farm-muted">Target Valuation</span>
          </div>

          <div className="bg-gradient-to-br from-white via-white to-amber-50/50 rounded-2xl border border-amber-200/80 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-farm-border-color">
              <div>
                <span className="text-xs text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-md">
                  {currentFarm.crop} · {currentFarm.variety}
                </span>
                <h3 className="text-lg font-bold text-farm-dark mt-1">
                  Expected Harvest Valuation: ₹{currentFarm.yield.totalEstimatedValue.toLocaleString("en-IN")}
                </h3>
                <p className="text-xs text-farm-muted mt-0.5">
                  Calculated based on {currentFarm.areaAcres} acres using regional productivity benchmarks
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-farm-muted">Est. Total Yield</p>
                  <p className="text-lg font-extrabold text-farm-dark">
                    {currentFarm.yield.estimatedQuintals} <span className="text-xs font-normal">Quintals</span>
                  </p>
                </div>
                <div className="text-right border-l border-farm-border-color pl-6">
                  <p className="text-xs text-farm-muted">Target Mandi Rate</p>
                  <p className="text-lg font-extrabold text-emerald-700">
                    ₹{currentFarm.yield.expectedPricePerQtl.toLocaleString("en-IN")}<span className="text-xs font-normal text-farm-muted">/Qtl</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-amber-600" />
                Target Harvest Window: <strong>{currentFarm.yield.harvestWindow}</strong>
              </span>
              <span className="font-semibold text-emerald-700">
                Performance: {currentFarm.yield.historicalYieldComparison}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
