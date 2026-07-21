import { useState, useEffect, useRef } from "react";
import { useListRoutes, useListPassengers, useBoardPassenger, useUnboardPassenger, usePatchDriver, useListDrivers, useSendBoardingOtp, getListPassengersQueryKey, getListAnnouncementsQueryKey, getListDriversQueryKey, getTenantId, useListTripHistory } from "@workspace/api-client-react";
import { PhotoPicker } from "@/components/photo-picker";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { sendDriverMessage } from "@/lib/driver-messages";
import {
  Navigation, Flag, WifiOff, BellOff, CheckCircle, Home,
  MessageSquare, Send, Megaphone, AlertTriangle, Users, Building2,
  Wrench, Clock, Bus, CloudRain, Gauge, MapPin, Bell, History as HistoryIcon, X, User,
  Phone, Mail, Globe, Facebook, Instagram, Youtube,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const QUICK_MESSAGES = [
  { Icon: Navigation,     text: "Traffic jam on route" },
  { Icon: AlertTriangle,  text: "Road is under construction" },
  { Icon: Wrench,         text: "Tire is punctured" },
  { Icon: Gauge,          text: "Fuel is low" },
  { Icon: Clock,          text: "Running late" },
  { Icon: Bus,            text: "Bus breakdown" },
  { Icon: CheckCircle,    text: "All clear, back on route" },
  { Icon: CloudRain,      text: "Bad weather conditions" },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SAFETY_SCORE = 91;
const DISTANCE_KM = 12.4;
const TRIPS_TODAY = 2;
const SPEED_ALERT_THRESHOLD_KMH = 60;

function Avatar({ name, photoUrl, size = "md" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" }) {
  const src = photoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=1e293b&textColor=f59e0b&fontSize=36`;
  const cls = size === "sm" ? "h-9 w-9" : "h-12 w-12";
  return <img src={src} alt={name} className={`${cls} rounded-full border-2 border-slate-600 object-cover shrink-0`} />;
}

function ScoreRing({ score }: { score: number }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 85 ? "#22c55e" : score >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

// ── Stable phone normalization (module-level so lazy useState inits can call it) ──
function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s\-()]/g, "");
  if (s.startsWith("+977")) return s.slice(4);
  if (s.startsWith("977") && s.length > 10) return s.slice(3);
  return s;
}

// ── LocalStorage keys — keyed on normalized session PHONE, not driver DB id ──────
// Phone comes from the auth context and is available SYNCHRONOUSLY on the first render,
// before the drivers API call resolves. This is the property that allows lazy useState
// initializers (below) to read storage at render-zero and avoid the offline UI flash.
const mkLiveKey    = (phone: string) => `orbittrack_live_${phone}`;
const mkJourneyKey = (phone: string) => `orbittrack_journey_${phone}`;

function ensureExternalLink(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function TikTokIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

export default function DriverPortal({ tenant }: { tenant?: any }) {
  const { user, login } = useAuth();
  const [driverProfileOpen, setDriverProfileOpen] = useState(false);
  // Route list used to find THIS driver's assigned route → scope the station navigator
  const { data: routes } = useListRoutes();
  const { data: passengers, refetch } = useListPassengers();
  const boardPassenger = useBoardPassenger();
  const unboardPassenger = useUnboardPassenger();
  const sendBoardingOtp = useSendBoardingOtp();
  const patchDriver = usePatchDriver();
  const { data: drivers } = useListDrivers();
  const queryClient = useQueryClient();

  // Stable key derived from auth context — available before the drivers API call resolves.
  const sessionPhone = user?.phone ? normalizePhone(user.phone) : null;

  const myDriver = drivers?.find(
    (d) => normalizePhone(d.phone) === normalizePhone(user?.phone ?? "")
  );
  // drivers loaded but no phone match — show a clear error rather than wrong driver data
  const driverNotLinked = drivers !== undefined && myDriver === undefined;

  // Sync local driver photo + gender from API once myDriver loads
  useEffect(() => {
    if (myDriver?.photoUrl) setLocalDriverPhoto(myDriver.photoUrl);
    setLocalDriverGender(myDriver?.gender ?? "");
  }, [myDriver?.id, myDriver?.photoUrl, myDriver?.gender]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveDriverPhoto() {
    if (!myDriver?.id || !user) return;
    setDriverPhotoSaving(true);
    setDriverPhotoSaved(false);
    try {
      await patchDriver.mutateAsync({ id: myDriver.id, data: { photoUrl: localDriverPhoto || undefined, gender: localDriverGender || undefined } });
      queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
      // Sync photo to auth user so the top-right avatar updates
      const res = await fetch(`${BASE}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, name: user.name, title: user.title ?? null, photoUrl: localDriverPhoto || null }),
      });
      if (res.ok) {
        const data = await res.json() as { photoUrl?: string | null };
        login({ ...user, photoUrl: data.photoUrl ?? localDriverPhoto ?? null });
      }
      setDriverPhotoSaved(true);
      setDriverProfileOpen(false);
      setTimeout(() => setDriverPhotoSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setDriverPhotoSaving(false); }
  }

  // Derive this driver's assigned route from the routes list
  const myRoute = myDriver
    ? ((routes ?? []) as Array<{ id: number; driverId?: number | null }>).find((r) => r.driverId === myDriver.id) ?? null
    : null;

  const { data: myTripHistory } = useListTripHistory(
    myDriver?.id != null ? { driverId: myDriver.id, limit: 30 } : undefined
  );

  // Route-specific station list — populated by fetching /routes/:id/stations so the
  // Route Navigator only shows stops on THIS driver's assigned route, never all-tenant stops.
  type DriverRouteStation = {
    id: number; stationId: number; position: number; direction: string;
    stopLabel: string | null; stationName: string | null;
    lat: number | null; lng: number | null; radius: number | null;
  };
  const [driverStations, setDriverStations] = useState<DriverRouteStation[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  // Ticker: cycles through upcoming-station users in the GPS bar
  const [tickerIdx, setTickerIdx] = useState(0);

  const [stationIdx, setStationIdx] = useState(0);
  const [boardingId, setBoardingId] = useState<number | null>(null);
  const [unboardingId, setUnboardingId] = useState<number | null>(null);
  const [sosActive, setSosActive] = useState(false);

  // ── Lazy state initializers — read localStorage SYNCHRONOUSLY on first render ──
  // Because sessionPhone comes from the auth context (not an API call), it is defined
  // before the first paint. This eliminates the "offline flash" where the driver sees
  // the grey "Go Online" banner for a moment before the hydration effect fires.
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (!sessionPhone) return true;
    return localStorage.getItem(mkLiveKey(sessionPhone)) !== "ONLINE";
  });
  const [journeyStarted, setJourneyStarted] = useState<boolean>(() => {
    if (!sessionPhone) return false;
    try {
      const raw = localStorage.getItem(mkJourneyKey(sessionPhone));
      if (!raw) return false;
      return (JSON.parse(raw) as { started?: boolean }).started === true;
    } catch { return false; }
  });
  const [journeyTime, setJourneyTime] = useState<string | null>(() => {
    if (!sessionPhone) return null;
    try {
      const raw = localStorage.getItem(mkJourneyKey(sessionPhone));
      if (!raw) return null;
      return (JSON.parse(raw) as { time?: string }).time ?? null;
    } catch { return null; }
  });

  const [journeyCompleted, setJourneyCompleted] = useState(false);
  const [completedTime, setCompletedTime] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [quickMsgOpen, setQuickMsgOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState("");
  const [lastSent, setLastSent] = useState<string | null>(null);

  const [delayAlertOpen, setDelayAlertOpen] = useState(false);
  const [selectedDelay, setSelectedDelay] = useState<number>(10);
  const [delayPending, setDelayPending] = useState(false);
  const [driverPhotoSaving, setDriverPhotoSaving] = useState(false);
  const [driverPhotoSaved, setDriverPhotoSaved] = useState(false);
  const [localDriverPhoto, setLocalDriverPhoto] = useState<string>("");
  const [localDriverGender, setLocalDriverGender] = useState<string>("");
  const [delayToast, setDelayToast] = useState<string | null>(null);

  // GPS tracking — driver's phone as the live tracker
  const watchIdRef = useRef<number | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [overspeedAlert, setOverspeedAlert] = useState(false);
  const lastPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);

  const BASE_GPS = import.meta.env.BASE_URL.replace(/\/$/, "");

  function startGpsTracking() {
    if (!("geolocation" in navigator)) {
      setGpsError("GPS not supported on this device");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setGpsActive(true);
        setGpsError(null);
        const { latitude: lat, longitude: lng, accuracy, speed } = position.coords;
        setDriverPos({ lat, lng });

        // Prefer device-reported speed (m/s → km/h); fall back to distance/time between fixes.
        const now = Date.now();
        let computedSpeedKmh: number | null = typeof speed === "number" && speed >= 0 ? speed * 3.6 : null;
        if (computedSpeedKmh == null && lastPosRef.current) {
          const dtHours = (now - lastPosRef.current.t) / 3_600_000;
          if (dtHours > 0) {
            const distKm = haversineKm(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng);
            const candidate = distKm / dtHours;
            if (Number.isFinite(candidate) && candidate <= 150) computedSpeedKmh = candidate;
          }
        }
        lastPosRef.current = { lat, lng, t: now };
        if (computedSpeedKmh != null) {
          setSpeedKmh(computedSpeedKmh);
          setOverspeedAlert(computedSpeedKmh > SPEED_ALERT_THRESHOLD_KMH);
        }

        const tenantId = getTenantId();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);
        // Fire-and-forget — non-blocking
        void fetch(`${BASE_GPS}/api/trips/location`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            lat,
            lng,
            accuracy,
            speed: typeof speed === "number" && speed >= 0 ? speed : undefined,
            driverId: myDriver?.id,
            vehicleNo: myDriver?.vehicleNumber,
          }),
        });
      },
      (err) => {
        setGpsActive(false);
        if (err.code === 1) setGpsError("GPS permission denied — enable location");
        else if (err.code === 2) setGpsError("GPS signal unavailable");
        else setGpsError("GPS error");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  }

  function stopGpsTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsActive(false);
    setSpeedKmh(null);
    setOverspeedAlert(false);
    lastPosRef.current = null;
  }

  // Cleanup on unmount
  useEffect(() => () => stopGpsTracking(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect A: Server re-sync ────────────────────────────────────────────────
  // Fires once when myDriver resolves (the API call returns). If the driver was
  // live (isOffline=false restored from localStorage), re-signal the server so
  // isOnline stays true — the heartbeat watchdog may have timed them out while
  // they were navigating away.
  useEffect(() => {
    if (!myDriver?.id || isOffline) return;
    void patchDriver
      .mutateAsync({ id: myDriver.id, data: { isOnline: true } })
      .catch(() => { /* non-blocking */ });
    queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
  }, [myDriver?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect B: GPS auto-resume ───────────────────────────────────────────────
  // Fires when myDriver resolves AND journeyStarted=true (restored from storage).
  // Re-attaches navigator.geolocation.watchPosition so the GPS ping stream
  // resumes immediately — no manual "Start Journey" tap required.
  useEffect(() => {
    if (!myDriver?.id || !journeyStarted || journeyCompleted) return;
    if (watchIdRef.current !== null) return; // already running
    startGpsTracking();
  }, [myDriver?.id, journeyStarted, journeyCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect D: broadcast station index to backend on every Next/Prev tap ─────
  // Fires when stationIdx changes during an active journey. The backend persists
  // it in-memory and broadcasts `station_changed` SSE so student portals update
  // to the exact stop name without needing GPS telemetry.
  const lastBroadcastIdx = useRef<number | null>(null);
  useEffect(() => {
    if (!journeyStarted || journeyCompleted || !myDriver?.id) return;
    if (lastBroadcastIdx.current === stationIdx) return;
    lastBroadcastIdx.current = stationIdx;
    const station = driverStations[stationIdx];
    const tenantId = getTenantId();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);
    fetch(`${BASE_GPS}/api/trips/station`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        driverId: myDriver.id,
        stationIdx,
        stationName: station?.stopLabel || station?.stationName || null,
      }),
    }).catch(() => { /* fire-and-forget — UI is already updated locally */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationIdx, journeyStarted, journeyCompleted, myDriver?.id]);

  // ── Effect C: fetch THIS driver's route stations ────────────────────────────
  // Also polls every 30s so admin-added stops appear without a page reload.
  const fetchStations = useRef<() => void>(() => {});
  useEffect(() => {
    if (!myRoute?.id) {
      setDriverStations([]);
      setStationIdx(0);
      setLoadingStations(false);
      fetchStations.current = () => {};
      return;
    }
    const doFetch = (initial = false) => {
      if (initial) setLoadingStations(true);
      const tenantId = getTenantId();
      const headers: Record<string, string> = {};
      if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);
      fetch(`${BASE_GPS}/api/routes/${myRoute.id}/stations`, { headers })
        .then((r) => r.json())
        .then((data: unknown) => {
          setDriverStations(Array.isArray(data) ? (data as DriverRouteStation[]) : []);
          if (initial) setStationIdx(0);
        })
        .catch(() => { if (initial) setDriverStations([]); })
        .finally(() => { if (initial) setLoadingStations(false); });
    };
    fetchStations.current = () => doFetch(false);
    doFetch(true);
    const intervalId = setInterval(() => doFetch(false), 30_000);
    return () => clearInterval(intervalId);
  }, [myRoute?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ticker: cycle through upcoming-station users every 3s ──────────────────
  useEffect(() => {
    if (!journeyStarted || journeyCompleted) return;
    const id = setInterval(() => setTickerIdx((i) => i + 1), 3000);
    return () => clearInterval(id);
  }, [journeyStarted, journeyCompleted]);

  // currentStation is scoped to THIS route — uses route_station row, not global station
  const currentStation = driverStations[stationIdx] ?? null;

  // Exclude other drivers from the rider list — drivers are registered as passengers
  // in the same school but must not appear in the boarding checklist or counts.
  const riderPassengers = (passengers ?? []).filter((p) => p.role !== "driver");

  const boardedCount = riderPassengers.filter((p) => p.status === "boarded").length;
  const totalCount = riderPassengers.length;
  const liveTodayPassengers = riderPassengers.filter((p) => p.liveToday === 1);
  const withMessages = riderPassengers.filter((p) => p.quickMessage);
  const onLeavePassengers = riderPassengers.filter((p) => p.quickMessage === "Staying home today");

  // Bus is "near school" when driver reaches the last station (≤ 200 m perimeter)
  const nearSchool = driverStations.length > 0 && stationIdx === driverStations.length - 1;

  // 500 m geo-fence: use live GPS if available, otherwise fall back to station index
  const lastStation = driverStations.length > 0 ? driverStations[driverStations.length - 1] : undefined;
  const distToSchoolKm =
    driverPos != null && lastStation?.lat != null && lastStation?.lng != null
      ? haversineKm(driverPos.lat, driverPos.lng, lastStation.lat, lastStation.lng)
      : null;
  const nearSchool500m = distToSchoolKm != null ? distToSchoolKm <= 0.5 : nearSchool;

  const handleBoard = async (id: number) => {
    setBoardingId(id);
    try {
      const otpRes = await sendBoardingOtp.mutateAsync({ id });
      const otp = otpRes.demoCode ?? "000000";
      await boardPassenger.mutateAsync({ id, data: { otp } });
      queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
      refetch();
    } finally { setBoardingId(null); }
  };

  const handleUnboard = async (id: number) => {
    setUnboardingId(id);
    try {
      await unboardPassenger.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
      refetch();
    } finally { setUnboardingId(null); }
  };

  const [notifyingId, setNotifyingId] = useState<number | null>(null);
  const [notifiedIds, setNotifiedIds] = useState<Set<number>>(new Set());

  const [absentId, setAbsentId] = useState<number | null>(null);
  const handleAbsent = async (id: number) => {
    setAbsentId(id);
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    const tenantId = getTenantId();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);
    try {
      await fetch(`${BASE}/api/passengers/${id}/absent`, { method: "POST", headers, body: JSON.stringify({}) });
      queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
      refetch();
    } finally { setAbsentId(null); }
  };

  const handleDriverNotify = async (passengerId: number) => {
    setNotifyingId(passengerId);
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    const tenantId = getTenantId();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);
    try {
      await fetch(`${BASE}/api/passengers/${passengerId}/driver-notify`, { method: "POST", headers, body: JSON.stringify({}) });
      setNotifiedIds((prev) => new Set([...prev, passengerId]));
    } catch { /* non-blocking */ }
    finally { setNotifyingId(null); }
  };

  const handleSendDelayAlert = async () => {
    setDelayPending(true);
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    const tenantId = getTenantId();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);
    try {
      const res = await fetch(`${BASE}/api/trips/delay`, {
        method: "POST",
        headers,
        body: JSON.stringify({ delayMinutes: selectedDelay }),
      });
      const data = (await res.json()) as { message?: string; notified?: number };
      setDelayAlertOpen(false);
      const toastMsg = data.message ?? `Delay alert sent (${selectedDelay} min)`;
      setDelayToast(toastMsg);
      setTimeout(() => setDelayToast(null), 4000);
    } catch {
      setDelayToast("Failed to send delay alert — try again");
      setTimeout(() => setDelayToast(null), 3000);
    } finally {
      setDelayPending(false);
    }
  };

  // Auto-refresh passengers every 8s so boarding changes from admin show up
  useEffect(() => {
    const id = setInterval(() => { void refetch(); }, 8000);
    return () => clearInterval(id);
  }, [refetch]);

  async function handleToggleOffline() {
    const goingOffline = !isOffline;
    setIsOffline(goingOffline);

    // ── LocalStorage sync ─────────────────────────────────────────────────────
    // Write ONLINE token when the driver goes live.
    // Per spec: the token must ONLY be cleared by handleJourneyComplete, not here.
    // Manual "go offline" during a journey is disabled by the UI anyway, but even
    // if triggered, we intentionally leave the token so the stream survives a nav.
    if (sessionPhone && !goingOffline) {
      localStorage.setItem(mkLiveKey(sessionPhone), "ONLINE");
    }

    const driverName = myDriver?.name ?? user?.name ?? "Driver";
    const vehiclePlate = myDriver?.vehicleNumber ?? "";
    sendDriverMessage({
      driverName,
      vehiclePlate,
      text: goingOffline
        ? `🔴 Driver went OFFLINE — location sharing paused`
        : `🟢 Driver is back ONLINE — location sharing resumed`,
      isCustom: false,
    });
    if (myDriver?.id) {
      try {
        await patchDriver.mutateAsync({ id: myDriver.id, data: { isOnline: !goingOffline } });
        queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
      } catch { /* non-blocking */ }
    }
  }

  async function handleStartJourney() {
    setJourneyStarted(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    setJourneyTime(timeStr);

    // ── LocalStorage sync ─────────────────────────────────────────────────────
    // Persist journey start so lazy init can restore the active journey on next mount.
    if (sessionPhone) {
      localStorage.setItem(
        mkJourneyKey(sessionPhone),
        JSON.stringify({ started: true, time: timeStr })
      );
    }

    // Start streaming GPS from the driver's phone
    startGpsTracking();
    try {
      const tenantId = getTenantId();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);
      await fetch(`${BASE_GPS}/api/trips/start`, {
        method: "POST",
        headers,
        body: JSON.stringify({ driverId: myDriver?.id }),
      });
      queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
    } catch {
      // Non-blocking — UI already shows started state
    }
  }

  async function handleJourneyComplete() {
    if (journeyCompleted) return;
    setJourneyCompleted(true);
    setIsOffline(true); // release the Live button lock — driver back to offline for next shift
    setCountdown(60);
    // Stop GPS — no more location updates
    stopGpsTracking();

    // ── LocalStorage sync ─────────────────────────────────────────────────────
    // This is the ONLY authorised place to clear the live token.
    // The token survives: manual offline toggle, page reloads, back-navigation.
    // It is removed only here, after the journey is officially finalised.
    if (sessionPhone) {
      localStorage.removeItem(mkLiveKey(sessionPhone));
      localStorage.removeItem(mkJourneyKey(sessionPhone));
    }
    const now = new Date();
    setCompletedTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
    try {
      const tenantId = getTenantId();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);
      await fetch(`${BASE_GPS}/api/trips/complete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ driverId: myDriver?.id }),
      });
      // Refresh passenger list (statuses reset to pending) and announcement boards
      queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
      refetch();
    } catch {
      // Non-blocking — UI already shows completed state
    }
  }

  // 60-second countdown after journey is completed
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { setCountdown(null); return; }
    const id = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // Show a hard-stop error if the DB has no driver record for this phone,
  // rather than silently displaying another driver's data.
  if (driverNotLinked) {
    return (
      <div className="min-h-full w-full bg-[#0F172A] text-white flex flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-2xl bg-red-900/20 border border-red-700/40 p-6 w-full max-w-sm text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-700 mx-auto">
            <AlertTriangle size={24} className="text-white" />
          </div>
          <p className="text-base font-bold text-red-300">No Driver Record Linked</p>
          <p className="text-xs text-red-400/80">
            Your account (<span className="font-mono text-red-300">{user?.phone}</span>) is not linked to any driver record in this school.
          </p>
          <p className="text-[11px] text-slate-500">Ask your admin to create a driver entry with this phone number.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-[#0F172A] text-white flex flex-col">

      {/* Driver Profile Modal */}
      {driverProfileOpen && myDriver && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0F172A]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <p className="text-sm font-bold text-slate-100">My Profile</p>
            <button onClick={() => setDriverProfileOpen(false)} className="rounded-full p-1.5 hover:bg-slate-700 transition-colors">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Profile Photo</p>
              <PhotoPicker value={localDriverPhoto} onChange={setLocalDriverPhoto} name={myDriver.name} dark />
            </div>
            <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 space-y-3 text-xs">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Gender</p>
              <div className="flex gap-2">
                {["Male", "Female", "Other"].map((g) => (
                  <button key={g} type="button" onClick={() => setLocalDriverGender(localDriverGender === g ? "" : g)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${localDriverGender === g ? "bg-amber-500 border-amber-500 text-slate-900" : "border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-4 py-4 border-t border-slate-700">
            <button
              onClick={handleSaveDriverPhoto}
              disabled={driverPhotoSaving || (localDriverPhoto === (myDriver.photoUrl ?? "") && localDriverGender === (myDriver.gender ?? ""))}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors"
            >
              {driverPhotoSaving ? "Saving…" : driverPhotoSaved ? "✓ Saved!" : "Save Profile"}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-4 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          {/* Profile chip — tappable */}
          <button onClick={() => setDriverProfileOpen(true)} className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity">
            <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-amber-500 bg-slate-700 shrink-0 flex items-center justify-center">
              {localDriverPhoto || myDriver?.photoUrl
                ? <img src={localDriverPhoto || myDriver?.photoUrl!} alt={myDriver?.name ?? "Driver"} className="h-full w-full object-cover" />
                : <User size={16} className="text-slate-400" />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100 leading-tight">{myDriver?.name ?? user?.name ?? "Driver"}</p>
              <p className="text-[10px] text-slate-400 leading-tight">
                {[myDriver?.gender, myDriver?.vehicleNumber].filter(Boolean).join(" · ") || "Driver Portal"}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={journeyStarted && !journeyCompleted ? undefined : handleToggleOffline}
              disabled={journeyStarted && !journeyCompleted}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                journeyStarted && !journeyCompleted
                  ? "pointer-events-none cursor-not-allowed bg-red-50 border-red-200 text-red-600 opacity-80"
                  : isOffline
                    ? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
                    : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100/80"
              }`}
            >
              {isOffline ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  Go Live
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  Live Tracking Active
                </>
              )}
            </button>
            <div className="rounded-full bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200">
              {boardedCount}/{totalCount}
            </div>
          </div>
        </div>
      </header>

      {/* GPS Status bar — shown while journey is active; scrolling ticker when GPS on */}
      {journeyStarted && !journeyCompleted && (
        <div className={`border-b overflow-hidden ${gpsActive ? "bg-green-900/20 border-green-800/40" : "bg-amber-900/20 border-amber-800/40"}`}>
          {gpsActive ? (() => {
            // Build ticker items: current station → next station → each upcoming-station user
            const nextStation = driverStations[stationIdx + 1] ?? null;
            const nextPassengers = nextStation
              ? riderPassengers.filter((p) => p.stationId === nextStation.stationId)
              : [];
            const tickerItems: string[] = [
              currentStation ? `📍 Now: ${currentStation.stopLabel || currentStation.stationName || "—"}` : "📍 Journey started",
              nextStation ? `➡ Next: ${nextStation.stopLabel || nextStation.stationName || "—"}` : "🏫 School — final stop",
              ...nextPassengers.map((p) =>
                p.quickMessage ? `👤 ${p.name}: "${p.quickMessage}"` : `👤 ${p.name}`
              ),
            ];
            const item = tickerItems[tickerIdx % tickerItems.length];
            return (
              <div className="flex items-center gap-2 px-4 py-1.5">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                <p key={tickerIdx} className="text-xs text-green-300 font-medium flex-1 truncate animate-pulse">
                  {item}
                </p>
                <span className="text-[9px] text-green-600 shrink-0">{(tickerIdx % tickerItems.length) + 1}/{tickerItems.length}</span>
              </div>
            );
          })() : (
            <div className="flex items-center gap-2 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <p className="text-xs text-amber-300 font-medium flex-1">
                {gpsError ? `⚠ ${gpsError}` : "Acquiring GPS signal…"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Offline banner */}
      {isOffline && (
        <div className="flex items-center gap-2 bg-slate-800 border-b border-slate-700 px-4 py-2.5">
          <WifiOff size={16} className="shrink-0 text-slate-300" />
          <p className="text-xs text-slate-300 font-medium flex-1">Location sharing paused — you are offline. Admin has been notified.</p>
          <button onClick={handleToggleOffline} className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 underline">Go Online</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Start Journey Button */}
        <div>
          {!journeyStarted ? (
            <button
              onClick={isOffline ? undefined : handleStartJourney}
              disabled={isOffline}
              className={`w-full rounded-2xl py-4 text-center font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
                isOffline
                  ? "bg-slate-700 shadow-none opacity-50 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-green-900/40"
              }`}
            >
              <Navigation size={20} className="inline mr-2" />
              {isOffline ? "Go Live first to Start Journey" : "Start Journey"}
            </button>
          ) : journeyCompleted && countdown === null ? (
            /* Countdown done — show fresh Start Journey only */
            <button
              onClick={() => {
                setJourneyStarted(false);
                setJourneyCompleted(false);
                setJourneyTime(null);
                setCompletedTime(null);
                setStationIdx(0);
                setDriverPos(null);
              }}
              disabled={isOffline}
              className={`w-full rounded-2xl py-4 text-center font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
                isOffline
                  ? "bg-slate-700 shadow-none opacity-50 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-green-900/40"
              }`}
            >
              <Navigation size={20} className="inline mr-2" />
              {isOffline ? "Go Live first to Start Journey" : "Start Journey"}
            </button>
          ) : journeyCompleted ? (
            /* Countdown in progress — completion card only */
            <div className="rounded-2xl bg-red-900/20 border border-red-700/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600">
                  <Flag size={18} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-300">Journey Completed · {completedTime}</p>
                  <p className="text-xs text-red-500/80">All passengers & admin notified</p>
                </div>
                <span className="text-xs font-mono text-slate-400">{countdown}s</span>
              </div>
              <div className="mt-3 pt-3 border-t border-red-800/40">
                <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold mb-2">Arrival notification sent to</p>
                <div className="flex flex-wrap gap-1.5">
                  {riderPassengers.filter((p) => p.status === "boarded").slice(0, 6).map((p) => (
                    <div key={p.id} className="flex items-center gap-1 rounded-full bg-red-900/30 border border-red-700/30 px-2 py-0.5">
                      <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                      <span className="text-[10px] text-red-200">{p.name.split(" ")[0]}</span>
                      <span className="text-[9px] text-red-400">✓</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 rounded-full bg-blue-900/40 border border-blue-700/30 px-2.5 py-0.5">
                    <span className="text-[10px] text-blue-300 flex items-center gap-0.5"><Building2 size={10} /> Admin ✓</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-purple-900/40 border border-purple-700/30 px-2.5 py-0.5">
                    <span className="text-[10px] text-purple-300 flex items-center gap-0.5"><Users size={10} /> Parents ✓</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* In-journey: Started card + Complete button */
            <div className="space-y-3">
              <div className="rounded-2xl bg-green-900/30 border border-green-700/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600">
                    <CheckCircle size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-green-300">Journey Started · {journeyTime}</p>
                    <p className="text-xs text-green-500/80">Students, staff & admin have been notified</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-green-800/40">
                  <p className="text-[10px] text-green-600 uppercase tracking-wider font-semibold mb-2">Notifications sent to</p>
                  <div className="flex flex-wrap gap-1.5">
                    {riderPassengers.slice(0, 6).map((p) => (
                      <div key={p.id} className="flex items-center gap-1 rounded-full bg-green-900/40 border border-green-700/30 px-2 py-0.5">
                        <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                        <span className="text-[10px] text-green-200">{p.name.split(" ")[0]}</span>
                        <span className="text-[9px] text-green-500">✓</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1 rounded-full bg-blue-900/40 border border-blue-700/30 px-2.5 py-0.5">
                      <span className="text-[10px] text-blue-300 flex items-center gap-0.5"><Building2 size={10} /> Admin ✓</span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={nearSchool500m ? handleJourneyComplete : undefined}
                disabled={!nearSchool500m}
                className={`w-full rounded-2xl py-4 text-center font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
                  nearSchool500m
                    ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-900/40"
                    : "bg-slate-700 shadow-none opacity-50 cursor-not-allowed"
                }`}
              >
                <Flag size={20} className="inline mr-2" />
                {nearSchool500m
                  ? "Journey Completed"
                  : distToSchoolKm != null
                    ? `Journey Completed · ${distToSchoolKm.toFixed(1)} km to school`
                    : "Journey Completed — Reach School First"}
              </button>
            </div>
          )}
        </div>

        {/* Upcoming Station — students at current stop */}
        {currentStation && (
          <div className="rounded-2xl bg-slate-800/80 border border-amber-500/20 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <MapPin size={13} className="shrink-0 text-amber-400" />
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Upcoming Station</p>
              <span className="ml-auto text-[10px] text-slate-500">Stop {stationIdx + 1}/{driverStations.length}</span>
            </div>
            <p className="font-bold text-slate-100 text-sm mb-2.5">{currentStation.stopLabel || currentStation.stationName || "—"}</p>
            {(() => {
              const stationPassengers = riderPassengers.filter((p) => p.stationId === currentStation.stationId);
              if (stationPassengers.length === 0) return (
                <p className="text-xs text-slate-500 italic">No students assigned to this station</p>
              );
              return (
                <div className="space-y-1.5">
                  {stationPassengers.map((p) => {
                    const isBoarded = p.status === "boarded";
                    const isAbsent = p.status === "absent";
                    const isOnLeave = p.quickMessage === "Staying home today" || p.status === "leave";
                    const isLive = p.liveToday === 1;
                    const hasCustomMsg = !!p.quickMessage && p.quickMessage !== "Staying home today";
                    const alreadyNotified = notifiedIds.has(p.id);
                    const canNotify = !isBoarded && !isAbsent && !isOnLeave && isLive && !alreadyNotified;
                    return (
                      <div key={p.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                        isBoarded ? "border-green-700/40 bg-green-900/20" :
                        isAbsent || isOnLeave ? "border-red-800/30 bg-red-900/10" :
                        "border-slate-700 bg-slate-800/60"
                      }`}>
                        <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{p.name}</p>
                          {hasCustomMsg && (
                            <p className="text-[10px] text-amber-400/80 truncate">"{p.quickMessage}"</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isBoarded ? (
                            <span className="text-[10px] font-bold text-green-400">✓ On bus</span>
                          ) : isAbsent ? (
                            <span className="text-[10px] font-bold text-red-400">Absent</span>
                          ) : isOnLeave ? (
                            <span className="text-[10px] font-bold text-slate-400">On leave</span>
                          ) : isLive ? (
                            <span className="text-[10px] font-bold text-amber-400">Coming</span>
                          ) : (
                            <span className="text-[10px] text-slate-500">?</span>
                          )}
                          {canNotify && (
                            <button
                              onClick={() => handleDriverNotify(p.id)}
                              disabled={notifyingId === p.id}
                              className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              <Bell size={10} />
                              {notifyingId === p.id ? "…" : "Notify"}
                            </button>
                          )}
                          {alreadyNotified && (
                            <span className="text-[10px] text-green-500 flex items-center gap-0.5"><Bell size={9} /> Sent ✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}


        {/* Safety Scorecard */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Driver Safety Score</p>
          <div className="flex items-center gap-4">
            <ScoreRing score={SAFETY_SCORE} />
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-800 p-2.5 text-center">
                <p className="text-xs text-slate-400">Speed</p>
                <p className={`text-base font-bold ${overspeedAlert ? "text-red-400" : "text-slate-100"}`}>
                  {speedKmh != null ? Math.round(speedKmh) : "—"}
                </p>
                <p className="text-[9px] text-slate-500">km/h</p>
              </div>
              <div className="rounded-xl bg-slate-800 p-2.5 text-center">
                <p className="text-xs text-slate-400">Distance</p>
                <p className="text-base font-bold text-slate-100">{DISTANCE_KM}</p>
                <p className="text-[9px] text-slate-500">km today</p>
              </div>
              <div className="rounded-xl bg-slate-800 p-2.5 text-center">
                <p className="text-xs text-slate-400">Trips</p>
                <p className="text-base font-bold text-slate-100">{TRIPS_TODAY}</p>
                <p className="text-[9px] text-slate-500">done</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="flex-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs flex items-center gap-1.5">
              <span className="text-green-400">✓</span><span className="text-slate-300">No harsh braking</span>
            </div>
            <div className="flex-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs flex items-center gap-1.5">
              {overspeedAlert ? (
                <><span className="text-red-400">✕</span><span className="text-red-300">Over speed limit</span></>
              ) : (
                <><span className="text-green-400">✓</span><span className="text-slate-300">Speed within limit</span></>
              )}
            </div>
          </div>
        </div>

        {/* Overspeed Alert */}
        {overspeedAlert && (
          <div className="rounded-xl bg-red-900/40 border-2 border-red-600 px-4 py-3 flex items-center gap-2.5 animate-pulse">
            <AlertTriangle size={18} className="shrink-0 text-red-400" />
            <p className="text-sm text-red-200 font-bold">
              Speed Alert! You are driving at {speedKmh != null ? Math.round(speedKmh) : "—"} km/h — slow down below {SPEED_ALERT_THRESHOLD_KMH} km/h.
            </p>
          </div>
        )}

        {/* Route Navigator */}
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Route Navigator</p>
            <span className="text-xs text-amber-400 font-medium">
              {driverStations.length > 0 ? `Stop ${stationIdx + 1} / ${driverStations.length}` : "— / —"}
            </span>
          </div>

          {driverStations.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              {loadingStations && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />}
              <p className="text-xs text-slate-500">
                {loadingStations ? "Loading stops…" : myRoute ? "No stops configured for this route" : "No route assigned yet"}
              </p>
            </div>
          ) : (
            <>
              {/* Current + Next station cards */}
              <div className="grid grid-cols-2 gap-2">
                {/* Current station */}
                <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">📍 Current Stop</p>
                  <p className="font-bold text-amber-300 text-sm leading-tight truncate">
                    {currentStation?.stopLabel || currentStation?.stationName || "—"}
                  </p>
                  {(() => {
                    const count = riderPassengers.filter((p) => p.stationId === currentStation?.stationId).length;
                    return count > 0
                      ? <p className="text-[9px] text-amber-500 mt-0.5">{count} passenger{count > 1 ? "s" : ""}</p>
                      : null;
                  })()}
                </div>
                {/* Next station */}
                {(() => {
                  const next = driverStations[stationIdx + 1] ?? null;
                  const nextCount = next ? riderPassengers.filter((p) => p.stationId === next.stationId).length : 0;
                  return (
                    <div className="rounded-xl bg-slate-700/60 border border-slate-600/60 px-3 py-2.5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">➡ Next Stop</p>
                      <p className="font-bold text-slate-200 text-sm leading-tight truncate">
                        {next ? (next.stopLabel || next.stationName || "—") : "🏫 School"}
                      </p>
                      {nextCount > 0
                        ? <p className="text-[9px] text-slate-500 mt-0.5">{nextCount} boarding</p>
                        : next ? <p className="text-[9px] text-slate-600 mt-0.5">No boarders</p> : null}
                    </div>
                  );
                })()}
              </div>

              {/* Prev / Next buttons */}
              <div className="flex items-center gap-2">
                <button onClick={() => setStationIdx((i) => Math.max(0, i - 1))} disabled={stationIdx === 0}
                  className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-30 transition-colors flex-1">
                  ← Prev
                </button>
                <button onClick={() => setStationIdx((i) => Math.min(driverStations.length - 1, i + 1))}
                  disabled={stationIdx === driverStations.length - 1}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-30 transition-colors flex-1">
                  Next →
                </button>
              </div>

              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5">
                {driverStations.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${
                    i < stationIdx ? "w-4 bg-green-500" : i === stationIdx ? "w-6 bg-amber-500" : "w-1.5 bg-slate-600"
                  }`} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* DND */}
        {gpsActive && (
          <div className="rounded-xl bg-red-900/20 border border-red-700/30 px-4 py-2.5 flex items-center gap-2">
            <BellOff size={16} className="shrink-0 text-red-300" />
            <p className="text-xs text-red-300 font-medium">DND Active — Vehicle in motion. Messages queued as voice notes.</p>
          </div>
        )}

        {/* Live Today */}
        {liveTodayPassengers.length > 0 && (
          <div className="rounded-2xl bg-green-900/20 border border-green-700/30 p-3">
            <p className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wider flex items-center gap-1.5"><CheckCircle size={12} /> Confirmed Riding Today</p>
            <div className="flex flex-wrap gap-2">
              {liveTodayPassengers.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 rounded-full bg-green-900/40 px-2.5 py-1 border border-green-700/30">
                  <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                  <span className="text-xs text-green-200 font-medium">{p.name.split(" ")[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* On Leave */}
        {onLeavePassengers.length > 0 && (
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3">
            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5"><Home size={12} /> Not Riding Today</p>
            <div className="flex flex-wrap gap-2">
              {onLeavePassengers.map((p) => (
                <span key={p.id} className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-400">{p.name.split(" ")[0]}</span>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {withMessages.filter(p => p.quickMessage !== "Staying home today").length > 0 && (
          <div className="rounded-2xl bg-blue-900/10 border border-blue-700/20 p-3">
            <p className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wider flex items-center gap-1.5"><MessageSquare size={12} /> Messages</p>
            <div className="space-y-2">
              {withMessages.filter(p => p.quickMessage !== "Staying home today").map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{p.name}</p>
                    <p className="text-xs text-blue-300">"{p.quickMessage}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* At This Station — Waiting Passengers */}
        {journeyStarted && !journeyCompleted && currentStation && (() => {
          const waiting = (passengers ?? []).filter(
            (p) => p.stationId === currentStation.id && p.status === "pending" && p.quickMessage !== "Staying home today"
          );
          return (
            <div className="rounded-2xl border border-amber-600/40 bg-amber-950/20 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-700/30">
                <div>
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={12} /> At This Stop
                  </p>
                  <p className="text-[10px] text-amber-600 mt-0.5">{currentStation.stopLabel || currentStation.stationName || "—"} · {waiting.length} waiting</p>
                </div>
                {waiting.length === 0 && (
                  <span className="text-[10px] text-slate-500 italic">All accounted for</span>
                )}
              </div>
              {waiting.length > 0 ? (
                <div className="divide-y divide-amber-900/30">
                  {waiting.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={p.name} photoUrl={p.photoUrl} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-100 text-sm">{p.name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{p.role} · {p.stationName}</p>
                        {p.quickMessage && <p className="text-[10px] text-blue-400 italic truncate">"{p.quickMessage}"</p>}
                      </div>
                      <div className="shrink-0 flex gap-1.5">
                        <button
                          onClick={() => handleBoard(p.id)}
                          disabled={boardingId === p.id || absentId === p.id || isOffline}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                        >
                          {boardingId === p.id ? "…" : "Board ✓"}
                        </button>
                        <button
                          onClick={() => handleAbsent(p.id)}
                          disabled={boardingId === p.id || absentId === p.id || isOffline}
                          className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-slate-600 disabled:opacity-50 transition-colors border border-red-700/30"
                        >
                          {absentId === p.id ? "…" : "Absent"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-center text-xs text-slate-500">No pending passengers at this stop</div>
              )}
            </div>
          );
        })()}

        {/* Passenger Checklist */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Passenger Checklist</p>
          <div className="space-y-2">
            {riderPassengers.filter((p) => p.status !== "leave" && p.quickMessage !== "Staying home today").map((p) => (
              <div key={p.id} className={`flex items-center gap-3 rounded-2xl p-3 border transition-all ${
                p.status === "boarded" ? "bg-emerald-900/20 border-emerald-700/30"
                  : (p.status as string) === "absent" ? "bg-red-900/20 border-red-700/30"
                  : "bg-slate-800 border-slate-700"
              }`}>
                <Avatar name={p.name} photoUrl={p.photoUrl} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-100 text-sm">{p.name}</p>
                    {p.liveToday === 1 && (
                      <span className="rounded-full bg-green-800/50 border border-green-700/40 px-1.5 py-0.5 text-[9px] text-green-300 font-bold">LIVE</span>
                    )}
                    <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400 capitalize">{p.role}</span>
                  </div>
                  <p className="text-xs text-slate-400">{p.stationName}</p>
                  {p.quickMessage && <p className="text-[10px] text-blue-400 italic mt-0.5 truncate">"{p.quickMessage}"</p>}
                </div>
                {p.status === "boarded" ? (
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleUnboard(p.id)}
                      disabled={unboardingId === p.id || isOffline}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        unboardingId === p.id ? "bg-slate-600 opacity-50" : "bg-emerald-500"
                      }`}
                      aria-label="Unboard passenger"
                    >
                      <span className="inline-block h-4 w-4 translate-x-6 rounded-full bg-white shadow transition-transform" />
                    </button>
                    <span className="text-[9px] text-emerald-400 font-semibold">Boarded</span>
                  </div>
                ) : (p.status as string) === "absent" ? (
                  <span className="shrink-0 rounded-xl bg-red-900/40 border border-red-700/40 px-3 py-1.5 text-xs text-red-400 font-semibold">Absent</span>
                ) : p.quickMessage === "Staying home today" ? (
                  <span className="shrink-0 rounded-xl bg-slate-700 px-3 py-1.5 text-xs text-slate-400">On Leave</span>
                ) : (
                  <button onClick={() => handleBoard(p.id)} disabled={boardingId === p.id || isOffline}
                    className="shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 transition-colors">
                    {boardingId === p.id ? "…" : "Board ✓"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Message + SOS footer */}
      <div className="p-4 border-t border-slate-700 bg-slate-900/50 space-y-2">

        {/* Delay alert toast */}
        {delayToast && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-900/40 border border-amber-700/50 px-3 py-2">
            <Clock size={15} className="shrink-0 text-amber-300" />
            <p className="text-xs text-amber-200 flex-1">{delayToast}</p>
            <button onClick={() => setDelayToast(null)} className="text-slate-500 text-xs hover:text-slate-400">✕</button>
          </div>
        )}

        {/* Last sent confirmation */}
        {lastSent && (
          <div className="flex items-center gap-2 rounded-xl bg-blue-900/30 border border-blue-700/30 px-3 py-2">
            <Send size={16} className="shrink-0 text-blue-300" />
            <p className="text-xs text-blue-300 flex-1 truncate">Sent: "{lastSent}"</p>
            <button onClick={() => setLastSent(null)} className="text-slate-500 text-xs hover:text-slate-400">✕</button>
          </div>
        )}

        {/* Report to Admin button */}
        <button onClick={() => setQuickMsgOpen(true)}
          className="w-full rounded-2xl bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 py-3.5 text-center font-bold text-white shadow-lg transition-all active:scale-[0.98]">
          <Megaphone size={18} className="inline mr-2" />
          Report to Admin
        </button>

        {/* Delay Alert button */}
        <button
          onClick={() => setDelayAlertOpen(true)}
          className="w-full rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 py-3.5 text-center font-bold text-white shadow-lg shadow-amber-900/30 transition-all active:scale-[0.98]"
        >
          <Clock size={18} className="inline mr-2" />
          Delay Alert
        </button>

        <button onClick={() => setSosActive((v) => !v)}
          className={`w-full rounded-2xl py-4 text-center font-bold text-white transition-all ${
            sosActive ? "bg-red-800 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse"
              : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-lg"
          }`}>
          <AlertTriangle size={18} className="inline mr-2" />
          {sosActive ? "SOS SENT — Admin & Parents Alerted" : "SOS EMERGENCY"}
        </button>

        {/* My Trips — always shown once driver is identified */}
        {myDriver != null && (
          <div className="rounded-2xl bg-slate-800/80 border border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
              <HistoryIcon size={14} className="text-amber-400 shrink-0" />
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">My Trips</p>
              {myTripHistory && myTripHistory.length > 0 && (
                <span className="ml-auto text-[11px] text-slate-500">{myTripHistory.length} recorded</span>
              )}
            </div>
            {!myTripHistory || myTripHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No trips logged yet. Your trips will appear here after starting a journey.
              </div>
            ) : (
              <div className="divide-y divide-slate-700/60">
                {myTripHistory.map((t) => {
                  const startD = new Date(t.startedAt);
                  const startLabel = startD.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
                  const durationLabel = t.completedAt
                    ? (() => { const mins = Math.round((new Date(t.completedAt).getTime() - startD.getTime()) / 60000); return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`; })()
                    : "In progress";
                  return (
                    <div key={t.id} className="flex items-center gap-2.5 px-4 py-2.5">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${t.completedAt ? "bg-green-500" : "bg-amber-400 animate-pulse"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{startLabel}{t.routeName ? ` · ${t.routeName}` : ""}</p>
                        <p className="text-[11px] text-slate-500">{durationLabel}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-200">{t.passengersBoarded}/{t.passengersTotal}</p>
                        <p className="text-[10px] text-slate-500">boarded</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delay Alert Sheet */}
      {delayAlertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDelayAlertOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-[#1e293b] border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Clock size={16} className="text-amber-400" /> Delay Alert
                </h2>
                <p className="text-xs text-slate-400">Notify all parents that the bus is running late</p>
              </div>
              <button onClick={() => setDelayAlertOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 text-sm">
                ✕
              </button>
            </div>

            <div className="px-5 py-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">How many minutes late?</p>
                <div className="grid grid-cols-5 gap-2">
                  {[5, 10, 15, 20, 30].map((min) => (
                    <button
                      key={min}
                      onClick={() => setSelectedDelay(min)}
                      className={`rounded-xl py-3 text-sm font-bold transition-all border ${
                        selectedDelay === min
                          ? "bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-900/40"
                          : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {min}
                      <span className="block text-[9px] font-normal opacity-70">min</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-amber-900/20 border border-amber-700/30 px-4 py-3">
                <p className="text-xs text-amber-300 font-medium">
                  ⏰ Parents will get an OrbitTrack app notification (with sound): <span className="font-bold">"{myDriver?.vehicleNumber ? `Bus ${myDriver.vehicleNumber}` : "The school bus"} is running {selectedDelay} minutes late."</span>
                </p>
              </div>

              <button
                onClick={handleSendDelayAlert}
                disabled={delayPending}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 py-4 text-center font-bold text-white shadow-lg shadow-amber-900/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {delayPending ? "Sending…" : `Send ${selectedDelay}-min Delay Alert`}
              </button>
            </div>
            <div className="pb-6" />
          </div>
        </div>
      )}

      {/* Quick Message Sheet */}
      {quickMsgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setQuickMsgOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-[#1e293b] border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2"><Megaphone size={16} /> Report to Admin</h2>
                <p className="text-xs text-slate-400">Tap a message or write your own</p>
              </div>
              <button onClick={() => setQuickMsgOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 text-sm">
                ✕
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Preset chips */}
              <div className="grid grid-cols-2 gap-2">
                {QUICK_MESSAGES.map((m) => (
                  <button key={m.text}
                    onClick={() => {
                      sendDriverMessage({ driverName: myDriver?.name ?? user?.name ?? "Driver", vehiclePlate: myDriver?.vehicleNumber ?? "", text: m.text, isCustom: false });
                      setLastSent(m.text);
                      setQuickMsgOpen(false);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 px-3 py-2.5 text-left text-xs font-medium text-slate-200 transition-colors active:bg-slate-500">
                    <m.Icon size={16} className="shrink-0 text-slate-400" />
                    <span className="leading-snug">{m.text}</span>
                  </button>
                ))}
              </div>

              {/* Custom message */}
              <div>
                <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">Custom Message</p>
                <div className="flex gap-2">
                  <input
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    placeholder="Describe the issue…"
                    className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customMsg.trim()) {
                        sendDriverMessage({ driverName: myDriver?.name ?? user?.name ?? "Driver", vehiclePlate: myDriver?.vehicleNumber ?? "", text: customMsg.trim(), isCustom: true });
                        setLastSent(customMsg.trim());
                        setCustomMsg("");
                        setQuickMsgOpen(false);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!customMsg.trim()) return;
                      sendDriverMessage({ driverName: myDriver?.name ?? user?.name ?? "Driver", vehiclePlate: myDriver?.vehicleNumber ?? "", text: customMsg.trim(), isCustom: true });
                      setLastSent(customMsg.trim());
                      setCustomMsg("");
                      setQuickMsgOpen(false);
                    }}
                    disabled={!customMsg.trim()}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
                    Send
                  </button>
                </div>
              </div>
            </div>
            <div className="pb-6" />
          </div>
        </div>
      )}
    </div>
  );
}
