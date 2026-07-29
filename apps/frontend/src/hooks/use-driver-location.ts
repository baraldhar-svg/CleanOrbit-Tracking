/**
 * useDriverLocation — subscribes to live GPS coordinates for a specific driver.
 *
 * Strategy (layered):
 *  1. Immediately polls GET /api/trips/active(?driverId=N) to get last-known coordinates.
 *  2. Opens an SSE stream and listens for `location_update` events (posted every ~3 s by the
 *     driver's mobile via POST /api/trips/location). Events are filtered to the requested driverId
 *     when one is provided.
 *  3. Re-polls /api/trips/active every 10 s as a backstop for missed SSE events.
 *
 * @param driverId - optional: scope to a specific driver. When omitted, returns the first active
 *                   driver in the tenant (backward-compat for single-driver portals).
 */
import { useEffect, useRef, useState } from "react";
import { getTenantId } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface DriverLocation {
  lat: number;
  lng: number;
  isLive: boolean;
  updatedAt: string | null;
  vehicleNumber: string | null;
  speedKmh: number | null;
}

const DEFAULT_LOC: DriverLocation = {
  lat: 27.7172,
  lng: 85.3240,
  isLive: false,
  updatedAt: null,
  vehicleNumber: null,
  speedKmh: null,
};

const STORAGE_KEY = (driverId?: number) => `orbittrack_last_loc_driver_${driverId ?? "any"}`;

function getInitialLoc(driverId?: number): DriverLocation {
  if (typeof window === "undefined") return DEFAULT_LOC;
  try {
    const stored = localStorage.getItem(STORAGE_KEY(driverId));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        return {
          lat: parsed.lat,
          lng: parsed.lng,
          isLive: false,
          updatedAt: parsed.updatedAt || null,
          vehicleNumber: parsed.vehicleNumber || null,
          speedKmh: parsed.speedKmh || null,
        };
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_LOC;
}

export function useDriverLocation(driverId?: number): DriverLocation {
  const [loc, setLoc] = useState<DriverLocation>(() => getInitialLoc(driverId));

  useEffect(() => {
    let destroyed = false;

    function applyUpdate(
      lat: number, lng: number, isLive: boolean, updatedAt: string | null,
      vehicleNumber?: string | null, speedKmh?: number | null
    ) {
      if (destroyed) return;
      const now = Date.now();
      const isRecent = updatedAt != null && (now - new Date(updatedAt).getTime()) < 300_000;
      const effectiveLive = isLive || isRecent;

      setLoc((prev) => {
        const next = {
          lat, lng, isLive: effectiveLive, updatedAt,
          vehicleNumber: vehicleNumber !== undefined && vehicleNumber !== null ? vehicleNumber : prev.vehicleNumber,
          speedKmh: speedKmh !== undefined ? speedKmh : prev.speedKmh,
        };
        try {
          localStorage.setItem(STORAGE_KEY(driverId), JSON.stringify({
            lat: next.lat,
            lng: next.lng,
            updatedAt: next.updatedAt,
            vehicleNumber: next.vehicleNumber,
            speedKmh: next.speedKmh,
          }));
        } catch { /* ignore */ }
        return next;
      });
    }

    const tenantId = getTenantId();
    const headers: Record<string, string> = {};
    if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);

    async function poll() {
      try {
        const url = driverId
          ? `${BASE}/api/trips/active?driverId=${driverId}`
          : `${BASE}/api/trips/active`;
        let r = await fetch(url, { headers });
        if (!r.ok || destroyed) return;
        let d = await r.json() as {
          currentLat?: number; currentLng?: number; isLive?: boolean; locationUpdatedAt?: string | null;
          speedKmh?: number | null; driver?: { vehicleNumber?: string | null };
        };

        // Fallback: If scoped driver returned non-live / missing location, check general active endpoint
        if (driverId != null && (!d.isLive || d.currentLat == null)) {
          const fallbackR = await fetch(`${BASE}/api/trips/active`, { headers });
          if (fallbackR.ok) {
            const fallbackD = await fallbackR.json() as typeof d;
            if (fallbackD.currentLat != null && fallbackD.isLive) {
              d = fallbackD;
            }
          }
        }

        if (d.currentLat != null && d.currentLng != null) {
          applyUpdate(d.currentLat, d.currentLng, d.isLive ?? false, d.locationUpdatedAt ?? null, d.driver?.vehicleNumber ?? null, d.speedKmh ?? null);
        }
      } catch { /* network error — ignore */ }
    }

    void poll();
    const pollInterval = setInterval(poll, 30_000);

    const es = new EventSource(`${BASE}/api/events`);

    es.addEventListener("location_update", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as {
          driverId?: number; lat?: number; lng?: number; updatedAt?: string;
          vehicleNumber?: string | null; speedKmh?: number | null;
        };
        if (d.lat != null && d.lng != null) {
          applyUpdate(d.lat, d.lng, true, d.updatedAt ?? null, d.vehicleNumber ?? null, d.speedKmh ?? null);
        }
      } catch { /* malformed event */ }
    });

    es.addEventListener("trip_completed", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as { driverId?: number };
        if (driverId != null && d.driverId !== driverId) return;
        setLoc((prev) => ({ ...prev, isLive: false }));
      } catch { /* ignore */ }
    });

    return () => {
      destroyed = true;
      clearInterval(pollInterval);
      es.close();
    };
  }, [driverId]);

  return loc;
}
