"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { Layers, Trash2, Edit3, AlertCircle, X } from "lucide-react";

export interface MapViewProps {
  onFieldDrawn?: (
    geojson: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null,
    areaHectares: number
  ) => void;
  initialPolygon?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  flyToCenter?: [number, number];  // fly to without re-mounting map
  showDrawControls?: boolean;      // false = view-only map, no draw toolbar
  className?: string;
  height?: string | number;
}

function MapViewInner({
  onFieldDrawn,
  initialPolygon,
  initialCenter = [78.9629, 20.5937],
  initialZoom = 4.5,
  flyToCenter,
  showDrawControls = true,
  className = "",
  height = "500px",
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [areaHectares, setAreaHectares] = useState<number | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);
  const [activeMode, setActiveMode] = useState<string>("simple_select");
  const [locationError, setLocationError] = useState<string | null>(null);
  const geolocateRef = useRef<mapboxgl.GeolocateControl | null>(null);

  // Keep callbacks and initial values in refs so the map init effect only runs once
  const onFieldDrawnRef = useRef(onFieldDrawn);
  onFieldDrawnRef.current = onFieldDrawn;

  const initialPolygonRef = useRef(initialPolygon);
  const initialCenterRef = useRef(initialCenter);
  const initialZoomRef = useRef(initialZoom);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    if (!token) {
      setTokenMissing(true);
      return;
    }
    setTokenMissing(false);
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: initialCenterRef.current,
      zoom: initialZoomRef.current,
      attributionControl: true,
    });

    mapRef.current = map;

    // Add navigation control (zoom and rotation)
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Initialize Mapbox GeolocateControl for live user GPS tracking
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: false,
      showUserHeading: false,
    });

    geolocateRef.current = geolocate;
    map.addControl(geolocate, "top-right");

    geolocate.on("error", (error: { code?: number; message?: string }) => {
      if (error && error.code === 1) {
        setLocationError("Location permission denied. Please allow location access in your browser to view your live GPS position.");
      } else if (error && error.code === 2) {
        setLocationError("GPS location is unavailable on this device.");
      } else if (error && error.message) {
        setLocationError(error.message);
      }
    });

    geolocate.on("geolocate", () => {
      setLocationError(null);
    });

    // Initialize MapboxDraw — hide native control buttons since we use our own overlay buttons
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {}, // no native buttons; our custom "Draw Field Polygon" overlay handles it
      defaultMode: "simple_select",
    });

    drawRef.current = draw;
    map.addControl(draw, "top-right");

    const calculateAndUpdateArea = (feature?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>) => {
      let activeFeature = feature;
      if (!activeFeature) {
        const all = draw.getAll();
        if (all.features.length > 0) {
          activeFeature = all.features[all.features.length - 1] as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
        }
      }

      if (activeFeature && (activeFeature.geometry.type === "Polygon" || activeFeature.geometry.type === "MultiPolygon")) {
        try {
          const areaSqMeters = turf.area(activeFeature);
          const hectares = Number((areaSqMeters / 10000).toFixed(4));
          setAreaHectares(hectares);
          if (onFieldDrawnRef.current) {
            onFieldDrawnRef.current(activeFeature, hectares);
          }
        } catch (err) {
          console.error("Error computing area preview:", err);
        }
      } else {
        setAreaHectares(null);
        if (onFieldDrawnRef.current) {
          onFieldDrawnRef.current(null, 0);
        }
      }
    };

    // Ensure single polygon by removing any previous features when a new one is created
    const onDrawCreate = (e: { features: GeoJSON.Feature[] }) => {
      const all = draw.getAll();
      if (all.features.length > 1 && e.features && e.features[0]) {
        const latestId = e.features[0].id;
        all.features.forEach((feat) => {
          if (feat.id !== latestId) {
            draw.delete(feat.id as string);
          }
        });
      }
      calculateAndUpdateArea(e.features[0] as GeoJSON.Feature<GeoJSON.Polygon>);
    };

    const onDrawUpdate = (e: { features: GeoJSON.Feature[] }) => {
      if (e.features && e.features[0]) {
        calculateAndUpdateArea(e.features[0] as GeoJSON.Feature<GeoJSON.Polygon>);
      } else {
        calculateAndUpdateArea();
      }
    };

    const onDrawDelete = () => {
      setAreaHectares(null);
      if (onFieldDrawnRef.current) {
        onFieldDrawnRef.current(null, 0);
      }
    };

    const onDrawModeChange = (e: { mode: string }) => {
      setActiveMode(e.mode);
    };

    map.on("draw.create", onDrawCreate);
    map.on("draw.update", onDrawUpdate);
    map.on("draw.delete", onDrawDelete);
    map.on("draw.modechange", onDrawModeChange);

    map.on("load", () => {
      map.resize();
      // If initial polygon is provided, render and fit bounds
      if (initialPolygonRef.current) {
        draw.add(initialPolygonRef.current);
        calculateAndUpdateArea(initialPolygonRef.current);

        try {
          const bbox = turf.bbox(initialPolygonRef.current);
          map.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]],
            ],
            { padding: 50, maxZoom: 16 }
          );
        } catch {
          // fallback if bbox calculation fails
        }
      } else {
        // Only auto-locate on first load if no polygon is set
        if (typeof window !== "undefined" && "geolocation" in navigator) {
          try {
            geolocate.trigger();
          } catch (err) {
            console.warn("Geolocation trigger failed:", err);
          }
        } else {
          setLocationError("Geolocation is not supported by your browser/device.");
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      geolocateRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← Empty deps: map initialises once and never re-mounts

  // Fly to a new location without re-initialising the map
  useEffect(() => {
    if (!flyToCenter || !mapRef.current) return;
    const map = mapRef.current;
    const fly = () => map.flyTo({ center: flyToCenter, zoom: 14, duration: 1800, essential: true });
    if (map.isStyleLoaded()) {
      fly();
    } else {
      map.once("load", fly);
    }
  }, [flyToCenter]);

  const handleStartDraw = () => {
    if (drawRef.current) {
      // Clear any previous polygon before drawing new one
      drawRef.current.deleteAll();
      setAreaHectares(null);
      drawRef.current.changeMode("draw_polygon");
      setActiveMode("draw_polygon");
    }
  };

  const handleClear = () => {
    if (drawRef.current) {
      drawRef.current.deleteAll();
      setAreaHectares(null);
      if (onFieldDrawn) {
        onFieldDrawn(null, 0);
      }
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-farm-border-color shadow-card ${className}`}
      style={{ height }}
    >
      {/* Mapbox Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Missing Token Banner */}
      {tokenMissing && (
        <div className="absolute top-4 left-4 right-4 z-20 bg-amber-500/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg max-w-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>NEXT_PUBLIC_MAPBOX_TOKEN</strong> is not set. Add your public token in <code>.env.local</code> to render satellite tiles.
          </span>
        </div>
      )}

      {/* Location Permission / Error Banner */}
      {locationError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 text-white border border-amber-500/40 backdrop-blur-md px-4 py-2 rounded-xl text-xs flex items-center gap-2.5 shadow-xl max-w-md animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="flex-1 leading-snug">{locationError}</span>
          <button
            type="button"
            onClick={() => setLocationError(null)}
            className="p-1 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Field Drawing Toolbar — only shown during farm registration */}
      {showDrawControls && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartDraw}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-card transition-all ${
              activeMode === "draw_polygon"
                ? "bg-farm-green text-white ring-2 ring-white"
                : "bg-white/95 text-farm-dark hover:bg-farm-green-light hover:text-farm-green"
            }`}
            title="Draw a new field boundary"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {activeMode === "draw_polygon" ? "Click to plot points…" : "Draw Field Polygon"}
          </button>

          {areaHectares !== null && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/95 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold shadow-card transition-all"
              title="Delete current polygon"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Live Area Preview Badge — only shown during farm registration */}
      {showDrawControls && (
        areaHectares !== null ? (
          <div className="absolute bottom-5 left-4 z-10 bg-white/95 backdrop-blur-md border border-farm-border-color shadow-hero px-4 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="w-10 h-10 rounded-xl bg-farm-green-light flex items-center justify-center text-farm-green flex-shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-farm-muted font-semibold">
                Live Field Area
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-farm-dark">
                  {areaHectares.toFixed(2)} ha
                </span>
                <span className="text-xs font-medium text-farm-muted">
                  ({(areaHectares * 2.47105).toFixed(2)} acres)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute bottom-5 left-4 z-10 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-farm-green animate-pulse" />
            Use polygon tool to trace your field boundary
          </div>
        )
      )}
    </div>
  );
}

// Dynamically load with ssr: false
export const MapView = dynamic(() => Promise.resolve(MapViewInner), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-farm-gray rounded-2xl flex items-center justify-center text-farm-muted border border-farm-border-color">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-farm-green border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading satellite map...</span>
      </div>
    </div>
  ),
});

export default MapView;
