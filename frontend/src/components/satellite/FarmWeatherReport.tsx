"use client";

// ==============================================================================
// 🌦️ FARM WEATHER REPORT & 10-DAY FORECAST COMPONENT
// ==============================================================================
// Used in: /satellite (Satellite Analysis Page per farm)
// Features:
// - Live/Hyperlocal metrics (Temp, Humidity, Wind, Pressure, UV, Rain)
// - Weather alerts with severity and actionable agricultural advice
// - Interactive 10-day forecast day-selector with farm-specific advisories
// - Ready for backend API hook-up (e.g. Open-Meteo, IMD, or FastAPI endpoint)
// ==============================================================================

import { useState } from "react";
import {
  Cloud, CloudRain, CloudLightning, Sun, CloudSun, CloudDrizzle,
  Wind, Droplets, Thermometer, AlertTriangle, ShieldAlert,
  Calendar, CheckCircle2, Gauge, SunMedium, type LucideIcon
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WeatherSeverity = "critical" | "high" | "moderate" | "info";

export type FarmWeatherAlert = {
  id: string;
  type: string;
  severity: WeatherSeverity;
  timeframe: string;
  headline: string;
  actionAdvice: string;
};

export type DayForecastItem = {
  day: string;
  date: string;
  condition: string;
  iconType: "sun" | "cloud" | "rain" | "storm" | "cloud-sun" | "drizzle";
  hi: number;
  lo: number;
  rainChance: number;
  rainfallMm: number;
  windKmh: number;
  humidity: number;
  uvIndex: number;
  farmingAdvisory: string;
};

export type FarmDetailedWeather = {
  currentTemp: number;
  feelsLike: number;
  condition: string;
  iconType: "sun" | "cloud" | "rain" | "storm" | "cloud-sun" | "drizzle";
  humidity: number;
  windKmh: number;
  windDir: string;
  rainExpected: string;
  uvIndex: number;
  pressureHpa: number;
  alerts: FarmWeatherAlert[];
  forecast10Days: DayForecastItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function WeatherIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "sun":
      return <Sun className={className || "w-6 h-6 text-amber-500"} />;
    case "cloud-sun":
      return <CloudSun className={className || "w-6 h-6 text-amber-500"} />;
    case "rain":
      return <CloudRain className={className || "w-6 h-6 text-sky-500"} />;
    case "storm":
      return <CloudLightning className={className || "w-6 h-6 text-purple-600"} />;
    case "drizzle":
      return <CloudDrizzle className={className || "w-6 h-6 text-sky-400"} />;
    case "cloud":
    default:
      return <Cloud className={className || "w-6 h-6 text-slate-400"} />;
  }
}

const severityConfig: Record<WeatherSeverity, { bg: string; border: string; text: string; badge: string; icon: LucideIcon }> = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    badge: "bg-red-600 text-white",
    icon: ShieldAlert,
  },
  high: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    badge: "bg-amber-600 text-white",
    icon: AlertTriangle,
  },
  moderate: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-900",
    badge: "bg-yellow-600 text-white",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    badge: "bg-blue-600 text-white",
    icon: AlertTriangle,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FarmWeatherReport({
  farmName,
  location,
  crop,
  weather,
}: {
  farmName: string;
  location: string;
  crop: string;
  weather: FarmDetailedWeather;
}) {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const activeDay = weather.forecast10Days[selectedDayIdx] || weather.forecast10Days[0];

  return (
    <div className="bg-white rounded-2xl border border-farm-border-color shadow-card overflow-hidden">
      {/* Header bar */}
      <div className="p-5 border-b border-farm-border-color bg-gradient-to-r from-sky-50/70 to-emerald-50/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600">
            <WeatherIcon type={weather.iconType} className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-farm-dark text-base">Weather & Forecast</h3>
              <span className="text-xs bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded-full">
                10-Day Live Outlook
              </span>
            </div>
            <p className="text-xs text-farm-muted mt-0.5">
              Specific to <span className="font-medium text-farm-dark">{farmName}</span> ({location}) · Crop: {crop}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-farm-muted">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Weather Station Active</span>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* ── Current Conditions Stats Grid ── */}
        <div>
          <h4 className="text-xs font-bold text-farm-muted uppercase tracking-wider mb-3">
            Current Farm Conditions
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Temp */}
            <div className="p-3 bg-farm-gray/70 hover:bg-farm-gray rounded-xl border border-farm-border-color/60 transition-colors">
              <div className="flex items-center justify-between text-orange-600 mb-1">
                <span className="text-xs font-medium text-farm-muted">Temp</span>
                <Thermometer className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-farm-dark">{weather.currentTemp}°C</p>
              <p className="text-[11px] text-farm-muted mt-0.5">Feels {weather.feelsLike}°C</p>
            </div>

            {/* Condition */}
            <div className="p-3 bg-farm-gray/70 hover:bg-farm-gray rounded-xl border border-farm-border-color/60 transition-colors">
              <div className="flex items-center justify-between text-sky-600 mb-1">
                <span className="text-xs font-medium text-farm-muted">Sky</span>
                <WeatherIcon type={weather.iconType} className="w-4 h-4 text-sky-500" />
              </div>
              <p className="text-sm font-bold text-farm-dark truncate">{weather.condition}</p>
              <p className="text-[11px] text-farm-muted mt-0.5">Conditions</p>
            </div>

            {/* Humidity */}
            <div className="p-3 bg-farm-gray/70 hover:bg-farm-gray rounded-xl border border-farm-border-color/60 transition-colors">
              <div className="flex items-center justify-between text-blue-600 mb-1">
                <span className="text-xs font-medium text-farm-muted">Humidity</span>
                <Droplets className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-farm-dark">{weather.humidity}%</p>
              <p className="text-[11px] text-farm-muted mt-0.5">
                {weather.humidity > 75 ? "High moisture" : weather.humidity > 45 ? "Optimal" : "Dry air"}
              </p>
            </div>

            {/* Wind */}
            <div className="p-3 bg-farm-gray/70 hover:bg-farm-gray rounded-xl border border-farm-border-color/60 transition-colors">
              <div className="flex items-center justify-between text-teal-600 mb-1">
                <span className="text-xs font-medium text-farm-muted">Wind</span>
                <Wind className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-farm-dark">{weather.windKmh} <span className="text-xs font-normal">km/h</span></p>
              <p className="text-[11px] text-farm-muted mt-0.5">Dir: {weather.windDir}</p>
            </div>

            {/* UV Index */}
            <div className="p-3 bg-farm-gray/70 hover:bg-farm-gray rounded-xl border border-farm-border-color/60 transition-colors">
              <div className="flex items-center justify-between text-amber-600 mb-1">
                <span className="text-xs font-medium text-farm-muted">UV Index</span>
                <SunMedium className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-farm-dark">{weather.uvIndex}</p>
              <p className="text-[11px] text-farm-muted mt-0.5">
                {weather.uvIndex >= 8 ? "Very High" : weather.uvIndex >= 6 ? "High" : "Moderate"}
              </p>
            </div>

            {/* Pressure */}
            <div className="p-3 bg-farm-gray/70 hover:bg-farm-gray rounded-xl border border-farm-border-color/60 transition-colors">
              <div className="flex items-center justify-between text-indigo-600 mb-1">
                <span className="text-xs font-medium text-farm-muted">Pressure</span>
                <Gauge className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-farm-dark">{weather.pressureHpa}</p>
              <p className="text-[11px] text-farm-muted mt-0.5">hPa (Barometer)</p>
            </div>
          </div>
        </div>

        {/* ── Active Weather Alerts ── */}
        {weather.alerts && weather.alerts.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-farm-muted uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Active Alerts for this Field
              </h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {weather.alerts.length} Advisory {weather.alerts.length === 1 ? "" : "Actions"}
              </span>
            </div>

            <div className="space-y-2.5">
              {weather.alerts.map((alert) => {
                const conf = severityConfig[alert.severity] || severityConfig.moderate;
                const IconComponent = conf.icon;
                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border ${conf.bg} ${conf.border} transition-all`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <IconComponent className={`w-5 h-5 mt-0.5 flex-shrink-0 ${conf.text}`} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-farm-dark">{alert.headline}</span>
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${conf.badge}`}>
                              {alert.severity}
                            </span>
                            <span className="text-xs text-farm-muted">· {alert.timeframe}</span>
                          </div>
                          <p className={`text-xs mt-1.5 leading-relaxed font-medium ${conf.text}`}>
                            💡 <span className="font-bold">Agronomic Action:</span> {alert.actionAdvice}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 10-Day Forecast ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-farm-muted uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-farm-green" />
              10-Day Precipitation & Thermal Forecast
            </h4>
            <span className="text-xs text-farm-muted">Click a day for crop advice</span>
          </div>

          {/* Horizontal scrollable forecast strip */}
          <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1 scrollbar-thin">
            {weather.forecast10Days.map((item, idx) => {
              const isSelected = idx === selectedDayIdx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedDayIdx(idx)}
                  className={`flex flex-col items-center gap-2 p-3 min-w-[82px] rounded-xl border transition-all text-center flex-shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-farm-green-light border-farm-green shadow-xs ring-1 ring-farm-green"
                      : "bg-white border-farm-border-color hover:border-farm-green-mid hover:bg-farm-gray/50"
                  }`}
                >
                  <span className={`text-xs font-bold ${isSelected ? "text-farm-green" : "text-farm-dark"}`}>
                    {item.day}
                  </span>
                  <span className="text-[10px] text-farm-muted -mt-1 font-medium">{item.date}</span>

                  <div className="my-0.5">
                    <WeatherIcon type={item.iconType} className="w-6 h-6 mx-auto" />
                  </div>

                  <div>
                    <div className="text-xs font-bold text-farm-dark">
                      {item.hi}° <span className="text-farm-muted font-normal text-[11px]">{item.lo}°</span>
                    </div>
                  </div>

                  {/* Rain badge */}
                  <div
                    className={`flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                      item.rainChance > 50
                        ? "bg-sky-100 text-sky-800"
                        : item.rainChance > 20
                        ? "bg-sky-50 text-sky-600"
                        : "text-slate-400"
                    }`}
                  >
                    <Droplets className="w-3 h-3" />
                    <span>{item.rainChance}%</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Selected Day Detailed Agricultural Advisory ── */}
          {activeDay && (
            <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-farm-green-light/40 to-sky-50/40 border border-farm-green/30">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-farm-green/20">
                <div className="flex items-center gap-3">
                  <WeatherIcon type={activeDay.iconType} className="w-8 h-8" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-farm-dark text-sm">
                        {activeDay.day}, {activeDay.date} — {activeDay.condition}
                      </span>
                      {selectedDayIdx === 0 && (
                        <span className="text-[10px] font-bold bg-farm-green text-white px-2 py-0.5 rounded-full">
                          Today
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-farm-muted mt-0.5">
                      Expected High: <strong className="text-farm-dark">{activeDay.hi}°C</strong> | Low: <strong className="text-farm-dark">{activeDay.lo}°C</strong> | Rain: <strong className="text-sky-600">{activeDay.rainfallMm} mm ({activeDay.rainChance}%)</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-farm-muted">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    <span>Humidity: <strong className="text-farm-dark">{activeDay.humidity}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-farm-muted">
                    <Wind className="w-4 h-4 text-teal-500" />
                    <span>Wind: <strong className="text-farm-dark">{activeDay.windKmh} km/h</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-farm-muted">
                    <SunMedium className="w-4 h-4 text-amber-500" />
                    <span>UV: <strong className="text-farm-dark">{activeDay.uvIndex}</strong></span>
                  </div>
                </div>
              </div>

              {/* Advisory Text */}
              <div className="pt-3 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-farm-green flex-shrink-0 mt-0.5" />
                <p className="text-xs text-farm-dark leading-relaxed font-medium">
                  <strong className="text-farm-green-dark">Field Advisory for {crop}:</strong>{" "}
                  {activeDay.farmingAdvisory}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
