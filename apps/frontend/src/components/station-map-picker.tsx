import { useEffect, useRef, useState, useCallback } from "react";
import {
  Search, RefreshCw, MapPin, X, CheckCircle,
  SlidersHorizontal, Maximize2, ChevronDown, Crosshair, Pencil,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const KTM  = { lat: 27.7172, lng: 85.324 };

interface Suggestion {
  placeId: string; description: string; mainText: string; secondaryText: string;
}
interface PlaceDetail {
  lat: number; lng: number; name: string; formattedAddress: string;
}

export interface StationMapPickerProps {
  /** "add" = stays open after save; "edit" = closes after save */
  mode?: "add" | "edit";
  /** Pre-fill for edit mode */
  initialStation?: { name: string; lat: number; lng: number; radius: number };
  onConfirm: (s: { name: string; lat: number; lng: number; radius: number }) => Promise<void>;
  /** Called when the admin explicitly closes the picker */
  onClose: () => void;
  /** Existing stations in the route to be drawn on the map picker */
  existingStations?: Array<{
    name?: string | null;
    stationName?: string | null;
    stopLabel?: string | null;
    lat: number | null;
    lng: number | null;
    radius?: number | null;
    position?: number | null;
    direction?: string | null;
  }>;
}

export default function StationMapPicker({
  mode = "add",
  initialStation,
  onConfirm,
  onClose,
  existingStations,
}: StationMapPickerProps) {

  // ── Leaflet refs ─────────────────────────────────────────────────────────
  const mapDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef    = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRef = useRef<any>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isMapOpen,   setIsMapOpen]   = useState(mode === "edit");
  const [picked,      setPicked]      = useState<PlaceDetail | null>(
    initialStation
      ? { lat: initialStation.lat, lng: initialStation.lng,
          name: initialStation.name, formattedAddress: `${initialStation.lat.toFixed(5)}, ${initialStation.lng.toFixed(5)}` }
      : null
  );
  const [stationName, setStationName] = useState(initialStation?.name ?? "");
  const [radius,      setRadius]      = useState(initialStation?.radius ?? 100);
  const [saving,      setSaving]      = useState(false);
  const [saveErr,     setSaveErr]     = useState("");
  const [lastAdded,   setLastAdded]   = useState("");   // success flash
  const [gpsLoading,  setGpsLoading]  = useState(false);

  // ── Search state ─────────────────────────────────────────────────────────
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query,       setQuery]       = useState("");
  const [searching,   setSearching]   = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDrop,    setShowDrop]    = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const [fetching,    setFetching]    = useState(false);

  // ── Place pin + geofence ─────────────────────────────────────────────────
  const placePin = useCallback((lat: number, lng: number, r?: number) => {
    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;
      const useR = r ?? radius;

      markerRef.current?.remove(); markerRef.current = null;
      circleRef.current?.remove(); circleRef.current = null;

      circleRef.current = L.circle([lat, lng], {
        radius: useR, color: "#f59e0b", weight: 2,
        fillColor: "#f59e0b", fillOpacity: 0.15, dashArray: "6 4",
      }).addTo(map);

      const icon = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:grab">
          <div style="background:#f59e0b;border:3px solid #fff;border-radius:50%;
               width:22px;height:22px;box-shadow:0 3px 10px rgba(0,0,0,.5)"></div>
          <div style="width:2px;height:10px;background:#f59e0b"></div>
        </div>`,
        className: "", iconSize: [22, 32], iconAnchor: [11, 32],
      });
      const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        setPicked((prev) => prev ? { ...prev, lat: p.lat, lng: p.lng } : {
          lat: p.lat, lng: p.lng, name: "Custom Location",
          formattedAddress: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
        });
        placePin(p.lat, p.lng);
      });
      markerRef.current = marker;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { animate: true, duration: 0.8 });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius]);

  // Redraw circle when radius changes
  useEffect(() => {
    if (picked) placePin(picked.lat, picked.lng, radius);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius]);

  // ── Init Leaflet (always-mounted div) ─────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapDivRef.current) return;
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    import("leaflet").then((L) => {
      if (mapRef.current) return;
      const center: [number, number] = initialStation
        ? [initialStation.lat, initialStation.lng]
        : [KTM.lat, KTM.lng];

      const map = L.map(mapDivRef.current!, {
        center, zoom: initialStation ? 16 : 13,
        zoomControl: true, attributionControl: false,
        scrollWheelZoom: true, doubleClickZoom: false,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        { maxZoom: 19, subdomains: "abcd" }
      ).addTo(map);

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;
        setPicked({ lat, lng, name: "Custom Location", formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
        setShowDrop(false);
        placePin(lat, lng);
      });

      mapRef.current = map;
      // If edit mode — place pin immediately
      if (initialStation) placePin(initialStation.lat, initialStation.lng, initialStation.radius);
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      mapRef.current?.remove();
      mapRef.current = null; markerRef.current = null; circleRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Invalidate map size when fullscreen opens
  useEffect(() => {
    if (!isMapOpen) return;
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 80);
    return () => clearTimeout(id);
  }, [isMapOpen]);

  // ── Back Navigation Popstate Fix ──────────────────────────────────────────
  useEffect(() => {
    if (isMapOpen) {
      if (window.history.state?.mapOpen !== true) {
        window.history.pushState({ mapOpen: true }, "");
      }
    } else {
      if (window.history.state?.mapOpen === true) {
        window.history.back();
      }
    }
  }, [isMapOpen]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isMapOpen) {
        setIsMapOpen(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isMapOpen]);

  useEffect(() => {
    return () => {
      if (window.history.state?.mapOpen === true) {
        window.history.back();
      }
    };
  }, []);

  // ── Render existing stations and route path ──
  const existingLayersRef = useRef<any[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old layers
    existingLayersRef.current.forEach((layer) => layer.remove());
    existingLayersRef.current = [];

    import("leaflet").then((L) => {
      if (!mapRef.current) return;

      const layers: any[] = [];
      const points: [number, number][] = [];

      // 1. Draw existing stations
      if (existingStations) {
        existingStations.forEach((s, idx) => {
          if (s.lat == null || s.lng == null) return;
          points.push([s.lat, s.lng]);

          const label = s.stopLabel || s.stationName || s.name || `Station ${idx + 1}`;
          
          // Render a custom marker with the index of the stop
          const icon = L.divIcon({
            html: `<div style="display:flex;flex-direction:column;align-items:center;">
              <div style="background:#3b82f6;border:2px solid #fff;border-radius:50%;
                   width:18px;height:18px;box-shadow:0 2px 5px rgba(0,0,0,.3);
                   display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:bold;">
                ${idx + 1}
              </div>
            </div>`,
            className: "", iconSize: [18, 18], iconAnchor: [9, 9],
          });

          const marker = L.marker([s.lat, s.lng], { icon })
            .addTo(map)
            .bindTooltip(`${idx + 1}. ${label}`, { permanent: false, direction: "top" });
          
          layers.push(marker);
        });
      }

      // 2. Draw route path line
      if (points.length > 1) {
        const polyline = L.polyline(points, {
          color: "#3b82f6",
          weight: 3,
          opacity: 0.6,
          dashArray: "6 4"
        }).addTo(map);

        layers.push(polyline);
      }

      existingLayersRef.current = layers;
    });
  }, [existingStations, isMapOpen]);

  // ── GPS ───────────────────────────────────────────────────────────────────
  function handleGPS() {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const detail: PlaceDetail = {
          lat, lng, name: "My Location",
          formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        };
        setPicked(detail);
        placePin(lat, lng);
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  // ── Search ────────────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setShowDrop(false); return; }
    setSearching(true); setShowDrop(true); setActiveIdx(-1);
    try {
      const res = await fetch(`${BASE}/api/geocode/places?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        setSuggestions(await res.json() as Suggestion[]);
      } else {
        const r2 = await fetch(`${BASE}/api/geocode?q=${encodeURIComponent(q)}`);
        const d2 = await r2.json() as Array<{ displayName: string }>;
        setSuggestions(d2.map((x, i) => ({
          placeId: `nominatim_${i}`, description: x.displayName,
          mainText: x.displayName.split(",")[0] ?? x.displayName,
          secondaryText: x.displayName.split(",").slice(1, 3).join(", ").trim(),
        })));
      }
    } catch { setSuggestions([]); }
    finally { setSearching(false); }
  }, []);

  function handleSearchChange(val: string) {
    setQuery(val);
    if (!val.trim()) { setSuggestions([]); setShowDrop(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDrop || !suggestions.length) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pickSuggestion(suggestions[activeIdx]); }
    else if (e.key === "Escape")    { setShowDrop(false); setActiveIdx(-1); }
  }

  async function pickSuggestion(s: Suggestion) {
    setShowDrop(false); setActiveIdx(-1); setQuery(s.mainText);
    setFetching(true);
    try {
      const r = await fetch(`${BASE}/api/geocode?q=${encodeURIComponent(s.description)}`);
      const d = await r.json() as Array<{ lat: number; lng: number; displayName: string }>;
      if (d[0]) {
        const detail: PlaceDetail = {
          lat: d[0].lat, lng: d[0].lng,
          name: s.mainText, formattedAddress: d[0].displayName,
        };
        setPicked(detail);
        setStationName((n) => n || s.mainText);
        placePin(d[0].lat, d[0].lng);
      }
    } catch { /* ignore */ }
    finally { setFetching(false); }
    inputRef.current?.focus();
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!picked || !stationName.trim()) return;
    setSaveErr(""); setSaving(true);
    try {
      await onConfirm({ name: stationName.trim(), lat: picked.lat, lng: picked.lng, radius });

      if (mode === "edit") {
        onClose(); // edit mode: close after save
      } else {
        // add mode: flash success, reset form, keep map open for next station
        const savedName = stationName.trim();
        setLastAdded(savedName);
        setTimeout(() => setLastAdded(""), 3500);
        setQuery(""); setPicked(null); setStationName(""); setRadius(100);
        setShowDrop(false); setSuggestions([]);
        markerRef.current?.remove(); markerRef.current = null;
        circleRef.current?.remove(); circleRef.current = null;
      }
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : "Failed to save station");
    } finally { setSaving(false); }
  }

  const hasPick = picked !== null;

  // ── Search bar (reused in fullscreen + card) ──────────────────────────────
  const searchBar = (
    <div className="relative">
      {searching || fetching
        ? <RefreshCw size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 animate-spin pointer-events-none z-10" />
        : <Search    size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
      }
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => handleSearchChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setShowDrop(true)}
        onBlur={() => setTimeout(() => setShowDrop(false), 180)}
        placeholder="Search — Koteshwor, Bhaktapur, Kirtipur…"
        autoComplete="off"
        className="w-full rounded-xl border border-border bg-muted/40 pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500 focus:bg-card transition-colors"
      />
      {query && (
        <button
          onMouseDown={(e) => { e.preventDefault(); setQuery(""); setSuggestions([]); setShowDrop(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X size={13} />
        </button>
      )}
      {showDrop && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[600] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          {searching ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <RefreshCw size={11} className="animate-spin text-amber-500" /> Searching…
            </div>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">No results — try a different name</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto divide-y divide-border/60">
              {suggestions.map((s, i) => (
                <li key={s.placeId}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${i === activeIdx ? "bg-amber-50 dark:bg-amber-950/30" : "hover:bg-muted/60"}`}
                  >
                    <MapPin size={13} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-tight">{s.mainText}</p>
                      {s.secondaryText && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{s.secondaryText}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ══ FULLSCREEN MAP — always mounted, toggled via CSS display ════════ */}
      <div
        style={{ display: isMapOpen ? "flex" : "none" }}
        className="fixed inset-0 z-[9000] flex-col bg-background"
      >
        {/* Top bar */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800">
          <MapPin size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide flex-1">
            {mode === "edit" ? "Edit Station Location" : "Add Station — Select Location"}
          </span>
          <button
            onClick={() => setIsMapOpen(false)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted rounded-lg px-3 py-1.5 transition-colors"
          >
            <ChevronDown size={13} /> Back to Form
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 px-4 pt-3 pb-2 relative">{searchBar}</div>

        {/* Map */}
        <div className="relative flex-1 overflow-hidden">
          <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />

          {/* GPS button */}
          <button
            onClick={handleGPS}
            disabled={gpsLoading}
            title="Use my GPS location"
            className="absolute bottom-4 right-4 z-[500] flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-border shadow-lg px-3 py-2 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            {gpsLoading
              ? <RefreshCw size={13} className="animate-spin text-amber-500" />
              : <Crosshair size={13} className="text-amber-500" />
            }
            {gpsLoading ? "Locating…" : "My Location"}
          </button>

          {/* Hint when nothing pinned */}
          {!hasPick && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-black/60 text-white text-[11px] font-medium rounded-full px-4 py-1.5 pointer-events-none whitespace-nowrap">
              Tap the map to drop a pin · Or search above
            </div>
          )}
        </div>

        {/* Bottom action */}
        <div className="shrink-0 border-t border-border bg-card px-4 py-3">
          {/* Success flash (add mode) */}
          {lastAdded && (
            <div className="flex items-center gap-2 mb-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
              <CheckCircle size={13} className="text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-xs font-semibold text-green-700 dark:text-green-300">
                ✓ "{lastAdded}" added! Drop another pin to add more.
              </p>
            </div>
          )}
          {hasPick ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate">
                  📍 {picked.formattedAddress}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
                </p>
              </div>
              <button
                onClick={() => setIsMapOpen(false)}
                className="shrink-0 flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 transition-colors"
              >
                <CheckCircle size={14} /> Use This Location
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-0.5">
              Tap the map or search to drop a pin
            </p>
          )}
        </div>
      </div>

      {/* ══ COMPACT CARD ════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-card overflow-visible shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 rounded-t-2xl">
          <div className="flex items-center gap-2">
            {mode === "edit"
              ? <Pencil size={13} className="text-amber-600 dark:text-amber-400" />
              : <MapPin  size={13} className="text-amber-600 dark:text-amber-400" />
            }
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
              {mode === "edit" ? "Edit Station" : "Add New Station"}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Success flash in card (add mode) */}
        {lastAdded && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
            <CheckCircle size={13} className="text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-xs font-semibold text-green-700 dark:text-green-300">
              ✓ "{lastAdded}" added to route!
            </p>
          </div>
        )}

        {/* Location section */}
        <div className="px-4 pt-3 pb-3">
          {hasPick ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 flex items-start gap-2">
              <CheckCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Location Pinned</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{picked.formattedAddress}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{picked.lat.toFixed(6)}, {picked.lng.toFixed(6)}</p>
              </div>
              <button
                onClick={() => setIsMapOpen(true)}
                className="shrink-0 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 font-semibold mt-0.5"
              >
                <Maximize2 size={10} /> Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsMapOpen(true)}
              className="w-full rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 py-6 flex flex-col items-center gap-2 hover:bg-amber-50/60 dark:hover:bg-amber-950/20 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                <MapPin size={18} className="text-amber-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Open Map to Select Location</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Search or tap map to drop a pin</p>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 mt-0.5">
                <Maximize2 size={10} /> Open Fullscreen Map
              </span>
            </button>
          )}
        </div>

        {/* Station name + radius */}
        {hasPick && (
          <div className="px-4 pb-3 space-y-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Station Name</label>
              <input
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="e.g. Koteshwor Bus Stop"
                autoFocus={hasPick}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <SlidersHorizontal size={9} /> Geofence Radius
                </label>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{radius}m</span>
              </div>
              <input
                type="range" min={50} max={500} step={10}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                <span>50m</span><span>Street</span><span>200m</span><span>Junction</span><span>500m</span>
              </div>
            </div>
          </div>
        )}

        {/* Save */}
        <div className="px-4 pb-4">
          {saveErr && <p className="text-[10px] text-red-500 mb-2">{saveErr}</p>}
          <button
            onClick={handleConfirm}
            disabled={!hasPick || !stationName.trim() || saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors"
          >
            {saving
              ? <><RefreshCw size={13} className="animate-spin" /> Saving…</>
              : mode === "edit"
              ? <><CheckCircle size={13} /> Save Changes</>
              : <><CheckCircle size={13} /> Add Station to Route</>
            }
          </button>
          {mode === "add" && hasPick && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              After saving, the map stays open so you can add more stations.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
