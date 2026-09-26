"use client";

// ==============================================================================
// 🛰️ SATELLITE REMOTE SENSING & CROP HEALTH VIEW COMPONENT
// ==============================================================================
// Route URL: /satellite
// App Router Entry: src/app/satellite/page.tsx
// Features:
// - Multispectral layer toggling: True-Color RGB, NDVI (Vigour), NDWI (Water), Stress
// - Quantitative NDVI statistics (Mean, Min, Max, % Canopy Health Distribution)
// - NDVI Historical Trend Graph (Time-series progression curve vs optimal benchmark)
// - Field Stress-Zone diagnostic report
// - Satellite Sensor & Data-Quality Indicator (Sentinel-2, cloud %, 10m resolution)
// - Strictly synced with the 2 canonical farms from farmStore
// ==============================================================================

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import MapView from "@/components/map/MapView";
import { useFarmStore, Farm, applyLiveSatellite } from "@/lib/stores/farmStore";
import { useFarmSatelliteAnalysis } from "@/lib/hooks/useFarmSatelliteAnalysis";
import SatelliteAnalyticsPanel, { SatelliteMapLayer } from "@/components/satellite/SatelliteAnalyticsPanel";
import {
  MapPin, Leaf, Calendar, Droplets, Satellite, AlertTriangle,
  ChevronRight, Plus, RefreshCw, BadgeCheck, Loader2
} from "lucide-react";

// ── Left Panel Farm Card ──────────────────────────────────────────────────────

function FarmCard({
  farm,
  selected,
  onSelect,
}: {
  farm: Farm;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden ${
        selected
          ? "border-farm-green shadow-card ring-2 ring-farm-green/20"
          : "border-farm-border-color hover:shadow-card hover:border-farm-green-mid"
      }`}
    >
      <div className="bg-gradient-to-br from-farm-green to-farm-green-dark p-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/20 text-white inline-block mb-1">
              {farm.crop}
            </span>
            <h3 className="font-bold text-white text-base">{farm.name}</h3>
            <p className="text-white/70 text-xs flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {farm.address}
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white/15 text-white border border-white/20">
            NDVI {farm.satellite.meanNdvi.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-3 text-xs text-white/80">
          <span className="flex items-center gap-1">
            <Leaf className="w-3 h-3" /> {farm.areaAcres} acres
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Planted {farm.plantingDate}
          </span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-3 gap-2 bg-white text-center">
        <div>
          <p className="text-xs font-bold text-emerald-700">{farm.satellite.healthyCanopyPercent}%</p>
          <p className="text-[11px] text-farm-muted">Healthy</p>
        </div>
        <div>
          <p className="text-xs font-bold text-sky-700">+{farm.satellite.ndwi.toFixed(2)}</p>
          <p className="text-[11px] text-farm-muted">NDWI Moisture</p>
        </div>
        <div className="flex items-center justify-center">
          <span className="text-xs text-farm-green font-medium flex items-center gap-0.5">
            Select <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Satellite View Inner with Search Params ───────────────────────────────────

function SatelliteContent() {
  const searchParams = useSearchParams();
  const farmParam = searchParams.get("farm");
  const { farms, mounted } = useFarmStore();

  const [selectedId, setSelectedId] = useState<string>(farms[0]?.id || "farm-1");
  const [activeLayer, setActiveLayer] = useState<SatelliteMapLayer>("ndvi");

  useEffect(() => {
    if (farmParam && farms.some((f) => f.id === farmParam)) {
      setSelectedId(farmParam);
    }
  }, [farmParam, farms]);

  const selectedFarm = farms.find((f) => f.id === selectedId) || farms[0];

  const {
    isRealFarm,
    observation,
    isLoading: satelliteLoading,
    isRefreshing,
    refreshError,
    refresh: refreshSatellite,
  } = useFarmSatelliteAnalysis(selectedFarm?.id);

  // Until the real (per-account) farm list has loaded client-side, `farms`
  // is still the SSR-safe placeholder — render nothing rather than flash it.
  if (!mounted) {
    return null;
  }

  if (!selectedFarm) {
    return (
      <div className="max-w-6xl mx-auto text-center py-16">
        <Satellite className="w-10 h-10 text-farm-muted mx-auto mb-3" />
        <p className="text-farm-dark font-semibold mb-1">No farms yet</p>
        <p className="text-farm-muted text-sm mb-5">Add your first farm to see satellite analysis.</p>
        <Link
          href="/farms"
          className="inline-flex items-center gap-2 bg-farm-green text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-farm-green-dark transition-colors"
        >
          <Plus className="w-4 h-4" /> Add a Farm
        </Link>
      </div>
    );
  }

  const displaySatellite = observation
    ? applyLiveSatellite(selectedFarm.satellite, observation)
    : selectedFarm.satellite;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-farm-dark flex items-center gap-2.5">
            <Satellite className="w-7 h-7 text-farm-green" />
            Satellite Remote Sensing Analysis
          </h1>
          <p className="text-farm-muted text-sm mt-0.5">
            Multispectral NDVI vegetation index, canopy moisture (NDWI), and field stress detection
          </p>
        </div>

        <Link
          href="/farms"
          className="self-start sm:self-auto px-4 py-2 border border-farm-border-color hover:border-farm-green text-xs font-semibold rounded-xl text-farm-dark hover:text-farm-green bg-white shadow-xs transition-all flex items-center gap-1.5"
        >
          <MapPin className="w-3.5 h-3.5 text-farm-green" />
          View All Farms ({farms.length})
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left Column: Farm Selector ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between text-xs text-farm-muted font-bold uppercase tracking-wider px-1">
            <span>Select Farm to Analyze</span>
            <span>{farms.length} Registered</span>
          </div>

          {farms.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              selected={farm.id === selectedId}
              onSelect={() => setSelectedId(farm.id)}
            />
          ))}

          {/* Link to Register Farm */}
          <Link
            href="/farms"
            className="w-full min-h-[70px] rounded-2xl border-2 border-dashed border-farm-border-color hover:border-farm-green hover:bg-farm-green-light/40 transition-all group flex items-center justify-center gap-2 text-farm-muted hover:text-farm-green"
          >
            <Plus className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
            <span className="text-xs font-semibold">Register Another Farm in My Farms</span>
          </Link>
        </div>

        {/* ── Right Column: Interactive Satellite Map & Deep Analytics ── */}
        <div className="lg:col-span-3 space-y-6">
          {selectedFarm ? (
            <>
              {/* Interactive Satellite Map Card */}
              <div className="rounded-2xl overflow-hidden border border-farm-border-color shadow-card bg-white">
                <div className="bg-farm-dark px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white text-xs font-semibold">
                      {selectedFarm.name} — {activeLayer.toUpperCase()} Multispectral Layer
                    </span>
                  </div>
                  <span className="text-white/60 text-xs">{selectedFarm.district}, {selectedFarm.state}</span>
                </div>

                <div className="relative">
                  <MapView
                    height="460px"
                    flyToCenter={selectedFarm.center}
                    showDrawControls={false}
                  />

                  {/* Active Layer Visual Banner Overlay */}
                  <div className="absolute top-3 left-3 z-10 bg-slate-900/85 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/20 text-xs font-semibold flex items-center gap-2 shadow-lg">
                    {activeLayer === "rgb" && (
                      <>
                        <Satellite className="w-3.5 h-3.5 text-slate-300" />
                        <span>RGB Natural Satellite View</span>
                      </>
                    )}
                    {activeLayer === "ndvi" && (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-300 font-bold">NDVI Vegetation Vigour (Mean: {displaySatellite.meanNdvi.toFixed(2)})</span>
                      </>
                    )}
                    {activeLayer === "ndwi" && (
                      <>
                        <Droplets className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-sky-300 font-bold">NDWI Canopy Moisture (Index: +{displaySatellite.ndwi.toFixed(2)})</span>
                      </>
                    )}
                    {activeLayer === "stress" && (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-300 font-bold">Stress Zones ({displaySatellite.stressZones.length} Detected)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Live Sentinel-2 Status Banner (real farms only) ── */}
              {isRealFarm && (
                <div
                  className={`rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    observation
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-xs">
                    {satelliteLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 text-farm-muted animate-spin" />
                        <span className="text-farm-muted font-medium">Checking for a live Sentinel-2 analysis…</span>
                      </>
                    ) : observation ? (
                      <>
                        <BadgeCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                        <span className="text-emerald-900">
                          <strong>Live Sentinel-2 data</strong> · {observation.satellite} · imaged{" "}
                          {observation.provenance.as_of} · {observation.cloud_pct.toFixed(0)}% cloud
                          {observation.is_fallback && " (best available — no clear scene this window)"}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span className="text-amber-900">
                          No live analysis yet for this farm — showing demo values until one runs.
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={refreshSatellite}
                    disabled={isRefreshing}
                    className="self-start sm:self-auto px-3 py-1.5 bg-white border border-farm-border-color hover:border-farm-green text-xs font-semibold rounded-lg text-farm-dark hover:text-farm-green transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                    {isRefreshing ? "Running analysis…" : observation ? "Refresh from Sentinel-2" : "Run Sentinel-2 Analysis"}
                  </button>
                </div>
              )}
              {refreshError && (
                <p className="text-xs text-red-600 -mt-3">{refreshError}</p>
              )}

              {/* ── Comprehensive Satellite Analytics Panel ── */}
              <SatelliteAnalyticsPanel
                farmName={selectedFarm.name}
                crop={selectedFarm.crop}
                areaAcres={selectedFarm.areaAcres}
                satellite={displaySatellite}
                activeLayer={activeLayer}
                onLayerChange={setActiveLayer}
                isLive={!!observation}
              />
            </>
          ) : (
            <div className="h-96 rounded-2xl border-2 border-dashed border-farm-border-color flex items-center justify-center text-farm-muted text-sm">
              Select a farm on the left to inspect its satellite imagery
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SatellitePage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-8 text-center text-farm-muted">Loading satellite analysis...</div>}>
        <SatelliteContent />
      </Suspense>
    </AppLayout>
  );
}
