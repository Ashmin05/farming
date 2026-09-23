import type { Provenance } from "@/lib/api/types";
import { Wifi, Cpu, FlaskConical } from "lucide-react";

interface SourceBadgeProps {
  provenance: Provenance;
  size?: "sm" | "md";
}

/**
 * Shows Live / Modelled / Estimate based on the provenance field.
 *
 * Logic:
 *   is_live: true                              → "Live"   (green)
 *   is_live: false + source satellite/weather  → "Modelled" (blue)
 *   source: model / manual / estimate          → "Estimate" (amber)
 *   source: market_feed                        → "Live"   (green) — market feeds are always live
 */
function getLabel(p: Provenance): { label: string; color: string; bg: string; Icon: typeof Wifi } {
  if (p.is_live || p.source === "market_feed") {
    return { label: "Live", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", Icon: Wifi };
  }
  if (p.source === "satellite" || p.source === "weather_api" || p.source === "soil_sensor") {
    return { label: "Modelled", color: "text-sky-700", bg: "bg-sky-50 border-sky-200", Icon: Cpu };
  }
  return { label: "Estimate", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", Icon: FlaskConical };
}

export default function SourceBadge({ provenance, size = "sm" }: SourceBadgeProps) {
  const { label, color, bg, Icon } = getLabel(provenance);
  const isLive = label === "Live";

  return (
    <span
      className={`inline-flex items-center gap-1 border rounded-full font-medium ${bg} ${color} ${
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
      }`}
      title={`Source: ${provenance.provider ?? provenance.source} · Last updated: ${new Date(provenance.fetched_at).toLocaleString("en-IN")}`}
    >
      {isLive ? (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      ) : (
        <Icon className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      )}
      {label}
      {provenance.confidence !== undefined && (
        <span className="opacity-60 ml-0.5">({Math.round(provenance.confidence * 100)}%)</span>
      )}
    </span>
  );
}
