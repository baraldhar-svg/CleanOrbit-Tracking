import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { createClient } from "@supabase/supabase-js";
import "leaflet/dist/leaflet.css";

// ── Supabase Setup ──────────────────────────────────────────────────────────
// Support both Vite (import.meta.env.VITE_SUPABASE_URL) and Next.js (process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseUrl = 
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL) || 
  "";

const supabaseAnonKey = 
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 
  "";

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ── Types ────────────────────────────────────────────────────────────────────
interface VehicleLocation {
  id: number;
  vehicle_id: number;
  plate_number: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  updated_at: string;
}

// ── Custom SVG Bus Icon Generator ────────────────────────────────────────────
const createBusIcon = (plateNumber: string) => {
  return L.divIcon({
    className: "custom-bus-icon",
    html: `
      <div class="relative flex flex-col items-center select-none cursor-pointer">
        <!-- Ripple effect highlighting live activity -->
        <div class="absolute w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full animate-ping pointer-events-none"></div>
        
        <!-- Bus Body -->
        <div class="relative flex items-center justify-center w-10 h-10 bg-amber-600 border-2 border-white rounded-xl shadow-lg hover:scale-105 transition-all duration-300 z-10">
          <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <!-- Active Status Light -->
          <div class="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        
        <!-- Plate Number Badge -->
        <div class="mt-1 px-2 py-0.5 bg-slate-900/90 text-white border border-slate-700 rounded text-[9px] font-bold tracking-wide shadow-md whitespace-nowrap z-10 uppercase">
          ${plateNumber}
        </div>
      </div>
    `,
    iconSize: [40, 56],
    iconAnchor: [20, 48],
    popupAnchor: [0, -40],
  });
};

export default function VehicleLiveMap() {
  const [locations, setLocations] = useState<Record<number, VehicleLocation>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch initial bus locations from Supabase
  useEffect(() => {
    async function fetchInitialLocations() {
      if (!supabase) {
        setError("Supabase credentials (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) are not configured in the environment.");
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("vehicle_locations")
          .select("*");

        if (error) throw error;

        const initialMap: Record<number, VehicleLocation> = {};
        data?.forEach((loc: VehicleLocation) => {
          initialMap[loc.vehicle_id] = loc;
        });
        setLocations(initialMap);
      } catch (err: any) {
        console.error("Failed to load initial vehicle locations:", err);
        setError(err.message || "Failed to load initial coordinates.");
      } finally {
        setLoading(false);
      }
    }

    fetchInitialLocations();
  }, []);

  // 2. Subscribe to Supabase Realtime postgres_changes
  useEffect(() => {
    if (!supabase) return;
    
    const channel = supabase
      .channel("live_vehicle_locations")
      .on(
        "postgres_changes",
        {
          event: "*", // captures INSERT, UPDATE, DELETE
          schema: "public",
          table: "vehicle_locations",
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          
          setLocations((prev) => {
            const next = { ...prev };
            
            const oldVal = oldRow as Partial<VehicleLocation> | null;
            const newVal = newRow as VehicleLocation | null;

            if (eventType === "DELETE" && oldVal?.vehicle_id) {
              delete next[oldVal.vehicle_id];
            } else if (newVal?.vehicle_id) {
              next[newVal.vehicle_id] = newVal;
            }
            return next;
          });
        }
      )
      .subscribe((status) => {
        console.log("Supabase Realtime subscription status:", status);
      });

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-400 text-sm font-medium animate-pulse">Initializing Orbit tracking map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-900 border border-red-500/20 rounded-2xl p-6 text-center">
        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-white font-semibold text-lg">Connection Error</h3>
        <p className="mt-2 text-slate-400 max-w-sm text-sm">{error}</p>
      </div>
    );
  }

  const activeLocations = Object.values(locations);
  const defaultCenter: [number, number] = [27.7172, 85.3240]; // Default: Kathmandu

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      {/* HUD Header */}
      <div className="absolute top-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-700 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3">
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-white text-xs font-semibold tracking-wider uppercase">
          Live Tracking: {activeLocations.length} active {activeLocations.length === 1 ? "bus" : "buses"}
        </span>
      </div>

      <MapContainer
        center={activeLocations.length > 0 ? [activeLocations[0].latitude, activeLocations[0].longitude] : defaultCenter}
        zoom={14}
        className="w-full h-[600px] z-0"
        scrollWheelZoom={true}
      >
        {/* Dark Mode CartoDB tiles for high-contrast rich aesthetics */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {activeLocations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude]}
            icon={createBusIcon(loc.plate_number)}
          >
            <Popup className="custom-popup">
              <div className="p-3 bg-slate-900 text-white rounded-lg border border-slate-800 min-w-[200px]">
                <h4 className="text-sm font-bold text-amber-500 flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-2">
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Bus: {loc.plate_number}
                </h4>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span>Speed:</span>
                    <span className="font-semibold text-white">
                      {loc.speed !== null ? `${Math.round(loc.speed)} km/h` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Heading:</span>
                    <span className="font-semibold text-white">
                      {loc.heading !== null ? `${Math.round(loc.heading)}°` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latitude:</span>
                    <span className="font-semibold text-slate-400">{loc.latitude.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Longitude:</span>
                    <span className="font-semibold text-slate-400">{loc.longitude.toFixed(6)}</span>
                  </div>
                  <div className="border-t border-slate-800 mt-2.5 pt-2 text-[10px] text-slate-500 text-right">
                    Updated: {new Date(loc.updated_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
