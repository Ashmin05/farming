"use client";

// ==============================================================================
// ⛅ WEATHER & PRECIPITATION VIEW COMPONENT
// ==============================================================================
// Route URL: /weather
// App Router Entry: src/app/weather/page.tsx
// Description: Hyper-local weather forecast, severe storm alerts, 10-day trends,
// hourly temperature tracking, and AI smart irrigation timing guidance.
// ==============================================================================

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Cloud, CloudRain, CloudLightning, Sun, Wind, Droplets,
  Thermometer, Bell, ArrowRight, Eye, Gauge
} from "lucide-react";

const days = [
  { day: "Today", icon: Sun, label: "Sunny", hi: 32, lo: 21, rain: 5, wind: 12, humidity: 58 },
  { day: "Wed", icon: Cloud, label: "Cloudy", hi: 29, lo: 19, rain: 15, wind: 18, humidity: 72 },
  { day: "Thu", icon: CloudRain, label: "Light Rain", hi: 27, lo: 18, rain: 65, wind: 22, humidity: 85 },
  { day: "Fri", icon: CloudRain, label: "Rain", hi: 25, lo: 17, rain: 80, wind: 28, humidity: 90 },
  { day: "Sat", icon: CloudLightning, label: "Storm", hi: 24, lo: 16, rain: 92, wind: 45, humidity: 95 },
  { day: "Sun", icon: CloudRain, label: "Light Rain", hi: 26, lo: 17, rain: 50, wind: 20, humidity: 80 },
  { day: "Mon", icon: Cloud, label: "Partly Cloudy", hi: 28, lo: 18, rain: 20, wind: 14, humidity: 68 },
  { day: "Tue", icon: Sun, label: "Sunny", hi: 31, lo: 20, rain: 8, wind: 10, humidity: 55 },
  { day: "Wed", icon: Sun, label: "Sunny", hi: 33, lo: 22, rain: 5, wind: 8, humidity: 50 },
  { day: "Thu", icon: Cloud, label: "Cloudy", hi: 30, lo: 21, rain: 18, wind: 16, humidity: 65 },
];

const activeAlerts = [
  {
    id: 1,
    type: "Heavy Rainfall",
    icon: CloudRain,
    time: "Thu–Fri",
    desc: "Expect 65–80mm rainfall. Postpone pesticide application. Ensure field drainage is clear.",
    severity: "high",
  },
  {
    id: 2,
    type: "Thunderstorm Warning",
    icon: CloudLightning,
    time: "Saturday",
    desc: "Strong winds up to 45 km/h. Secure farm equipment and avoid field work.",
    severity: "critical",
  },
];

const alertColors: Record<string, string> = {
  high: "border-amber-300 bg-amber-50",
  critical: "border-red-300 bg-red-50",
  low: "border-emerald-300 bg-emerald-50",
};

const alertTextColors: Record<string, string> = {
  high: "text-amber-700",
  critical: "text-red-700",
  low: "text-emerald-700",
};

const hourly = [
  { time: "6am", temp: 22, icon: Sun },
  { time: "9am", temp: 26, icon: Sun },
  { time: "12pm", temp: 31, icon: Sun },
  { time: "3pm", temp: 32, icon: Cloud },
  { time: "6pm", temp: 29, icon: Cloud },
  { time: "9pm", temp: 25, icon: CloudRain },
  { time: "12am", temp: 22, icon: CloudRain },
];

export default function WeatherPage() {
  const [selected, setSelected] = useState(0);
  const day = days[selected];
  const DayIcon = day.icon;

  return (
    <div className="min-h-screen bg-white" data-theme="light">
      <Navbar />

      {/* Hero */}
      <div className="pt-24 pb-12 bg-gradient-to-br from-sky-50 to-blue-50 border-b border-farm-border-color">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-sky-600 text-white text-sm px-4 py-1.5 rounded-full mb-4 font-medium">
            <Cloud className="w-4 h-4" /> Weather & Alerts
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-farm-dark mb-3">
            Hyper-local weather for your field.
          </h1>
          <p className="text-farm-muted text-lg">10-day forecasts, storm alerts, and crop-smart irrigation timing.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">

        {/* ── Active Alerts ── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold text-farm-dark">Active Weather Alerts</h2>
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold ml-1">
              {activeAlerts.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAlerts.map(({ id, type, icon: Icon, time, desc, severity }) => (
              <div key={id} className={`p-5 rounded-2xl border-2 ${alertColors[severity]}`}>
                <div className={`flex items-center gap-2 mb-2 ${alertTextColors[severity]}`}>
                  <Icon className="w-5 h-5" />
                  <span className="font-bold">{type}</span>
                  <span className="ml-auto text-xs font-medium opacity-70">{time}</span>
                </div>
                <p className={`text-sm leading-relaxed ${alertTextColors[severity]} opacity-85`}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 10-Day Forecast ── */}
        <section>
          <h2 className="text-xl font-bold text-farm-dark mb-6">10-Day Forecast</h2>

          {/* Scrollable day strip */}
          <div className="flex gap-3 overflow-x-auto pb-2 mb-8">
            {days.map(({ day: d, icon: Icon, hi, lo, rain }, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`flex flex-col items-center gap-1.5 min-w-[72px] p-3 rounded-2xl border-2 transition-all cursor-pointer flex-shrink-0 ${
                  selected === i
                    ? "border-farm-green bg-farm-green-light"
                    : "border-farm-border-color bg-white hover:border-sky-300"
                }`}
              >
                <span className={`text-xs font-semibold ${selected === i ? "text-farm-green" : "text-farm-muted"}`}>{d}</span>
                <Icon className={`w-6 h-6 ${selected === i ? "text-farm-green" : "text-sky-500"}`} />
                <div className="text-center">
                  <p className="text-xs font-bold text-farm-dark">{hi}°</p>
                  <p className="text-xs text-farm-muted">{lo}°</p>
                </div>
                <div className="flex items-center gap-0.5 text-sky-500">
                  <Droplets className="w-3 h-3" />
                  <span className="text-xs">{rain}%</span>
                </div>
              </button>
            ))}
          </div>

          {/* Selected day detail */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-gradient-to-br from-sky-500 to-sky-700 rounded-2xl p-6 text-white">
              <p className="text-white/70 text-sm mb-3">{day.day} · Your Farm</p>
              <div className="flex items-center gap-3 mb-4">
                <DayIcon className="w-14 h-14 text-white" />
                <div>
                  <p className="text-5xl font-bold">{day.hi}°</p>
                  <p className="text-white/70">{day.label}</p>
                </div>
              </div>
              <p className="text-white/60 text-sm">Low {day.lo}°C tonight</p>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: Droplets, label: "Rain Chance", value: `${day.rain}%`, color: "text-sky-600" },
                { icon: Wind, label: "Wind Speed", value: `${day.wind} km/h`, color: "text-teal-600" },
                { icon: Gauge, label: "Humidity", value: `${day.humidity}%`, color: "text-blue-600" },
                { icon: Eye, label: "Visibility", value: "8 km", color: "text-indigo-600" },
                { icon: Thermometer, label: "High / Low", value: `${day.hi}° / ${day.lo}°`, color: "text-orange-600" },
                { icon: Sun, label: "UV Index", value: "Moderate", color: "text-amber-500" },
                { icon: CloudRain, label: "Rainfall (mm)", value: day.rain > 50 ? `${Math.round(day.rain * 0.8)}mm` : "< 5mm", color: "text-sky-500" },
                { icon: Cloud, label: "Cloud Cover", value: `${Math.round(day.rain * 0.85)}%`, color: "text-slate-500" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-farm-gray rounded-xl p-4 flex flex-col gap-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <p className="text-xs text-farm-muted">{label}</p>
                  <p className="font-bold text-farm-dark text-sm">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Hourly Today ── */}
        <section>
          <h2 className="text-xl font-bold text-farm-dark mb-5">Today — Hourly</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {hourly.map(({ time, temp, icon: Icon }) => (
              <div key={time} className="flex flex-col items-center gap-2 min-w-[70px] p-4 bg-farm-gray rounded-2xl border border-farm-border-color flex-shrink-0">
                <span className="text-xs text-farm-muted">{time}</span>
                <Icon className="w-6 h-6 text-sky-500" />
                <span className="font-bold text-farm-dark text-sm">{temp}°</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Irrigation Timing ── */}
        <section>
          <div className="bg-farm-green-light border border-farm-border-color rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <div className="w-12 h-12 bg-farm-green rounded-xl flex items-center justify-center flex-shrink-0">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-farm-dark text-lg mb-1">💧 Smart Irrigation Timing</h3>
              <p className="text-farm-muted text-sm">
                Based on today&apos;s weather: <strong>Skip irrigation Wednesday–Saturday.</strong> Expected 65–80mm rainfall will meet crop water needs.
                Next irrigation recommended: <strong>Sunday morning</strong> if soil moisture drops below 40%.
              </p>
            </div>
            <Link
              href="/features#irrigation"
              className="bg-farm-green text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-farm-green-dark transition-all flex-shrink-0"
            >
              View Details
            </Link>
          </div>
        </section>

      </div>

      {/* CTA */}
      <div className="bg-farm-sand py-14">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-farm-dark mb-3">Never be caught off-guard again</h2>
          <p className="text-farm-muted mb-6 text-sm">Register your farm to get personalised weather alerts for each of your fields.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-farm-green text-white px-7 py-3.5 rounded-xl font-bold hover:bg-farm-green-dark transition-all shadow-card group">
            Enable Alerts <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
