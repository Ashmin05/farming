"use client";

// ==============================================================================
// 🌾 UNIFIED CANONICAL FARM & REMOTE SENSING STORE
// ==============================================================================
// Single source of truth for:
// - Dashboard (/dashboard)
// - My Farms (/farms)
// - Satellite Analysis (/satellite)
//
// Rule: Farm == Field (no confusing sub-field hierarchy).
// Defaults to exactly 2 consistent farms (Nashik Onion & Pune Wheat).
// ==============================================================================

import { useState, useEffect } from "react";
import { FarmDetailedWeather } from "@/components/satellite/FarmWeatherReport";
import { getUserId } from "@/lib/auth/auth-client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FarmYield = {
  estimatedQuintals: number;
  expectedPricePerQtl: number; // in ₹
  totalEstimatedValue: number; // in ₹
  harvestWindow: string;
  historicalYieldComparison: string; // e.g. "+12% vs last season"
};

export type FarmSoil = {
  ph: number;
  nitrogen: "Low" | "Medium" | "High";
  phosphorus: "Low" | "Medium" | "High";
  potassium: "Low" | "Medium" | "High";
  organicMatter: string;
  moisturePercent: number;
  healthRating: "Optimal" | "Moderate" | "Needs Attention";
};

export type FarmWater = {
  status: "Optimal" | "Moderate Stress" | "Excess Rain Risk";
  canopyMoisturePercent: number;
  soilMoisturePercent: number;
  lastIrrigationDaysAgo: number;
  nextRecommendedAction: string;
};

export type NdviHistoryPoint = {
  date: string; // e.g. "Jun 25", "Jul 10"
  ndvi: number;
  benchmark: number; // optimal curve benchmark
  stage: string; // "Germination", "Vegetative", "Bulbing / Tillering"
};

export type StressZone = {
  id: string;
  name: string;
  type: "Water Stress" | "Nutrient Deficit" | "Pest Vulnerability" | "Excess Water";
  areaAcres: number;
  severity: "high" | "moderate" | "low";
  description: string;
  actionRequired: string;
};

export type SatelliteImageMetadata = {
  satelliteMission: string; // e.g. "ESA Sentinel-2B L2A"
  acquisitionDate: string; // e.g. "2026-09-20 10:42 UTC"
  cloudCoveragePercent: number; // e.g. 0.3
  spatialResolution: string; // e.g. "10m Multispectral"
  dataQualityConfidence: number; // e.g. 98.4
  sunElevationAngle: string; // e.g. "54.2°"
};

export type FarmSatellite = {
  // Current statistics
  meanNdvi: number;
  minNdvi: number;
  maxNdvi: number;
  ndwi: number; // Water index (-1 to 1)
  canopyVigourLabel: "Excellent" | "Good" | "Fair" | "Poor";
  healthyCanopyPercent: number;
  moderateCanopyPercent: number;
  stressedCanopyPercent: number;
  
  // Historical timeline
  history: NdviHistoryPoint[];

  // Field stress zones
  stressZones: StressZone[];

  // Image quality & metadata
  metadata: SatelliteImageMetadata;
};

export type Farm = {
  id: string;
  name: string;
  address: string;
  district: string;
  state: string;
  crop: string;
  variety: string;
  plantingDate: string;
  areaAcres: number;
  center: [number, number]; // [lng, lat]
  polygonGeoJson?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
  
  // Core Domain Modules
  yield: FarmYield;
  soil: FarmSoil;
  water: FarmWater;
  weather: FarmDetailedWeather;
  satellite: FarmSatellite;
};

// ── Default 2 Canonical Farms ─────────────────────────────────────────────────

export const DEFAULT_FARMS: Farm[] = [
  {
    id: "farm-1",
    name: "North Onion Field",
    address: "Dindori Road, Nashik, Maharashtra",
    district: "Nashik",
    state: "Maharashtra",
    crop: "Onion",
    variety: "Bhima Super (Red)",
    plantingDate: "2026-06-10",
    areaAcres: 3.2,
    center: [73.7898, 19.9975],
    yield: {
      estimatedQuintals: 72,
      expectedPricePerQtl: 2400,
      totalEstimatedValue: 172800,
      harvestWindow: "Mid-October 2026",
      historicalYieldComparison: "+8% above Nashik average",
    },
    soil: {
      ph: 6.8,
      nitrogen: "Medium",
      phosphorus: "High",
      potassium: "Medium",
      organicMatter: "2.1%",
      moisturePercent: 28,
      healthRating: "Optimal",
    },
    water: {
      status: "Optimal",
      canopyMoisturePercent: 74,
      soilMoisturePercent: 28,
      lastIrrigationDaysAgo: 3,
      nextRecommendedAction: "Light drip irrigation cycle in 2 days during evening hours.",
    },
    weather: {
      currentTemp: 29,
      feelsLike: 31,
      condition: "Partly Cloudy",
      iconType: "cloud-sun",
      humidity: 64,
      windKmh: 14,
      windDir: "NE",
      rainExpected: "12mm in 3 days",
      uvIndex: 6,
      pressureHpa: 1012,
      alerts: [
        {
          id: "alert-nsh-1",
          type: "Thermal Advisory",
          severity: "moderate",
          timeframe: "Next 48–72h",
          headline: "Afternoon Heat Peak (+33°C) Forecasted",
          actionAdvice: "Irrigate onion crop in early morning or evening to prevent heat shock and bulb cracking.",
        },
      ],
      forecast10Days: [
        { day: "Today", date: "Sep 22", condition: "Partly Cloudy", iconType: "cloud-sun", hi: 31, lo: 21, rainChance: 10, rainfallMm: 0, windKmh: 14, humidity: 64, uvIndex: 6, farmingAdvisory: "Ideal day for foliar micronutrient spray. Low wind drift risk." },
        { day: "Wed", date: "Sep 23", condition: "Sunny & Warm", iconType: "sun", hi: 32, lo: 22, rainChance: 5, rainfallMm: 0, windKmh: 12, humidity: 58, uvIndex: 7, farmingAdvisory: "Good conditions for general weeding and drip line maintenance." },
        { day: "Thu", date: "Sep 24", condition: "Overcast", iconType: "cloud", hi: 29, lo: 20, rainChance: 25, rainfallMm: 2.1, windKmh: 16, humidity: 70, uvIndex: 5, farmingAdvisory: "Cloud cover increasing. Monitor onion leaf margins for thrips." },
        { day: "Fri", date: "Sep 25", condition: "Light Rain", iconType: "rain", hi: 28, lo: 20, rainChance: 65, rainfallMm: 8.5, windKmh: 18, humidity: 80, uvIndex: 4, farmingAdvisory: "Hold off on applying urea or water-soluble fertilizer ahead of rain." },
        { day: "Sat", date: "Sep 26", condition: "Scattered Rain", iconType: "rain", hi: 27, lo: 19, rainChance: 55, rainfallMm: 4.0, windKmh: 15, humidity: 82, uvIndex: 4, farmingAdvisory: "Check furrows and ensure no standing water around bulb root zones." },
        { day: "Sun", date: "Sep 27", condition: "Clearing Sky", iconType: "cloud-sun", hi: 29, lo: 19, rainChance: 20, rainfallMm: 0.5, windKmh: 11, humidity: 68, uvIndex: 6, farmingAdvisory: "Favorable root aeration. Soil moisture will remain high." },
        { day: "Mon", date: "Sep 28", condition: "Sunny", iconType: "sun", hi: 31, lo: 20, rainChance: 5, rainfallMm: 0, windKmh: 10, humidity: 60, uvIndex: 7, farmingAdvisory: "Excellent sunny window to apply preventive bio-fungicide for purple blotch." },
        { day: "Tue", date: "Sep 29", condition: "Sunny", iconType: "sun", hi: 32, lo: 21, rainChance: 5, rainfallMm: 0, windKmh: 9, humidity: 55, uvIndex: 7, farmingAdvisory: "Standard watering schedule; soil moisture retention remains healthy." },
        { day: "Wed", date: "Sep 30", condition: "Clear Skies", iconType: "sun", hi: 33, lo: 22, rainChance: 0, rainfallMm: 0, windKmh: 12, humidity: 52, uvIndex: 8, farmingAdvisory: "High solar radiation; ensure mulch coverage is intact." },
        { day: "Thu", date: "Oct 01", condition: "Partly Cloudy", iconType: "cloud-sun", hi: 30, lo: 21, rainChance: 15, rainfallMm: 0.2, windKmh: 13, humidity: 62, uvIndex: 6, farmingAdvisory: "Stable weather conditions across Nashik valley." },
      ],
    },
    satellite: {
      meanNdvi: 0.72,
      minNdvi: 0.48,
      maxNdvi: 0.84,
      ndwi: 0.45,
      canopyVigourLabel: "Good",
      healthyCanopyPercent: 82,
      moderateCanopyPercent: 14,
      stressedCanopyPercent: 4,
      history: [
        { date: "Jun 20", ndvi: 0.22, benchmark: 0.20, stage: "Transplanting" },
        { date: "Jul 05", ndvi: 0.38, benchmark: 0.35, stage: "Root Establishment" },
        { date: "Jul 20", ndvi: 0.52, benchmark: 0.50, stage: "Active Foliage" },
        { date: "Aug 10", ndvi: 0.65, benchmark: 0.62, stage: "Canopy Expansion" },
        { date: "Aug 28", ndvi: 0.74, benchmark: 0.70, stage: "Bulb Initiation" },
        { date: "Sep 15", ndvi: 0.72, benchmark: 0.71, stage: "Bulb Development" },
      ],
      stressZones: [
        {
          id: "sz-1",
          name: "South-West Furrow Edge",
          type: "Excess Water",
          areaAcres: 0.25,
          severity: "low",
          description: "Slight water stagnation detected after last irrigation flush.",
          actionRequired: "Clean out runoff furrow drainage outlet.",
        },
      ],
      metadata: {
        satelliteMission: "ESA Sentinel-2B L2A (BOA Reflectance)",
        acquisitionDate: "2026-09-20 10:42 UTC",
        cloudCoveragePercent: 0.2,
        spatialResolution: "10m Multispectral GSD",
        dataQualityConfidence: 98.8,
        sunElevationAngle: "58.4°",
      },
    },
  },
  {
    id: "farm-2",
    name: "South Wheat Block",
    address: "Hadapsar Rural, Pune, Maharashtra",
    district: "Pune",
    state: "Maharashtra",
    crop: "Wheat",
    variety: "GW 322 (Sharbati)",
    plantingDate: "2026-07-01",
    areaAcres: 5.5,
    center: [73.8567, 18.5204],
    yield: {
      estimatedQuintals: 123,
      expectedPricePerQtl: 2275,
      totalEstimatedValue: 279825,
      harvestWindow: "Late November 2026",
      historicalYieldComparison: "+5% vs regional baseline",
    },
    soil: {
      ph: 7.2,
      nitrogen: "Low",
      phosphorus: "Medium",
      potassium: "High",
      organicMatter: "1.8%",
      moisturePercent: 38,
      healthRating: "Moderate",
    },
    water: {
      status: "Excess Rain Risk",
      canopyMoisturePercent: 88,
      soilMoisturePercent: 38,
      lastIrrigationDaysAgo: 7,
      nextRecommendedAction: "Pause all artificial irrigation. Heavy monsoon rain forecast in 48 hours.",
    },
    weather: {
      currentTemp: 25,
      feelsLike: 27,
      condition: "Overcast & Humid",
      iconType: "cloud",
      humidity: 82,
      windKmh: 24,
      windDir: "SW",
      rainExpected: "38mm in next 48h",
      uvIndex: 4,
      pressureHpa: 1007,
      alerts: [
        {
          id: "alert-pune-1",
          type: "Heavy Rain Warning",
          severity: "critical",
          timeframe: "Next 24–48 hours",
          headline: "Heavy Rainfall Expected (65–85 mm)",
          actionAdvice: "Clear drainage trenches immediately. Prevent water stagnation around wheat seedlings to avoid damping-off and root rot.",
        },
        {
          id: "alert-pune-2",
          type: "High Wind Alert",
          severity: "high",
          timeframe: "Thursday Evening",
          headline: "Squall Winds up to 42 km/h",
          actionAdvice: "Postpone chemical spraying and secure nursery sheets or lightweight farm equipment.",
        },
      ],
      forecast10Days: [
        { day: "Today", date: "Sep 22", condition: "Overcast", iconType: "cloud", hi: 26, lo: 19, rainChance: 40, rainfallMm: 3.2, windKmh: 22, humidity: 82, uvIndex: 4, farmingAdvisory: "Inspect seed beds and prepare secondary outflow canals before heavy rain starts." },
        { day: "Wed", date: "Sep 23", condition: "Thunderstorms", iconType: "storm", hi: 24, lo: 18, rainChance: 85, rainfallMm: 38.0, windKmh: 35, humidity: 92, uvIndex: 3, farmingAdvisory: "Cease all field machinery operations to prevent soil compaction and rutting." },
        { day: "Thu", date: "Sep 24", condition: "Heavy Rain", iconType: "rain", hi: 23, lo: 17, rainChance: 90, rainfallMm: 45.0, windKmh: 42, humidity: 95, uvIndex: 2, farmingAdvisory: "Strictly avoid fertilizer broadcast. Monitor field boundary ridges for overflow." },
        { day: "Fri", date: "Sep 25", condition: "Moderate Showers", iconType: "rain", hi: 25, lo: 18, rainChance: 60, rainfallMm: 12.0, windKmh: 24, humidity: 88, uvIndex: 4, farmingAdvisory: "Showers tapering off. Drain standing water from furrow ends." },
        { day: "Sat", date: "Sep 26", condition: "Passing Showers", iconType: "drizzle", hi: 27, lo: 19, rainChance: 35, rainfallMm: 3.5, windKmh: 18, humidity: 79, uvIndex: 5, farmingAdvisory: "Drying cycle begins. Check emerged seedlings for silt crusting." },
        { day: "Sun", date: "Sep 27", condition: "Partly Cloudy", iconType: "cloud-sun", hi: 28, lo: 18, rainChance: 20, rainfallMm: 0, windKmh: 14, humidity: 72, uvIndex: 6, farmingAdvisory: "Sunlight returns. Allow topsoil to aerate naturally before field entry." },
        { day: "Mon", date: "Sep 28", condition: "Sunny", iconType: "sun", hi: 30, lo: 19, rainChance: 10, rainfallMm: 0, windKmh: 12, humidity: 65, uvIndex: 7, farmingAdvisory: "Favorable weather window for prophylactic wheat rust inspection." },
        { day: "Tue", date: "Sep 29", condition: "Sunny", iconType: "sun", hi: 31, lo: 20, rainChance: 5, rainfallMm: 0, windKmh: 10, humidity: 62, uvIndex: 7, farmingAdvisory: "Ample soil moisture from recent rain; pause irrigation pumps." },
        { day: "Wed", date: "Sep 30", condition: "Clear & Bright", iconType: "sun", hi: 32, lo: 20, rainChance: 5, rainfallMm: 0, windKmh: 11, humidity: 58, uvIndex: 8, farmingAdvisory: "Strong photosynthetic conditions for young wheat tillering." },
        { day: "Thu", date: "Oct 01", condition: "Sunny", iconType: "sun", hi: 31, lo: 21, rainChance: 10, rainfallMm: 0, windKmh: 13, humidity: 60, uvIndex: 7, farmingAdvisory: "Stable weather conditions across the Pune agricultural zone." },
      ],
    },
    satellite: {
      meanNdvi: 0.54,
      minNdvi: 0.32,
      maxNdvi: 0.69,
      ndwi: 0.62,
      canopyVigourLabel: "Fair",
      healthyCanopyPercent: 64,
      moderateCanopyPercent: 24,
      stressedCanopyPercent: 12,
      history: [
        { date: "Jul 05", ndvi: 0.18, benchmark: 0.19, stage: "Emergence" },
        { date: "Jul 20", ndvi: 0.30, benchmark: 0.32, stage: "Crown Rooting" },
        { date: "Aug 05", ndvi: 0.44, benchmark: 0.48, stage: "Early Tillering" },
        { date: "Aug 25", ndvi: 0.51, benchmark: 0.56, stage: "Active Tillering" },
        { date: "Sep 15", ndvi: 0.54, benchmark: 0.60, stage: "Stem Elongation" },
      ],
      stressZones: [
        {
          id: "sz-2",
          name: "Eastern Plot Lowland",
          type: "Nutrient Deficit",
          areaAcres: 0.6,
          severity: "moderate",
          description: "Pale green canopy signature (NDVI < 0.38) indicating localized Nitrogen leaching.",
          actionRequired: "Apply targeted top-dress nitrogen booster once field soil drains.",
        },
        {
          id: "sz-3",
          name: "Northern Slope Margin",
          type: "Water Stress",
          areaAcres: 0.3,
          severity: "low",
          description: "Rapid runoff area with slightly depressed vegetative index.",
          actionRequired: "Reinforce contour bund to improve percolation.",
        },
      ],
      metadata: {
        satelliteMission: "ESA Sentinel-2A L2A (BOA Reflectance)",
        acquisitionDate: "2026-09-19 05:18 UTC",
        cloudCoveragePercent: 0.6,
        spatialResolution: "10m Multispectral GSD",
        dataQualityConfidence: 97.5,
        sunElevationAngle: "61.2°",
      },
    },
  },
];

const STORAGE_KEY_BASE = "fasalsetu_farms_v2";
const USER_KEY_BASE = "fasalsetu_user_v2";

// Namespaces local data by the logged-in user's id, so switching accounts on
// the same browser never shows one user's farms/profile to another. Signed-out
// visitors (no account) share a "guest" namespace that carries the demo data —
// real accounts always start from a clean, empty slate.
function scopedKey(base: string): string {
  return `${base}:${getUserId() ?? "guest"}`;
}

export function getStoredFarms(): Farm[] {
  if (typeof window === "undefined") return DEFAULT_FARMS;
  const isGuest = getUserId() === null;
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY_BASE));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Error reading farms from localStorage", e);
  }
  // First visit for this identity: guests get the demo dataset, real accounts
  // start empty until they add their own farm.
  return isGuest ? DEFAULT_FARMS : [];
}

export function saveFarms(farms: Farm[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(scopedKey(STORAGE_KEY_BASE), JSON.stringify(farms));
    window.dispatchEvent(new Event("fasalsetu_farms_updated"));
  } catch (e) {
    console.error("Error saving farms", e);
  }
}

export function useFarmStore() {
  const [farms, setFarms] = useState<Farm[]>(DEFAULT_FARMS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setFarms(getStoredFarms());

    const handleUpdate = () => {
      setFarms(getStoredFarms());
    };

    window.addEventListener("fasalsetu_farms_updated", handleUpdate);
    return () => window.removeEventListener("fasalsetu_farms_updated", handleUpdate);
  }, []);

  function addFarm(newFarm: Farm) {
    const updated = [...farms, newFarm];
    setFarms(updated);
    saveFarms(updated);
  }

  function resetToDefault() {
    setFarms(DEFAULT_FARMS);
    saveFarms(DEFAULT_FARMS);
  }

  return { farms, addFarm, resetToDefault, mounted };
}

// ── Farmer Profile Store ──────────────────────────────────────────────────────

export type FarmerProfile = {
  name: string;
  phone: string;
  state: string;
  preferredLanguage: string;
};

const DEFAULT_PROFILE: FarmerProfile = {
  name: "Farmer",
  phone: "9876543210",
  state: "Maharashtra",
  preferredLanguage: "en",
};

export function getStoredProfile(): FarmerProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(scopedKey(USER_KEY_BASE));
    if (raw) return JSON.parse(raw);
  } catch {
    // localStorage unavailable (private mode, quota) — fall back silently
  }
  return DEFAULT_PROFILE;
}

export function saveProfile(profile: FarmerProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(scopedKey(USER_KEY_BASE), JSON.stringify(profile));
    window.dispatchEvent(new Event("fasalsetu_user_updated"));
  } catch {
    // localStorage unavailable (private mode, quota) — fall back silently
  }
}

export function useUserStore() {
  const [profile, setProfile] = useState<FarmerProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    setProfile(getStoredProfile());
    const handleUpdate = () => setProfile(getStoredProfile());
    window.addEventListener("fasalsetu_user_updated", handleUpdate);
    return () => window.removeEventListener("fasalsetu_user_updated", handleUpdate);
  }, []);

  return { profile, saveProfile };
}

// ── Helper to generate dynamic weather for newly registered farms ─────────────
export function generateFarmWeather(farmName: string, address: string, crop: string): FarmDetailedWeather {
  return {
    currentTemp: 28,
    feelsLike: 30,
    condition: "Partly Cloudy",
    iconType: "cloud-sun",
    humidity: 66,
    windKmh: 15,
    windDir: "NW",
    rainExpected: "5mm in next 3 days",
    uvIndex: 6,
    pressureHpa: 1011,
    alerts: [
      {
        id: "alert-gen-1",
        type: "Crop Advisory",
        severity: "info",
        timeframe: "This Week",
        headline: `Favorable Weather for ${crop}`,
        actionAdvice: `Temperatures and humidity remain within standard agronomic ranges for ${crop}. Keep regular irrigation schedule.`,
      },
    ],
    forecast10Days: [
      { day: "Today", date: "Sep 22", condition: "Partly Cloudy", iconType: "cloud-sun", hi: 30, lo: 21, rainChance: 15, rainfallMm: 0.5, windKmh: 14, humidity: 66, uvIndex: 6, farmingAdvisory: `Optimal day for foliar feed or scouting ${crop} for pests.` },
      { day: "Wed", date: "Sep 23", condition: "Sunny", iconType: "sun", hi: 31, lo: 22, rainChance: 10, rainfallMm: 0, windKmh: 12, humidity: 60, uvIndex: 7, farmingAdvisory: "Mild winds and warm sunshine. Good for tractor operations." },
      { day: "Thu", date: "Sep 24", condition: "Cloudy", iconType: "cloud", hi: 29, lo: 20, rainChance: 30, rainfallMm: 2.0, windKmh: 16, humidity: 72, uvIndex: 5, farmingAdvisory: "Cloud cover increasing. Monitor soil moisture levels." },
      { day: "Fri", date: "Sep 25", condition: "Light Rain", iconType: "rain", hi: 27, lo: 19, rainChance: 60, rainfallMm: 7.5, windKmh: 18, humidity: 82, uvIndex: 4, farmingAdvisory: "Postpone spray operations due to rain wash-off risk." },
      { day: "Sat", date: "Sep 26", condition: "Scattered Showers", iconType: "rain", hi: 26, lo: 19, rainChance: 50, rainfallMm: 5.0, windKmh: 15, humidity: 80, uvIndex: 4, farmingAdvisory: "Ensure open furrows allow excess water to drain freely." },
      { day: "Sun", date: "Sep 27", condition: "Partly Cloudy", iconType: "cloud-sun", hi: 28, lo: 19, rainChance: 20, rainfallMm: 0, windKmh: 11, humidity: 70, uvIndex: 6, farmingAdvisory: "Clearing weather. High soil moisture beneficial for root zones." },
      { day: "Mon", date: "Sep 28", condition: "Sunny", iconType: "sun", hi: 30, lo: 20, rainChance: 5, rainfallMm: 0, windKmh: 10, humidity: 62, uvIndex: 7, farmingAdvisory: "Sunny conditions return. Resume fertilization plan." },
      { day: "Tue", date: "Sep 29", condition: "Sunny", iconType: "sun", hi: 31, lo: 21, rainChance: 5, rainfallMm: 0, windKmh: 9, humidity: 58, uvIndex: 7, farmingAdvisory: "Normal irrigation schedule; monitor soil tensiometers." },
      { day: "Wed", date: "Sep 30", condition: "Clear Skies", iconType: "sun", hi: 32, lo: 21, rainChance: 0, rainfallMm: 0, windKmh: 11, humidity: 55, uvIndex: 8, farmingAdvisory: "Warm dry spell. Adequate hydration recommended." },
      { day: "Thu", date: "Oct 01", condition: "Sunny", iconType: "sun", hi: 31, lo: 20, rainChance: 10, rainfallMm: 0, windKmh: 12, humidity: 60, uvIndex: 7, farmingAdvisory: "Stable conditions across the farm." },
    ],
  };
}
