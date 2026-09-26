"use client";

// ==============================================================================
// 🛰️ SATELLITE ANALYTICS PANEL (NDVI, NDWI, STRESS ZONES, HISTORICAL GRAPH & QUALITY)
// ==============================================================================
// Features:
// - Remote Sensing Layer controller (RGB Satellite, NDVI, NDWI, Stress-zones)
// - Current NDVI statistics (Mean, Min, Max, Vigour %, Canopy health distribution)
// - NDVI Historical Trend Graph (Time series tracking crop vegetative progression)
// - Field Stress-Zone diagnostic report
// - Satellite Sensor & Data-Quality Indicator (Sentinel-2, cloud %, 10m resolution)
// ==============================================================================

import { useState } from "react";
import { FarmSatellite } from "@/lib/stores/farmStore";
import {
  Satellite, Layers, Droplets, AlertTriangle, TrendingUp,
  CheckCircle2, Info,
  Activity, Calendar
} from "lucide-react";

export type SatelliteMapLayer = "rgb" | "ndvi" | "ndwi" | "stress";

export default function SatelliteAnalyticsPanel({
  farmName,
  crop,
  areaAcres,
  satellite,
  activeLayer,
  onLayerChange,
  isLive = false,
}: {
  farmName: string;
  crop: string;
  areaAcres: number;
  satellite: FarmSatellite;
  activeLayer: SatelliteMapLayer;
  onLayerChange: (layer: SatelliteMapLayer) => void;
  /** True when `satellite`'s current stats (NDVI/NDWI/canopy %/metadata) came
   * from a real Sentinel-2 analysis rather than demo data. The historical
   * trend graph and stress zones below stay demo either way — flagged
   * inline so the live badge above doesn't imply those are real too. */
  isLive?: boolean;
}) {
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);

  // SVG dimensions for the historical graph
  const graphWidth = 560;
  const graphHeight = 160;
  const paddingX = 40;
  const paddingY = 24;

  const points = satellite.history;
  const maxNdvi = 1.0;
  const minNdvi = 0.0;

  // Compute SVG coordinates
  const coords = points.map((p, idx) => {
    const x = paddingX + (idx / Math.max(1, points.length - 1)) * (graphWidth - paddingX * 2);
    const y = graphHeight - paddingY - ((p.ndvi - minNdvi) / (maxNdvi - minNdvi)) * (graphHeight - paddingY * 2);
    const benchmarkY = graphHeight - paddingY - ((p.benchmark - minNdvi) / (maxNdvi - minNdvi)) * (graphHeight - paddingY * 2);
    return { x, y, benchmarkY, ...p };
  });

  const ndviPath = coords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x},${curr.y}` : `${acc} L ${curr.x},${curr.y}`;
  }, "");

  const benchmarkPath = coords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x},${curr.benchmarkY}` : `${acc} L ${curr.x},${curr.benchmarkY}`;
  }, "");

  const activePoint = selectedPointIdx !== null ? coords[selectedPointIdx] : coords[coords.length - 1];

  return (
    <div className="space-y-6">
      {/* ── Layer Selector Bar ── */}
      <div className="bg-white rounded-2xl border border-farm-border-color p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-farm-muted flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-farm-green" />
              Multispectral Satellite Layer Mode
            </h3>
            <p className="text-xs text-farm-muted mt-0.5">Toggle satellite analysis view for {farmName}</p>
          </div>

          <div className="grid grid-cols-2 sm:flex gap-1.5 bg-farm-gray p-1 rounded-xl border border-farm-border-color">
            <button
              onClick={() => onLayerChange("rgb")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeLayer === "rgb"
                  ? "bg-white text-farm-dark shadow-xs"
                  : "text-farm-muted hover:text-farm-dark"
              }`}
            >
              <Satellite className="w-3.5 h-3.5 text-slate-500" />
              <span>True-Color RGB</span>
            </button>

            <button
              onClick={() => onLayerChange("ndvi")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeLayer === "ndvi"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-farm-muted hover:text-emerald-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>NDVI (Vigour)</span>
            </button>

            <button
              onClick={() => onLayerChange("ndwi")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeLayer === "ndwi"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-farm-muted hover:text-sky-700"
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>NDWI (Water)</span>
            </button>

            <button
              onClick={() => onLayerChange("stress")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeLayer === "stress"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-farm-muted hover:text-amber-700"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Stress Zones</span>
            </button>
          </div>
        </div>

        {/* Legend for currently active layer */}
        <div className="mt-3 pt-3 border-t border-farm-border-color/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-farm-dark">Colormap Legend:</span>
            {activeLayer === "ndvi" && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-red-600 font-bold">Bare/Dead (0.1)</span>
                <div className="w-28 h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 via-lime-400 to-emerald-700 border border-slate-200" />
                <span className="text-[10px] text-emerald-800 font-bold">Dense Biomass (0.9)</span>
              </div>
            )}
            {activeLayer === "ndwi" && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-amber-600 font-bold">Water Stressed (-0.2)</span>
                <div className="w-28 h-3 rounded-full bg-gradient-to-r from-amber-400 via-sky-300 via-blue-500 to-indigo-700 border border-slate-200" />
                <span className="text-[10px] text-blue-900 font-bold">High Moisture (+0.7)</span>
              </div>
            )}
            {activeLayer === "stress" && (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Severe Stress
                </span>
                <span className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Moderate Attention
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Healthy Crop
                </span>
              </div>
            )}
            {activeLayer === "rgb" && (
              <span className="text-farm-muted">High-resolution natural optical spectrum</span>
            )}
          </div>

          <div className="text-[11px] text-farm-muted flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-farm-green" />
            <span>Updated with every Sentinel satellite pass</span>
          </div>
        </div>
      </div>

      {/* ── Satellite Data-Quality & Sensor Indicator ── */}
      <div className="bg-gradient-to-r from-slate-900 to-farm-dark text-white rounded-2xl p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
              <Satellite className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{satellite.metadata.satelliteMission}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    satellite.metadata.dataQualityConfidence >= 80
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : satellite.metadata.dataQualityConfidence >= 40
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-red-500/20 text-red-300 border-red-500/40"
                  }`}
                >
                  {satellite.metadata.dataQualityConfidence}%{" "}
                  {satellite.metadata.dataQualityConfidence >= 80
                    ? "High Quality"
                    : satellite.metadata.dataQualityConfidence >= 40
                      ? "Moderate Quality"
                      : "Low Quality (Cloudy)"}
                </span>
              </div>
              <p className="text-xs text-white/70 mt-0.5">
                Acquired: <strong>{satellite.metadata.acquisitionDate}</strong> · Spatial GSD: {satellite.metadata.spatialResolution}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <p className="text-[10px] text-white/60">Cloud Cover</p>
              <p
                className={`font-bold ${
                  satellite.metadata.cloudCoveragePercent < 20
                    ? "text-emerald-400"
                    : satellite.metadata.cloudCoveragePercent < 60
                      ? "text-amber-400"
                      : "text-red-400"
                }`}
              >
                {satellite.metadata.cloudCoveragePercent}%{" "}
                {satellite.metadata.cloudCoveragePercent < 20
                  ? "(Clear Sky)"
                  : satellite.metadata.cloudCoveragePercent < 60
                    ? "(Partly Cloudy)"
                    : "(Heavy Cloud)"}
              </p>
            </div>
            <div className="text-right border-l border-white/10 pl-4">
              <p className="text-[10px] text-white/60">Solar Elevation</p>
              <p className="font-bold text-white">{satellite.metadata.sunElevationAngle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Current NDVI Statistics Breakdown ── */}
      <div className="bg-white rounded-2xl border border-farm-border-color p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-farm-dark text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-farm-green" />
              Current NDVI & Canopy Statistics
            </h3>
            <p className="text-xs text-farm-muted">Quantitative remote sensing metrics calculated across {areaAcres} acres</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
            Vigour: {satellite.canopyVigourLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="p-3 bg-farm-gray rounded-xl text-center">
            <p className="text-xs text-farm-muted">Mean NDVI</p>
            <p className="text-xl font-bold text-farm-dark">{satellite.meanNdvi.toFixed(2)}</p>
            <span className="text-[10px] text-emerald-600 font-semibold">Active canopy</span>
          </div>

          <div className="p-3 bg-farm-gray rounded-xl text-center">
            <p className="text-xs text-farm-muted">Min NDVI</p>
            <p className="text-xl font-bold text-farm-dark">{satellite.minNdvi.toFixed(2)}</p>
            <span className="text-[10px] text-amber-600 font-semibold">Pathways/furrows</span>
          </div>

          <div className="p-3 bg-farm-gray rounded-xl text-center">
            <p className="text-xs text-farm-muted">Max NDVI</p>
            <p className="text-xl font-bold text-farm-dark">{satellite.maxNdvi.toFixed(2)}</p>
            <span className="text-[10px] text-emerald-700 font-semibold">Peak foliar core</span>
          </div>

          <div className="p-3 bg-sky-50 rounded-xl text-center border border-sky-200/60">
            <p className="text-xs text-sky-700">Mean NDWI</p>
            <p className="text-xl font-bold text-sky-900">{satellite.ndwi.toFixed(2)}</p>
            <span className="text-[10px] text-sky-600 font-semibold">Canopy water index</span>
          </div>
        </div>

        {/* Canopy Health Percentage Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-farm-dark">Canopy Health Distribution</span>
            <span className="text-farm-muted">
              {satellite.healthyCanopyPercent}% Healthy · {satellite.moderateCanopyPercent}% Moderate · {satellite.stressedCanopyPercent}% Stressed
            </span>
          </div>
          <div className="h-3 w-full bg-farm-gray rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${satellite.healthyCanopyPercent}%` }}
              title={`Healthy: ${satellite.healthyCanopyPercent}%`}
            />
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${satellite.moderateCanopyPercent}%` }}
              title={`Moderate: ${satellite.moderateCanopyPercent}%`}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${satellite.stressedCanopyPercent}%` }}
              title={`Stressed: ${satellite.stressedCanopyPercent}%`}
            />
          </div>
        </div>
      </div>

      {/* ── Historical NDVI Trend Graph ── */}
      <div className="bg-white rounded-2xl border border-farm-border-color p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-farm-dark text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              NDVI Historical Season Progression Curve
              {isLive && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-farm-gray text-farm-muted normal-case">
                  Demo trend
                </span>
              )}
            </h3>
            <p className="text-xs text-farm-muted">
              Bi-weekly Sentinel passes since sowing vs. regional optimal benchmark curve for {crop}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-farm-dark">
              <span className="w-3 h-1 bg-emerald-600 rounded-full" /> Actual NDVI
            </span>
            <span className="flex items-center gap-1.5 text-farm-muted">
              <span className="w-3 h-1 bg-slate-300 rounded-full stroke-dasharray" /> Optimal Benchmark
            </span>
          </div>
        </div>

        {/* Responsive SVG Graph Container */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[500px]">
            <svg
              viewBox={`0 0 ${graphWidth} ${graphHeight}`}
              className="w-full h-44 overflow-visible"
            >
              {/* Grid lines */}
              {[0.2, 0.4, 0.6, 0.8].map((v) => {
                const y = graphHeight - paddingY - (v / maxNdvi) * (graphHeight - paddingY * 2);
                return (
                  <g key={v}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={graphWidth - paddingX}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingX - 8}
                      y={y + 3}
                      fontSize="9"
                      textAnchor="end"
                      fill="#94a3b8"
                    >
                      {v.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Benchmark dashed curve */}
              <path
                d={benchmarkPath}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* Actual NDVI green curve */}
              <path
                d={ndviPath}
                fill="none"
                stroke="#059669"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Interactive Points */}
              {coords.map((pt, idx) => {
                const isSelected = selectedPointIdx === idx;
                return (
                  <g
                    key={idx}
                    className="cursor-pointer group"
                    onMouseEnter={() => setSelectedPointIdx(idx)}
                    onClick={() => setSelectedPointIdx(idx)}
                  >
                    {/* Invisible larger hit area to ensure stable cursor hover */}
                    <circle cx={pt.x} cy={pt.y} r={16} fill="transparent" />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6 : 4}
                      fill="#ffffff"
                      stroke="#059669"
                      strokeWidth={isSelected ? 3 : 2}
                      className="transition-all"
                    />
                    {/* Date label */}
                    <text
                      x={pt.x}
                      y={graphHeight - 4}
                      fontSize="9"
                      textAnchor="middle"
                      fill={isSelected ? "#059669" : "#64748b"}
                      fontWeight={isSelected ? "700" : "400"}
                      className="transition-colors"
                    >
                      {pt.date}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Selected Data Point Callout */}
        {activePoint && (
          <div className="mt-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>
                <strong>{activePoint.date}</strong> · Crop Stage: <strong>{activePoint.stage}</strong>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>Recorded NDVI: <strong className="text-emerald-800">{activePoint.ndvi.toFixed(2)}</strong></span>
              <span className="text-farm-muted">Target Benchmark: {activePoint.benchmark.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Stress Zones Diagnostics ── */}
      <div className="bg-white rounded-2xl border border-farm-border-color p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-farm-dark text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Detected Field Stress Zones
              {isLive && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-farm-gray text-farm-muted normal-case">
                  Demo
                </span>
              )}
            </h3>
            <p className="text-xs text-farm-muted">Automated satellite anomaly classification per field segment</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            {satellite.stressZones.length} Zones Detected
          </span>
        </div>

        {satellite.stressZones.length > 0 ? (
          <div className="space-y-3">
            {satellite.stressZones.map((zone) => (
              <div
                key={zone.id}
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-farm-dark">{zone.name}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                      {zone.type}
                    </span>
                  </div>
                  <span className="text-xs text-farm-muted font-medium">{zone.areaAcres} acres</span>
                </div>
                <p className="text-xs text-amber-950 font-medium">{zone.description}</p>
                <p className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Action: {zone.actionRequired}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-farm-muted bg-farm-gray rounded-xl">
            No severe vegetation anomalies detected across this farm.
          </div>
        )}
      </div>
    </div>
  );
}
