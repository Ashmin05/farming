"use client";

// ==============================================================================
// 🛰️ SATELLITE ANALYTICS PANEL (NDVI, NDWI, STRESS ZONES, HISTORICAL GRAPH)
// ==============================================================================
// Features:
// - Current NDVI/NDWI statistics (Mean, Min, Max, Canopy health distribution)
// - NDVI Historical Trend Graph (Time series tracking crop vegetative progression)
// - Canopy Health Distribution donut chart
// - Field Stress-Zone diagnostic report
// Layer selection, the map, and sensor/quality info live in SatellitePage.tsx
// (they sit around the map, not below it) — this panel is everything below.
// ==============================================================================

import { useState } from "react";
import { FarmSatellite } from "@/lib/stores/farmStore";
import {
  Leaf, TrendingDown, TrendingUp, Droplets, AlertTriangle,
  CheckCircle2, Activity
} from "lucide-react";

export type SatelliteMapLayer = "rgb" | "ndvi" | "ndwi" | "evi" | "stress";

function CanopyDonut({ satellite }: { satellite: FarmSatellite }) {
  const radius = 46;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { pct: satellite.healthyCanopyPercent, color: "#10b981" }, // emerald-500
    { pct: satellite.moderateCanopyPercent, color: "#fbbf24" }, // amber-400
    { pct: satellite.stressedCanopyPercent, color: "#ef4444" }, // red-500
  ];

  let cumulativePct = 0;

  return (
    <div className="flex items-center justify-center gap-6">
      <div className="relative w-32 h-32 flex-shrink-0">
        <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f5f4" strokeWidth={strokeWidth} />
          {segments.map((seg, idx) => {
            if (seg.pct <= 0) return null;
            const segLength = (seg.pct / 100) * circumference;
            const offset = -((cumulativePct / 100) * circumference);
            cumulativePct += seg.pct;
            return (
              <circle
                key={idx}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segLength} ${circumference - segLength}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold text-farm-dark">{satellite.healthyCanopyPercent}%</span>
          <span className="text-[11px] text-farm-muted font-medium">Healthy</span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "#10b981" }} />
          <span className="text-farm-muted">Healthy</span>
          <span className="font-bold text-farm-dark ml-auto">{satellite.healthyCanopyPercent}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "#fbbf24" }} />
          <span className="text-farm-muted">Moderate</span>
          <span className="font-bold text-farm-dark ml-auto">{satellite.moderateCanopyPercent}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "#ef4444" }} />
          <span className="text-farm-muted">Stressed</span>
          <span className="font-bold text-farm-dark ml-auto">{satellite.stressedCanopyPercent}%</span>
        </div>
      </div>
    </div>
  );
}

export default function SatelliteAnalyticsPanel({
  crop,
  areaAcres,
  satellite,
  isLive = false,
}: {
  crop: string;
  areaAcres: number;
  satellite: FarmSatellite;
  /** True when `satellite`'s current stats (NDVI/NDWI/canopy %/metadata) came
   * from a real Sentinel-2 analysis rather than demo data. The historical
   * trend graph and stress zones below stay demo either way — flagged
   * inline so the live badge above doesn't imply those are real too. */
  isLive?: boolean;
}) {
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);

  // SVG dimensions for the historical graph
  const graphWidth = 460;
  const graphHeight = 160;
  const paddingX = 36;
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
      {/* ── Current Statistics ── */}
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-farm-gray rounded-xl text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-1.5">
              <Leaf className="w-4 h-4" />
            </div>
            <p className="text-xs text-farm-muted">Mean NDVI</p>
            <p className="text-xl font-bold text-farm-dark">{satellite.meanNdvi.toFixed(2)}</p>
            <span className="text-[10px] text-emerald-600 font-semibold">{satellite.canopyVigourLabel}</span>
          </div>

          <div className="p-3.5 bg-farm-gray rounded-xl text-center">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-1.5">
              <TrendingDown className="w-4 h-4" />
            </div>
            <p className="text-xs text-farm-muted">Min NDVI</p>
            <p className="text-xl font-bold text-farm-dark">{satellite.minNdvi.toFixed(2)}</p>
            <span className="text-[10px] text-amber-600 font-semibold">Low</span>
          </div>

          <div className="p-3.5 bg-farm-gray rounded-xl text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-1.5">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-xs text-farm-muted">Max NDVI</p>
            <p className="text-xl font-bold text-farm-dark">{satellite.maxNdvi.toFixed(2)}</p>
            <span className="text-[10px] text-emerald-700 font-semibold">High</span>
          </div>

          <div className="p-3.5 bg-sky-50 rounded-xl text-center border border-sky-200/60">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center mx-auto mb-1.5">
              <Droplets className="w-4 h-4" />
            </div>
            <p className="text-xs text-sky-700">Mean NDWI</p>
            <p className="text-xl font-bold text-sky-900">{satellite.ndwi.toFixed(2)}</p>
            <span className="text-[10px] text-sky-600 font-semibold">Optimal</span>
          </div>
        </div>
      </div>

      {/* ── NDVI Trend + Canopy Health Distribution, side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NDVI Season Progression */}
        <div className="bg-white rounded-2xl border border-farm-border-color p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-bold text-farm-dark text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              NDVI Season Progression
              {isLive && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-farm-gray text-farm-muted normal-case">
                  Demo trend
                </span>
              )}
            </h3>
            <span className="text-[11px] font-semibold text-farm-muted bg-farm-gray px-2.5 py-1 rounded-lg flex-shrink-0">
              Last 6 Months
            </span>
          </div>

          <div className="w-full overflow-x-auto">
            <div className="min-w-[380px]">
              <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="w-full h-40 overflow-visible">
                {[0.2, 0.4, 0.6, 0.8].map((v) => {
                  const y = graphHeight - paddingY - (v / maxNdvi) * (graphHeight - paddingY * 2);
                  return (
                    <g key={v}>
                      <line x1={paddingX} y1={y} x2={graphWidth - paddingX} y2={y} stroke="#f1f5f9" strokeDasharray="4 4" />
                      <text x={paddingX - 8} y={y + 3} fontSize="9" textAnchor="end" fill="#94a3b8">
                        {v.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                <path d={benchmarkPath} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
                <path d={ndviPath} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />

                {coords.map((pt, idx) => {
                  const isSelected = selectedPointIdx === idx;
                  return (
                    <g
                      key={idx}
                      className="cursor-pointer group"
                      onMouseEnter={() => setSelectedPointIdx(idx)}
                      onClick={() => setSelectedPointIdx(idx)}
                    >
                      <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6 : 4}
                        fill="#ffffff"
                        stroke="#059669"
                        strokeWidth={isSelected ? 3 : 2}
                        className="transition-all"
                      />
                      <text
                        x={pt.x}
                        y={graphHeight - 4}
                        fontSize="8.5"
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

          <div className="flex items-center gap-4 text-[11px] mt-2">
            <span className="flex items-center gap-1.5 font-semibold text-farm-dark">
              <span className="w-3 h-1 bg-emerald-600 rounded-full" /> Actual NDVI
            </span>
            <span className="flex items-center gap-1.5 text-farm-muted">
              <span className="w-3 h-1 bg-slate-300 rounded-full" /> Regional Average
            </span>
          </div>

          {activePoint && (
            <div className="mt-3 p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200/60 text-[11px] flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span>
                <strong>{activePoint.date}</strong> · {activePoint.stage}
              </span>
              <span>
                NDVI <strong className="text-emerald-800">{activePoint.ndvi.toFixed(2)}</strong>{" "}
                <span className="text-farm-muted">vs. benchmark {activePoint.benchmark.toFixed(2)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Canopy Health Distribution Donut */}
        <div className="bg-white rounded-2xl border border-farm-border-color p-5 shadow-xs flex flex-col">
          <h3 className="font-bold text-farm-dark text-sm flex items-center gap-2 mb-4">
            <Leaf className="w-4 h-4 text-farm-green" />
            Canopy Health Distribution
          </h3>
          <div className="flex-1 flex items-center justify-center py-2">
            <CanopyDonut satellite={satellite} />
          </div>
        </div>
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
              <div key={zone.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5">
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
