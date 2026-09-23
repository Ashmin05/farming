import Link from "next/link";

// ==============================================================================
// ✨ FEATURES SUITE VIEW COMPONENT
// ==============================================================================
// Route URL: /features
// App Router Entry: src/app/features/page.tsx
// Description: Comprehensive overview of all 14 farming tools (farm management,
// satellite crop health, weather forecasting, soil & irrigation, yield & price trends).
// ==============================================================================

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Map, Satellite, BarChart2, Bell, Cloud, CloudLightning,
  Droplets, Droplet, TrendingUp, DollarSign, Brain, Globe,
  ClipboardList, ArrowRight, ChevronRight
} from "lucide-react";

const featureGroups = [
  {
    group: "🌾 Farm & Field",
    color: "emerald",
    features: [
      {
        id: "farm-management",
        title: "Farm Management",
        desc: "Track multiple farms, fields, and crops in one place. Add notes, photos, and activity logs per season.",
        icon: ClipboardList,
        detail: [
          "Multi-farm & multi-field support",
          "Crop calendar & season tracking",
          "Activity log with photo evidence",
          "Input cost tracking per acre",
        ],
      },
      {
        id: "field-mapping",
        title: "Field Mapping",
        desc: "Draw your field boundary on a map. Calculate area in acres and hectares.",
        icon: Map,
        detail: [
          "Draw field boundary using Mapbox map",
          "Area calculation in acres & hectares",
          "Support for multiple fields per farm",
          "Pinpoint your field location",
        ],
      },
    ],
  },
  {
    group: "🛰️ Satellite Intelligence",
    color: "sky",
    features: [
      {
        id: "satellite-crop-health",
        title: "Satellite Crop Health",
        desc: "View your field from satellite imagery. See healthy vs. stressed crop areas.",
        icon: Satellite,
        detail: [
          "Satellite imagery updated regularly",
          "True-colour and false-colour views",
          "Stress zone overlay",
          "Visual crop health overview",
        ],
      },
      {
        id: "crop-health-map",
        title: "Crop Health Map",
        desc: "Full-field visual map that pinpoints the exact zones needing attention today.",
        icon: Map,
        detail: [
          "Field-level resolution maps",
          "Compare with historical images",
          "Export map as PDF / image",
          "Share with agronomist",
        ],
      },
      {
        id: "ndvi-history",
        title: "NDVI History",
        desc: "Track your crop's greenness index over the entire season and across past years.",
        icon: BarChart2,
        detail: [
          "NDVI graph over full season",
          "Year-over-year comparison",
          "Alert when NDVI drops suddenly",
          "Benchmark against district average",
        ],
      },
      {
        id: "crop-stress-alert",
        title: "Crop Stress Alert",
        desc: "Get notified when satellite detects stress in your crop.",
        icon: Bell,
        detail: [
          "In-app alerts",
          "Stress type identification (water, pest, disease)",
          "Severity levels: low / medium / critical",
          "Next-action recommendation",
        ],
      },
    ],
  },
  {
    group: "🌦️ Weather",
    color: "blue",
    features: [
      {
        id: "weather-forecast",
        title: "Weather Forecast",
        desc: "10-day hyper-local forecast for your exact field location, not just the nearest city.",
        icon: Cloud,
        detail: [
          "Hourly & daily forecasts",
          "Rainfall probability & amount",
          "Wind speed & direction",
          "Optimal spray / harvest windows",
        ],
      },
      {
        id: "weather-alerts",
        title: "Weather Alerts",
        desc: "Hailstorm, heavy rain, frost, and heat wave alerts up to 48 hours in advance.",
        icon: CloudLightning,
        detail: [
          "IMD-linked data source",
          "Extreme event push notifications",
          "Frost risk for sensitive crops",
          "Post-event crop damage estimator",
        ],
      },
    ],
  },
  {
    group: "💧 Soil & Irrigation",
    color: "amber",
    features: [
      {
        id: "soil-info",
        title: "Soil Information",
        desc: "Detailed soil composition, pH, organic matter, and nutrient levels mapped for your field.",
        icon: Droplets,
        detail: [
          "pH, N-P-K, organic carbon levels",
          "Soil texture & water retention",
          "Fertiliser recommendation per acre",
          "Soil health improvement tips",
        ],
      },
      {
        id: "irrigation-recommendation",
        title: "Irrigation Recommendation",
        desc: "Know when and how much to irrigate, based on your crop stage and soil condition.",
        icon: Droplet,
        detail: [
          "Crop-stage aware scheduling",
          "Supports drip & sprinkler systems",
          "Based on soil and weather data",
          "Water usage tracking",
        ],
      },
    ],
  },
  {
    group: "📈 Yield & Market",
    color: "orange",
    features: [
      {
        id: "yield-estimate",
        title: "Yield Estimate",
        desc: "Estimate your harvest in advance to plan labour, storage, and transport.",
        icon: TrendingUp,
        detail: [
          "Yield estimate before harvest",
          "Input vs. output profitability view",
          "Storage & transport planning",
          "Compare with nearby farms",
        ],
      },
      {
        id: "price-trends",
        title: "Price Trends",
        desc: "Track mandi prices and understand market trends for your crop.",
        icon: DollarSign,
        detail: [
          "Mandi price data (AGMARK)",
          "Price trends over time",
          "Best-time-to-sell guidance",
          "Nearest mandi comparison",
        ],
      },
    ],
  },
  {
    group: "🤖 AI & Language",
    color: "purple",
    features: [
      {
        id: "ai-farming-assistant",
        title: "AI Farming Assistant",
        desc: "KrishiBot answers every farming question in simple words — pests, diseases, fertilisers, schemes.",
        icon: Brain,
        detail: [
          "Natural language Q&A",
          "Pest & disease image diagnosis",
          "Government scheme eligibility check",
          "Fast intelligent Q&A",
        ],
      },
      {
        id: "multilingual",
        title: "Multilingual Support",
        desc: "Complete application available in 3 languages: Bengali (বাংলা), Hindi (हिंदी), and English.",
        icon: Globe,
        detail: [
          "Full app in Bengali, Hindi, and English",
          "Voice input & audio alerts",
          "1-tap language switcher across all screens",
          "KrishiBot responds fluently in your language",
        ],
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white" data-theme="light">
      <Navbar />

      {/* Hero */}
      <div className="pt-28 pb-16 bg-farm-green-light border-b border-farm-border-color">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-farm-green text-sm font-semibold uppercase tracking-wider mb-2">Complete Agri-Tech Suite</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-farm-dark mb-4">
            14 tools for smarter farming.
          </h1>
          <p className="text-farm-muted text-lg max-w-2xl mx-auto">
            From satellite imagery to AI agronomy — all features built for Indian farmers.
          </p>
        </div>
      </div>

      {/* Features grouped */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {featureGroups.map(({ group, features }) => (
          <div key={group}>
            <h2 className="text-2xl font-bold text-farm-dark mb-6 pb-3 border-b border-farm-border-color">
              {group}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map(({ id, title, desc, icon: Icon, detail }) => (
                <div
                  key={id}
                  className="group p-6 rounded-2xl border border-farm-border-color bg-white hover:shadow-card-hover hover:border-farm-green transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-farm-green-light flex items-center justify-center">
                      <Icon className="w-5 h-5 text-farm-green" />
                    </div>
                  </div>
                  <h3 className="font-bold text-farm-dark text-lg mb-2 group-hover:text-farm-green transition-colors">
                    {title}
                  </h3>
                  <p className="text-farm-muted text-sm mb-4 leading-relaxed">{desc}</p>
                  <ul className="space-y-1.5">
                    {detail.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm text-farm-dark/80">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-farm-green-light flex items-center justify-center flex-shrink-0">
                          <ChevronRight className="w-2.5 h-2.5 text-farm-green" />
                        </span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-farm-sand py-16 border-t border-farm-border-color">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-farm-dark mb-3">Ready to get started?</h2>
          <p className="text-farm-muted mb-8">Access all 14 farming tools directly from your dashboard.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-farm-green text-white px-8 py-3.5 rounded-xl font-bold hover:bg-farm-green-dark transition-all duration-200 shadow-card group"
            >
              Create Farmer Account <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-white border border-farm-border-color text-farm-dark px-8 py-3.5 rounded-xl font-semibold hover:border-farm-green hover:text-farm-green transition-all duration-200"
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
