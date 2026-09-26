"use client";

// ==============================================================================
// 🛰️ SATELLITE ANALYSIS VIEW COMPONENT
// ==============================================================================
// Route URL: /satellite
// App Router Entry: src/app/satellite/page.tsx
// Features:
// - Multispectral layer toggling: NDVI (Vegetation), NDWI (Water), True Color, Stress Zones
// - Quantitative NDVI statistics (Mean, Min, Max, % Canopy Health Distribution)
// - NDVI Historical Trend Graph + Canopy Health Distribution donut
// - Field Stress-Zone diagnostic report
// - Real Sentinel-2 data for real farms (useFarmSatelliteAnalysis), demo data for guests
// ==============================================================================

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import MapView from "@/components/map/MapView";
import { useFarmStore, applyLiveSatellite } from "@/lib/stores/farmStore";
import { useFarmSatelliteAnalysis } from "@/lib/hooks/useFarmSatelliteAnalysis";
import { useFarmSatelliteLayers } from "@/lib/hooks/useFarmSatelliteLayers";
import SatelliteAnalyticsPanel, { SatelliteMapLayer } from "@/components/satellite/SatelliteAnalyticsPanel";
import {
  MapPin, Satellite, Droplets, Camera, AlertTriangle,
  ChevronLeft, ChevronDown, Plus, RefreshCw, BadgeCheck, Loader2, Calendar
} from "lucide-react";

const TILE_KEY_BY_LAYER: Record<SatelliteMapLayer, "true_color" | "ndvi" | "ndwi" | "stress"> = {
  rgb: "true_color",
  ndvi: "ndvi",
  ndwi: "ndwi",
  stress: "stress",
};

const LAYERS: { key: SatelliteMapLayer; label: string; icon: typeof Satellite }[] = [
  { key: "ndvi", label: "NDVI (Vegetation)", icon: Satellite },
  { key: "ndwi", label: "NDWI (Water)", icon: Droplets },
  { key: "rgb", label: "True Color", icon: Camera },
  { key: "stress", label: "Stress Zones", icon: AlertTriangle },
];

const LAYER_CAPTIONS: Record<SatelliteMapLayer, string> = {
  ndvi: "Green areas indicate healthy vegetation. Red areas may indicate stress or poor crop growth.",
  ndwi: "Blue/dark areas indicate higher canopy moisture. Pale areas may indicate water stress.",
  rgb: "High-resolution natural optical view of the field, as seen by the satellite sensor.",
  stress: "Automated classification of the field into healthy, moderate, and stressed vegetation zones.",
};

// ── Satellite View Inner with Search Params ───────────────────────────────────

function SatelliteContent() {
  const router = useRouter();
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

  const {
    layers,
    isLoading: layersLoading,
  } = useFarmSatelliteLayers(selectedFarm?.id, observation?.provenance.as_of);

  // Until the real (per-account) farm list has loaded client-side, `farms`
  // is still the SSR-safe placeholder — render nothing rather than flash it.
  if (!mounted) {
    return null;
  }

  if (!selectedFarm) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
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

  const activeLayerMeta = LAYERS.find((l) => l.key === activeLayer)!;
  const imagedDate = observation ? observation.provenance.as_of : displaySatellite.metadata.acquisitionDate;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-9 h-9 rounded-xl border border-farm-border-color bg-white flex items-center justify-center hover:border-farm-green text-farm-muted hover:text-farm-green transition-all flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-farm-dark flex items-center gap-2">
              <Satellite className="w-6 h-6 text-farm-green" />
              Satellite Analysis
            </h1>
            <p className="text-farm-muted text-xs sm:text-sm mt-0.5">
              Analyze crop health using multi-spectral satellite data (Sentinel-2)
            </p>
          </div>
        </div>

        {/* Farm Selector */}
        <div className="relative self-start sm:self-auto flex-shrink-0">
          <select
            aria-label="Select farm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
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

      {/* ── Layer Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {LAYERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveLayer(key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
              activeLayer === key
                ? "bg-farm-green text-white border-farm-green shadow-xs"
                : "bg-white text-farm-muted border-farm-border-color hover:border-farm-green hover:text-farm-green"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Map Card with Overlay Badges ── */}
      <div className="relative rounded-3xl overflow-hidden border border-farm-border-color shadow-card bg-white">
        <MapView
          height="440px"
          flyToCenter={selectedFarm.center}
          showDrawControls={false}
          rasterTileUrl={layers?.layers[TILE_KEY_BY_LAYER[activeLayer]] ?? null}
          stressZones={
            activeLayer === "stress"
              ? layers?.stress_zones.map((zone) => ({
                  id: zone.id,
                  type: zone.zone_type,
                  areaHa: zone.area_ha,
                  geometry: zone.geometry_geojson,
                  action: zone.suggested_action,
                }))
              : undefined
          }
        />

        {/* Live raster layer loading indicator */}
        {isRealFarm && layersLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/85 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading satellite imagery…
          </div>
        )}

        {/* Location badge (top-left) */}
        <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl px-3.5 py-2 shadow-md flex items-center gap-2 max-w-[75%]">
          <MapPin className="w-4 h-4 text-farm-green flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-farm-dark truncate">{selectedFarm.name}</p>
            <p className="text-[10px] text-farm-muted truncate">
              {selectedFarm.areaAcres} acres · {selectedFarm.district}, {selectedFarm.state}
            </p>
          </div>
        </div>

        {/* Date badge (top-right) */}
        <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-md flex items-center gap-1.5 text-xs font-semibold text-farm-dark">
          <Calendar className="w-3.5 h-3.5 text-farm-green flex-shrink-0" />
          Sentinel-2 · {imagedDate}
        </div>

        {/* Legend (bottom-right) */}
        {activeLayer !== "rgb" && (
          <div className="absolute bottom-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-md space-y-1.5 text-[11px] font-semibold text-farm-dark">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" /> Healthy
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" /> Moderate
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" /> Stressed
            </div>
            {activeLayer === "stress" && layers && layers.stress_zones.length > 0 && (
              <>
                <div className="border-t border-farm-border-color my-1 pt-1.5 text-[10px] text-farm-muted font-bold uppercase tracking-wide">
                  Zone outlines
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 flex-shrink-0" /> Water Stress
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0" /> Nutrient/Pest
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Real stress-zone count + click hint (only when there's something to click) */}
      {activeLayer === "stress" && layers && layers.stress_zones.length > 0 && (
        <p className="text-xs text-farm-muted px-1 -mt-2">
          {layers.stress_zones.length} stress {layers.stress_zones.length === 1 ? "zone" : "zones"} detected
          from live Sentinel-2 data — click an outlined area on the map for details.
        </p>
      )}

      {/* ── Caption line ── */}
      <div className="flex items-start gap-2 px-1">
        <span className="w-2 h-2 rounded-full bg-farm-green mt-1.5 flex-shrink-0" />
        <p className="text-xs text-farm-muted leading-relaxed">
          <strong className="text-farm-dark">
            {activeLayerMeta.label} Index (Mean: {activeLayer === "ndwi" ? displaySatellite.ndwi.toFixed(2) : displaySatellite.meanNdvi.toFixed(2)})
          </strong>{" "}
          {LAYER_CAPTIONS[activeLayer]}
        </p>
      </div>

      {/* ── Live Sentinel-2 Status Banner (real farms only) ── */}
      {isRealFarm && (
        <div
          className={`rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            observation ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
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
      {refreshError && <p className="text-xs text-red-600">{refreshError}</p>}

      {/* ── Comprehensive Satellite Analytics Panel ── */}
      <SatelliteAnalyticsPanel
        crop={selectedFarm.crop}
        areaAcres={selectedFarm.areaAcres}
        satellite={displaySatellite}
        isLive={!!observation}
      />
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
