import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SpeedIndicator } from "@/components/ui/SpeedIndicator";
import { useDriverLocation } from "@/hooks/use-driver-location";
import {
  useListAnnouncements,
  useGetTripTimeline,
  getGetTripTimelineQueryKey,
  useUpdatePassenger,
  useCreatePassenger,
  useListPassengers,
  useListRoutes,
  getListPassengersQueryKey,
  useListCalendarEvents,
  getTenantId,
  TimelineEvent,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import OsmMap from "@/components/osm-map";
import PaymentModal from "@/components/PaymentModal";
import AdCarousel, { type Ad } from "@/components/ad-carousel";
import { useT, tpl } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { PhotoPicker } from "@/components/photo-picker";
import {
  Bus, ClipboardList, Map, Clock, MessageSquare, X, Send,
  User, Timer, Home, MapPin, HeartPulse, ThumbsUp, Route, Navigation, CheckCircle, RefreshCw,
  ShieldAlert, CreditCard, AlertTriangle, Lock, Building2, Phone, Mail, Globe, Facebook, Instagram, Youtube,
  ChevronDown, ChevronUp,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const QUICK_MESSAGES = [
  { Icon: User,       label: "I'm on my way",      value: "I'm on my way" },
  { Icon: Timer,      label: "Wait, I'm coming!",   value: "Wait, I'm coming!" },
  { Icon: Home,       label: "Staying home today",  value: "Staying home today" },
  { Icon: MapPin,     label: "At the stop now",     value: "At the stop now" },
  { Icon: HeartPulse, label: "Sick, not coming",    value: "Sick, not coming" },
  { Icon: ThumbsUp,   label: "On the bus",          value: "On the bus" },
];

// Student's home stop ETA alert threshold
const GEO_ALERT_THRESHOLD_METERS = 800;

// Haversine great-circle distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type RouteStationItem = { id: number; stationId: number; stationName: string | null; position: number; radius: number | null; lat?: number | null; lng?: number | null };

function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-()]/g, "");
  if (stripped.startsWith("+977")) return stripped.slice(4);
  if (stripped.startsWith("977") && stripped.length > 10)
    return stripped.slice(3);
  return stripped;
}

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

export default function StudentPortal({ tenant }: { tenant?: any }) {
  const t = useT();
  const { user, login } = useAuth();
  const { data: announcements } = useListAnnouncements();
  const { data: passengers } = useListPassengers();
  const { data: routes } = useListRoutes();
  const updatePassenger = useUpdatePassenger();
  const createPassenger = useCreatePassenger();
  const queryClient = useQueryClient();

  // Find this student's passenger record by phone; do NOT fall back to first passenger to prevent data leakage
  const me = passengers?.find(
    (p) => p.phone && normalizePhone(p.phone) === normalizePhone(user?.phone ?? "")
  );

  const [sentMsg, setSentMsg] = useState<string | null>(null);
  const [liveToday, setLiveToday] = useState(false);
  const [onLeave, setOnLeave] = useState(false);
  const [geoAlertDismissed, setGeoAlertDismissed] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [tripCompleted, setTripCompleted] = useState(false);
  const [isFreezeActive, setIsFreezeActive] = useState(false);
  const [freezeRemainingMinutes, setFreezeRemainingMinutes] = useState<number | null>(null);
  const [completedTime, setCompletedTime] = useState<string | null>(null);
  const [adminMsgModalOpen, setAdminMsgModalOpen] = useState(false);
  const [adminMsgText, setAdminMsgText] = useState("");
  const [adminMsgSending, setAdminMsgSending] = useState(false);
  const [adminMsgToast, setAdminMsgToast] = useState<string | null>(null);
  const [appApproved, setAppApproved] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    fetch(`${BASE}/api/advertisements`)
      .then((r) => r.json())
      .then((data: Ad[]) => setAds(data))
      .catch(() => {});
  }, []);

  // Live station state pushed via `station_changed` SSE when driver taps Next/Prev
  const [liveStation, setLiveStation] = useState<{ idx: number; name: string | null } | null>(null);
  // True from `trip_started` until `trip_completed` — lets us show "en route" even without GPS
  const [tripActive, setTripActive] = useState(false);

  const generateLeaveTemplate = useCallback(() => {
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const nextDateStr = `${String(tomorrow.getDate()).padStart(2, "0")}/${String(tomorrow.getMonth() + 1).padStart(2, "0")}/${tomorrow.getFullYear()}`;

    const schoolName = "Golden Sungava Secondary School";
    const schoolAddress = "Koteshwor, Kathmandu";
    const studentName = me?.name || "[Your Name]";
    const cls = me?.className ? `${me.className}${me.section ? ` (${me.section})` : ""}` : "[Your Class]";
    const roll = me?.rollNumber || "[Your Roll Number]";

    return `To
The Principal,
${schoolName},
${schoolAddress}.

Date: ${dateStr}

Subject: Application for leave.

Respected Sir/Madam,

With due respect, I would like to state that I, ${studentName}, a student of class ${cls} in your school, am unable to attend school from ${dateStr} to ${nextDateStr} (for 2 days) due to [sudden illness / an urgent piece of work at home].

Therefore, I kindly request you to grant me leave for the mentioned days. I shall be very grateful to you.

Thank you!

Yours obediently,

Name: ${studentName}
Class: ${cls}
Roll No.: ${roll}`;
  }, [me?.name, me?.className, me?.section, me?.rollNumber]);

  const openAdminMsgModal = useCallback(() => {
    if (!adminMsgText.trim()) {
      setAdminMsgText(generateLeaveTemplate());
    }
    setAdminMsgModalOpen(true);
  }, [adminMsgText, generateLeaveTemplate]);

  const handleSendAdminMessage = useCallback(async () => {
    if (!adminMsgText.trim() || !me?.id) return;
    setAdminMsgSending(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const tenantId = getTenantId();
      if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);
      const res = await fetch(`${BASE}/api/passengers/${me.id}/message-admin`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: adminMsgText.trim() }),
      });
      if (res.ok) {
        setAdminMsgToast("Message sent to Admin successfully");
        setAdminMsgText("");
        setTimeout(() => {
          setAdminMsgToast(null);
          setAdminMsgModalOpen(false);
        }, 2000);
      }
    } catch { /* ignore */ }
    finally { setAdminMsgSending(false); }
  }, [adminMsgText, me?.id]);

  // Transport Config state
  const [transportOpen, setTransportOpen] = useState(false);
  const [routeStopsOpen, setRouteStopsOpen] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [routeStations, setRouteStations] = useState<RouteStationItem[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [loadingStations, setLoadingStations] = useState(false);
  const [transportSaving, setTransportSaving] = useState(false);
  const [transportSaved, setTransportSaved] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string>("");
  const [localParentName, setLocalParentName] = useState("");
  const [localGender, setLocalGender] = useState("");
  const [localClassName, setLocalClassName] = useState("");
  const [localSection, setLocalSection] = useState("");
  const [localRollNumber, setLocalRollNumber] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  // Scope route & driver to assigned student's route & driver
  const assignedRoute = (routes ?? []).find(
    (r) => String(r.id) === selectedRouteId || r.id === me?.routeId
  );
  const assignedDriverId = assignedRoute?.driverId ?? undefined;

  // Subscribe ONLY to student's assigned driver's live GPS coordinates
  const driverLoc = useDriverLocation(assignedDriverId);

  // Fetch timeline strictly for student's assigned route/driver
  const queryRouteId = me?.routeId || (selectedRouteId ? Number(selectedRouteId) : undefined);
  const { data: timeline } = useQuery({
    queryKey: ["student-timeline", queryRouteId, assignedDriverId],
    queryFn: async () => {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const params = new URLSearchParams();
      if (queryRouteId) params.set("routeId", String(queryRouteId));
      if (assignedDriverId) params.set("driverId", String(assignedDriverId));
      const url = `${BASE}/api/trips/timeline?${params.toString()}`;
      const headers: Record<string, string> = {};
      const tenantId = getTenantId();
      if (tenantId !== null) headers["x-tenant-id"] = String(tenantId);
      const r = await fetch(url, { headers });
      if (!r.ok) return [];
      return (await r.json()) as TimelineEvent[];
    },
    refetchInterval: 10000,
  });

  // Filter announcements for Notice Board: show general announcements & bus notices matching assigned bus
  const filteredAnnouncements = useMemo(() => {
    if (!announcements) return [];
    return announcements.filter((a) => {
      const isBusStart = a.message.includes("journey started") || a.message.includes("Bus service started");
      if (isBusStart) {
        if (driverLoc?.vehicleNumber && a.message.includes(driverLoc.vehicleNumber)) return true;
        if (assignedRoute?.name && a.message.includes(assignedRoute.name)) return true;
        return false; // Belongs to a different bus/route!
      }
      return true; // General school notice
    });
  }, [announcements, driverLoc?.vehicleNumber, assignedRoute?.name]);

  const todayAdStr = (() => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; })();
  const tmrAdStr = (() => { const d = new Date(); d.setDate(d.getDate()+1); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; })();
  const { data: calEvents } = useListCalendarEvents({ month: todayAdStr.slice(0, 7) });
  const upcomingEvents = (calEvents ?? []).filter(e => e.eventDate === todayAdStr || e.eventDate === tmrAdStr);

  // Check if today is a holiday (Saturday in Nepal or calendar holiday event)
  const isHolidayToday = useMemo(() => {
    const todayStr = todayAdStr;
    const now = new Date();
    if (now.getDay() === 6) return true; // Saturday is weekly holiday in Nepal
    return (calEvents ?? []).some(
      (e) =>
        e.eventDate === todayStr &&
        (e.type === "holiday" ||
          (e.title ?? "").toLowerCase().includes("holiday") ||
          (e.title ?? "").includes("बिदा"))
    );
  }, [todayAdStr, calEvents]);

  // Subscription status — server computes isPaying/daysLeft/isExpired, cast from extended response
  type SubPassenger = typeof me & { isPaying?: boolean; isExpired?: boolean; daysLeft?: number | null; showExpiryBanner?: boolean };
  const meEx = me as SubPassenger | undefined;
  const isPaying = meEx?.isPaying ?? false;
  const daysLeft = meEx?.daysLeft ?? null;
  const showExpiryBanner = meEx?.showExpiryBanner ?? false;

  useEffect(() => {
    if (me?.liveToday === 1) setLiveToday(true);
    if (me?.quickMessage) setSentMsg(me.quickMessage);
    if (me?.routeId) setSelectedRouteId(String(me.routeId));
    if (me?.stationId) setSelectedStationId(String(me.stationId));
    if (me?.photoUrl) setLocalPhotoUrl(me.photoUrl);
    if (me?.parentName) setLocalParentName(me.parentName ?? "");
    if (me?.gender) setLocalGender(me.gender ?? "");
    if (me?.className) setLocalClassName(me.className ?? "");
    if (me?.section) setLocalSection(me.section ?? "");
    if (me?.rollNumber) setLocalRollNumber(me.rollNumber ?? "");
  }, [me?.liveToday, me?.quickMessage, me?.routeId, me?.stationId, me?.photoUrl, me?.parentName, me?.gender, me?.className, me?.section, me?.rollNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSavePhoto() {
    if (!me?.id || !user) return;
    setPhotoSaving(true);
    setPhotoSaved(false);
    try {
      await updatePassenger.mutateAsync({ id: me.id, data: { photoUrl: localPhotoUrl || undefined } });
      queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
      // Sync photo to auth user so the top-right avatar updates immediately
      const res = await fetch(`${BASE}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, name: user.name, title: user.title ?? null, photoUrl: localPhotoUrl || null }),
      });
      if (res.ok) {
        const data = await res.json() as { photoUrl?: string | null; name?: string; title?: string | null };
        login({ ...user, photoUrl: data.photoUrl ?? localPhotoUrl ?? null });
      }
      setPhotoSaved(true);
      setTimeout(() => setPhotoSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setPhotoSaving(false); }
  }

  async function handleSaveProfile() {
    if (!user) return;
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      if (me?.id) {
        await updatePassenger.mutateAsync({
          id: me.id,
          data: {
            parentName: localParentName.trim() || undefined,
            gender: localGender || undefined,
            className: localClassName || undefined,
            section: localSection.trim().toUpperCase() || undefined,
            rollNumber: localRollNumber.trim() || undefined,
          },
        });
      } else {
        await createPassenger.mutateAsync({
          data: {
            name: user.name,
            phone: normalizePhone(user.phone),
            role: (user.role === "student" || user.role === "staff") ? (user.role as any) : "student",
            parentName: localParentName.trim() || undefined,
            gender: localGender || undefined,
            className: localClassName || undefined,
            section: localSection.trim().toUpperCase() || undefined,
            rollNumber: localRollNumber.trim() || undefined,
          },
        });
      }
      await queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
      setProfileSaved(true);
      setEditProfileOpen(false);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setProfileSaving(false); }
  }

  // Profile is complete when at least parentName and gender are filled
  const profileComplete = !!(me?.parentName && me?.gender);
  // Auto-open onboarding once passenger record is loaded and profile is incomplete
  useEffect(() => {
    if (passengers !== undefined && !profileComplete && !editProfileOpen) setEditProfileOpen(true);
  }, [passengers, profileComplete, editProfileOpen]);

  // Load stations when selected route changes
  useEffect(() => {
    if (!selectedRouteId) { setRouteStations([]); return; }
    setLoadingStations(true);
    fetch(`${BASE}/api/routes/${selectedRouteId}/stations`)
      .then((r) => r.json())
      .then((data: RouteStationItem[]) => setRouteStations(data))
      .catch(() => setRouteStations([]))
      .finally(() => setLoadingStations(false));
  }, [selectedRouteId]);

  const handleSaveTransport = useCallback(async () => {
    if (!me?.id) return;
    setTransportSaving(true);
    setTransportSaved(false);
    try {
      await updatePassenger.mutateAsync({
        id: me.id,
        data: {
          routeId: selectedRouteId ? Number(selectedRouteId) : undefined,
          stationId: selectedStationId ? Number(selectedStationId) : undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
      setTransportSaved(true);
      setTransportOpen(false);
      setTimeout(() => setTransportSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setTransportSaving(false); }
  }, [selectedRouteId, selectedStationId, updatePassenger, queryClient]);

  // Boarded lockdown — freeze all action buttons while student is on the bus
  const isBoarded = me?.status === "boarded";

  // Geofencing: alert when driver is within threshold of student's stop
  const myStop = routeStations.find((rs) => String(rs.stationId) === selectedStationId);
  const nearbyAlert = (() => {
    if (isHolidayToday || !driverLoc.isLive || !tripActive || !myStop?.lat || !myStop?.lng || geoAlertDismissed) return false;
    const dLat = (driverLoc.lat - myStop.lat) * 111000;
    const dLng = (driverLoc.lng - myStop.lng) * 111000 * Math.cos(myStop.lat * (Math.PI / 180));
    return Math.sqrt(dLat * dLat + dLng * dLng) < GEO_ALERT_THRESHOLD_METERS;
  })();

  // Nearest route station to driver — infer which stop the bus is currently at
  const nearestDriverStation = (() => {
    if (!driverLoc.isLive || routeStations.length === 0) return null;
    let best: { rs: RouteStationItem; dist: number } | null = null;
    for (const rs of routeStations) {
      if (!rs.lat || !rs.lng) continue;
      const d = haversineKm(driverLoc.lat, driverLoc.lng, rs.lat, rs.lng);
      if (!best || d < best.dist) best = { rs, dist: d };
    }
    return best;
  })();

  // Straight-line km from driver's GPS to this student's registered stop
  const distToMyStopKm = (() => {
    if (!driverLoc.isLive || !myStop?.lat || !myStop?.lng) return null;
    return haversineKm(driverLoc.lat, driverLoc.lng, myStop.lat, myStop.lng);
  })();

  const handleLiveToday = useCallback(async () => {
    if (onLeave) return;
    const next = !liveToday;
    setLiveToday(next);
    await updatePassenger.mutateAsync({ id: me?.id ?? 1, data: { liveToday: next ? 1 : 0 } });
    queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
  }, [liveToday, onLeave, updatePassenger, queryClient]);

  const handleLeave = useCallback(async () => {
    const next = !onLeave;
    setOnLeave(next);
    if (next) {
      setLiveToday(false);
      setSentMsg("Staying home today");
      await updatePassenger.mutateAsync({
        id: me?.id ?? 1,
        data: { liveToday: 0, quickMessage: "Staying home today" },
      });
    } else {
      setSentMsg(null);
      await updatePassenger.mutateAsync({ id: me?.id ?? 1, data: { liveToday: 0 } });
    }
    queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
  }, [onLeave, updatePassenger, queryClient]);

  const handleLeaveClick = useCallback(() => {
    handleLeave();
  }, [handleLeave]);

  const [activeQuickMsg, setActiveQuickMsg] = useState<string | null>(null);

  // SSE: board changes, trip lifecycle, and live station advances
  useEffect(() => {
    const es = new EventSource(`${BASE}/api/events`);

    es.addEventListener("passengers_updated", () => {
      queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
    });

    // Driver tapped Next/Prev — update the displayed stop name immediately
    es.addEventListener("station_changed", (e) => {
      queryClient.invalidateQueries({ queryKey: getGetTripTimelineQueryKey() });
      try {
        const d = JSON.parse((e as MessageEvent).data) as {
          stationIdx?: number; stationName?: string | null;
        };
        if (typeof d.stationIdx === "number") {
          setLiveStation({ idx: d.stationIdx, name: d.stationName ?? null });
        }
      } catch { /* malformed event */ }
    });

    // Admin activated driver or driver started journey — UNFREEZE ALL STUDENT ACTIVITIES IMMEDIATELY!
    es.addEventListener("driver_activated", () => {
      queryClient.invalidateQueries({ queryKey: getGetTripTimelineQueryKey() });
      setTripActive(false);
      setTripCompleted(false);
      setIsFreezeActive(false);
      setFreezeRemainingMinutes(null);
    });

    es.addEventListener("drivers_updated", () => {
      queryClient.invalidateQueries({ queryKey: getGetTripTimelineQueryKey() });
      void syncFromPoll();
    });

    es.addEventListener("trip_started", () => {
      queryClient.invalidateQueries({ queryKey: getGetTripTimelineQueryKey() });
      setTripActive(true);
      setTripCompleted(false);
      setIsFreezeActive(false);
      setFreezeRemainingMinutes(null);
      setLiveStation(null); // reset to stop 0 for the new run
    });

    es.addEventListener("trip_unfrozen", () => {
      queryClient.invalidateQueries({ queryKey: getGetTripTimelineQueryKey() });
      setTripActive(false);
      setTripCompleted(false);
      setIsFreezeActive(false);
      setFreezeRemainingMinutes(null);
      void syncFromPoll();
    });

    es.addEventListener("trip_completed", (e) => {
      queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTripTimelineQueryKey() });
      setTripActive(false);
      setLiveStation(null);
      setTripCompleted(true);
      setIsFreezeActive(true);
      setFreezeRemainingMinutes(240); // 4 hours
      try {
        const d = JSON.parse((e as MessageEvent).data) as { time?: string };
        if (d.time) setCompletedTime(d.time);
      } catch { /* ignore */ }
    });

    es.addEventListener("leave_application_approved", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as { passengerId?: number };
        if (d.passengerId === me?.id) {
          setAppApproved(true);
          queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
        }
      } catch { /* ignore */ }
    });

    return () => es.close();
  }, [queryClient, me?.id]);

  // Hydrate tripActive + liveStation + 4h freeze on page load (mid-journey recovery via 30 s poll)
  async function syncFromPoll() {
    const pid = me?.id;
    if (!pid) return;
    try {
      const r = await fetch(`${BASE}/api/trips/active?passengerId=${pid}`);
      if (!r.ok) return;
      const d = await r.json() as {
        isJourneyActive?: boolean;
        isJourneyCompleted?: boolean;
        isFreezeActive?: boolean;
        freezeRemainingMs?: number;
        stationIdx?: number | null;
        stationName?: string | null;
      };
      if (d.isJourneyActive || !d.isFreezeActive) {
        setTripActive(!!d.isJourneyActive);
        setTripCompleted(false);
        setIsFreezeActive(false);
        setFreezeRemainingMinutes(null);
        if (typeof d.stationIdx === "number") {
          setLiveStation({ idx: d.stationIdx, name: d.stationName ?? null });
        }
      } else if (d.isFreezeActive || d.isJourneyCompleted) {
        setIsFreezeActive(true);
        setTripCompleted(true);
        if (typeof d.freezeRemainingMs === "number") {
          setFreezeRemainingMinutes(Math.ceil(d.freezeRemainingMs / 60000));
        }
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!me?.id) return;
    void syncFromPoll();
    const interval = setInterval(syncFromPoll, 30000);
    return () => clearInterval(interval);
  }, [me?.id]);

  // Hydrate student leave approval notification status on load
  useEffect(() => {
    const pid = me?.id;
    if (!pid) return;
    async function checkStudentNotifs() {
      try {
        const r = await fetch(`${BASE}/api/notifications?passengerId=${pid}`);
        if (!r.ok) return;
        const list = await r.json() as Array<{ status?: string; title?: string }>;
        if (list.some((n) => n.status === "approved" || n.title?.includes("Approved"))) {
          setAppApproved(true);
        }
      } catch { /* ignore */ }
    }
    void checkStudentNotifs();
  }, [me?.id]);

  const handleQuickMessage = useCallback(async (msg: string) => {
    setActiveQuickMsg(msg);
    setSentMsg(msg);
    await updatePassenger.mutateAsync({ id: me?.id ?? 1, data: { quickMessage: msg } });
    queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
  }, [updatePassenger, queryClient]);


  return (
    <div className="w-full px-4 pb-8 pt-4 flex flex-col gap-5">

      {/* Payment modal overlay */}
      {paymentModalOpen && (
        <PaymentModal
          passengerId={me?.id ?? 0}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={() => {
            setPaymentModalOpen(false);
            queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
          }}
        />
      )}

      {/* Profile setup / edit modal — fullscreen blocking on first login, drawer on edit */}
      {editProfileOpen && me && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <div>
              <p className="text-sm font-bold text-foreground">
                {profileComplete ? "Edit Profile" : "Complete Your Profile"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profileComplete ? "Update your details" : "Please fill in your details to continue"}
              </p>
            </div>
            {profileComplete && (
              <button onClick={() => setEditProfileOpen(false)} className="rounded-full p-1.5 hover:bg-muted transition-colors">
                <X size={18} className="text-muted-foreground" />
              </button>
            )}
          </div>
          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {/* Photo inside modal */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User size={14} className="text-amber-500" /> Profile Photo
              </p>
              <PhotoPicker value={localPhotoUrl} onChange={setLocalPhotoUrl} name={me.name} />
              {localPhotoUrl !== (me.photoUrl ?? "") && (
                <button onClick={handleSavePhoto} disabled={photoSaving}
                  className="w-full rounded-xl bg-amber-500 py-2 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors">
                  {photoSaving ? "Saving…" : "Save Photo"}
                </button>
              )}
            </div>

            {/* Profile fields */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 text-xs">
              <p className="text-sm font-semibold text-foreground">Personal Details</p>
              <div>
                <label className="mb-1 block font-semibold text-muted-foreground">Parent / Guardian Name <span className="text-red-500">*</span></label>
                <input value={localParentName} onChange={(e) => setLocalParentName(e.target.value)}
                  placeholder="e.g., Ram Prasad Shrestha"
                  className="w-full border border-border rounded-lg p-2.5 bg-background outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-muted-foreground">Gender <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {["Male", "Female", "Other"].map((g) => (
                    <button key={g} type="button" onClick={() => setLocalGender(localGender === g ? "" : g)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${localGender === g ? "bg-amber-500 border-amber-500 text-slate-900" : "border-border bg-background text-foreground hover:bg-muted"}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-semibold text-muted-foreground">Class</label>
                  <select value={localClassName} onChange={(e) => setLocalClassName(e.target.value)}
                    className="w-full border border-border rounded-lg p-2.5 bg-background">
                    <option value="">Select class</option>
                    {["Play Group","Nursery","LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12","Others"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-muted-foreground">Section</label>
                  <input value={localSection} onChange={(e) => setLocalSection(e.target.value.toUpperCase())}
                    placeholder="e.g., A"
                    className="w-full border border-border rounded-lg p-2.5 bg-background outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-muted-foreground">Roll Number</label>
                <input value={localRollNumber} onChange={(e) => setLocalRollNumber(e.target.value)}
                  placeholder="e.g., 12"
                  className="w-full border border-border rounded-lg p-2.5 bg-background outline-none" />
              </div>
            </div>
          </div>
          {/* Sticky save button */}
          <div className="px-4 py-4 border-t border-border bg-card">
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving || !localParentName.trim() || !localGender}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors"
            >
              {profileSaving ? "Saving…" : profileSaved ? "✓ Saved!" : profileComplete ? "Update Profile" : "Save & Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Subscription expiry warning banner */}
      {showExpiryBanner && daysLeft !== null && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-400 bg-orange-50 dark:bg-orange-950/30 px-4 py-3">
          <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
              Bus access expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
              Renew now to keep tracking your bus without interruption.
            </p>
          </div>
          <button
            onClick={() => setPaymentModalOpen(true)}
            className="shrink-0 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition-colors"
          >
            Renew
          </button>
        </div>
      )}

      {/* Calendar upcoming events urgent banner */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-2">
          {upcomingEvents.map((ev) => {
            const isToday = ev.eventDate === todayAdStr;
            const isHoliday = ev.type === "holiday";
            return (
              <div key={ev.id} className={`flex items-start gap-3 rounded-xl border p-3 ${isHoliday ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30" : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"}`}>
                <span className="text-lg">{isHoliday ? "🎉" : "📅"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-wide ${isHoliday ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {isHoliday ? "Holiday" : "Event"} {isToday ? "Today" : "Tomorrow"}
                  </p>
                  <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                  {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* ── Bus Status Banner — always visible, three lifecycle states ── */}
      {(() => {
        // State 3: Journey Completed & 4-Hour Freeze Period — evaluated FIRST so boarded students see completion
        if (tripCompleted || isFreezeActive) {
          return (
            <div className="rounded-xl border border-sky-400 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 py-2.5 px-4 text-white shadow-lg space-y-2">
              <div className="flex items-center gap-3">
                <CheckCircle size={30} className="text-white drop-shadow shrink-0 animate-bounce" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <p className="font-bold text-sm">Journey Completed! 🎒</p>
                    <span className="rounded-full bg-sky-950/70 border border-sky-300/40 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                      🔒 4h Freeze Active {freezeRemainingMinutes ? `(${freezeRemainingMinutes}m left)` : ""}
                    </span>
                  </div>
                  <p className="text-xs text-sky-100 mt-0.5 leading-snug">
                    {completedTime ? `Bus reached destination at ${completedTime}. ` : "Bus has reached the destination. "}
                    Driver activities are frozen for 4 hours.
                  </p>
                </div>
              </div>
              <div className="pt-1.5 border-t border-sky-400/30 flex items-center justify-between gap-2">
                <span className="text-[11px] text-sky-100">Need help or have an inquiry for Admin?</span>
                <button
                  onClick={() => setAdminMsgModalOpen(true)}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-blue-900 hover:bg-sky-50 shadow transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Send size={12} />
                  Message Admin
                </button>
              </div>
            </div>
          );
        }
        // State 2: After Boarding — live school distance + current station
        if (isBoarded) {
          const schoolStation = routeStations.length > 0 ? routeStations[routeStations.length - 1] : null;
          const distToSchoolKm =
            driverLoc.isLive && schoolStation?.lat && schoolStation?.lng
              ? haversineKm(driverLoc.lat, driverLoc.lng, schoolStation.lat, schoolStation.lng)
              : null;
          const passingStation = nearestDriverStation?.rs.stationName ?? null;
          return (
            <div className="rounded-xl border border-green-400 bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <Bus size={36} className="text-white drop-shadow shrink-0 animate-pulse" />
                <div className="min-w-0">
                  <p className="font-bold text-sm">You are safely on board! 🎒</p>
                  <p className="text-xs text-green-100 mt-0.5 leading-snug">
                    {distToSchoolKm != null
                      ? `School is ${distToSchoolKm.toFixed(1)} km away${passingStation ? ` — currently passing ${passingStation}` : ""}`
                      : passingStation
                        ? `Currently passing ${passingStation} · 🔒 Actions locked`
                        : "🔒 Dashboard actions are locked until the journey ends."}
                  </p>
                </div>
              </div>
            </div>
          );
        }
        // State 0: Holiday Today — School & Bus service closed
        if (isHolidayToday) {
          return (
            <div className="rounded-xl border border-red-300 dark:border-red-800/60 bg-gradient-to-r from-red-500/90 via-rose-600 to-rose-700 p-4 text-white shadow-md">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎉</span>
                <div className="min-w-0">
                  <p className="font-bold text-sm">HOLIDAY TODAY · साप्ताहिक बिदा</p>
                  <p className="text-xs text-rose-100 mt-0.5 leading-snug">
                    School is closed today for Holiday. Bus tracking & live services are off duty.
                  </p>
                </div>
              </div>
            </div>
          );
        }

        // State 1a: Before Boarding — bus is broadcasting live GPS & trip is active
        if (driverLoc.isLive && tripActive) {
          // Use the exact stop from driver SSE if available, fall back to GPS-nearest
          const displayStation = liveStation?.name ?? nearestDriverStation?.rs.stationName ?? null;
          return (
            <div className="relative rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white shadow-lg">
              {nearbyAlert && (
                <span className="absolute -top-2 -right-2 animate-bounce rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  NEAR!
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Bus size={36} className={`text-white drop-shadow shrink-0 ${nearbyAlert ? "animate-pulse" : ""}`} />
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{t.busNearby}</p>
                    <p className="text-xs text-amber-100 mt-0.5 leading-snug">
                      {displayStation
                        ? tpl(t.busAtStation, {
                            station: displayStation,
                            dist: distToMyStopKm != null ? `${distToMyStopKm.toFixed(1)} (~${Math.max(1, Math.round((distToMyStopKm / 25) * 60))}m)` : "?",
                            stop: myStop?.stationName ?? "your stop",
                          })
                        : myStop?.stationName
                          ? tpl(t.approachingStop, { stop: myStop.stationName })
                          : t.busIsClose}
                    </p>
                  </div>
                </div>
                {!geoAlertDismissed && (
                  <button
                    onClick={() => setGeoAlertDismissed(true)}
                    className="shrink-0 rounded-full p-1 hover:bg-white/20 text-white text-xs"
                  >✕</button>
                )}
              </div>
            </div>
          );
        }
        // State 1b-active: Journey started, driver advancing stops but no GPS yet
        if (tripActive && liveStation != null) {
          return (
            <div className="relative rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Bus size={36} className="text-white drop-shadow shrink-0 animate-pulse" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm">🚌 Bus En Route</p>
                    <p className="text-xs text-amber-100 mt-0.5 leading-snug">
                      Now at stop {liveStation.idx + 1}
                      {liveStation.name ? `: ${liveStation.name}` : ""}
                      {myStop?.stationName ? ` · Your stop: ${myStop.stationName}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        // State 1b-waiting: Journey active but no station data yet
        if (tripActive) {
          return (
            <div className="rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <Bus size={36} className="text-white drop-shadow shrink-0 animate-pulse" />
                <div className="min-w-0">
                  <p className="font-bold text-sm">🚌 Bus En Route</p>
                  <p className="text-xs text-amber-100 mt-0.5 leading-snug">
                    {myStop?.stationName
                      ? `Heading to your stop: ${myStop.stationName}`
                      : "Your bus is on its way"}
                  </p>
                </div>
              </div>
            </div>
          );
        }
        // State 1b: Before Boarding — waiting for bus to start
        return (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white shadow-sm opacity-75">
            <div className="flex items-center gap-3">
              <Bus size={36} className="text-white/80 drop-shadow shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-sm">Waiting for bus service…</p>
                <p className="text-xs text-amber-100 mt-0.5 leading-snug">
                  {myStop?.stationName
                    ? `Your stop: ${myStop.stationName} · Bus hasn't started yet`
                    : "Your bus hasn't started the route yet"}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Profile chip — tappable, opens profile modal; photo shown left of name */}
      {user && (
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={() => setEditProfileOpen(true)}
            className="flex-1 border border-border rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent px-3 py-2.5 flex items-center gap-3 hover:bg-amber-500/10 transition-colors text-left min-w-0"
          >
            {/* Avatar */}
            <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-amber-400 bg-muted shrink-0 flex items-center justify-center">
              {localPhotoUrl || me?.photoUrl
                ? <img src={localPhotoUrl || me?.photoUrl!} alt={user.name} className="h-full w-full object-cover" />
                : <User size={18} className="text-muted-foreground" />}
            </div>
            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">
                  {user.title ? `${user.title} ` : ""}{user.name}
                </span>
                <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                  {user.role}
                </span>
              </div>

              {(() => {
                const station = routeStations.find(rs => String(rs.stationId) === selectedStationId);
                return station?.stationName ? (
                  <p className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                    <MapPin size={9} className="shrink-0 text-amber-500" />
                    {station.stationName}
                  </p>
                ) : null;
              })()}
            </div>
          </button>
          <SpeedIndicator speed={driverLoc?.speedKmh} isLive={driverLoc?.isLive} />
          <NotificationBell passengerId={me?.id} userRole="student" />
        </div>
      )}

      {/* Live Distance Card — updates every GPS ping from the driver (Hidden during 4h freeze) */}
      {driverLoc.isLive && !(isFreezeActive || tripCompleted) && (
        (() => {
          const schoolStation = routeStations.length > 0 ? routeStations[routeStations.length - 1] : null;
          const distToSchoolKm = schoolStation?.lat && schoolStation?.lng
            ? haversineKm(driverLoc.lat, driverLoc.lng, schoolStation.lat, schoolStation.lng)
            : null;
          return (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Live Bus Distance</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground font-medium mb-0.5">🚏 Your Stop</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400 leading-tight">
                    {distToMyStopKm != null ? (
                      <span className="flex flex-col items-center">
                        <span>{distToMyStopKm.toFixed(1)} km</span>
                        <span className="text-xs text-amber-600/80">(~{Math.max(1, Math.round((distToMyStopKm / 25) * 60))} min)</span>
                      </span>
                    ) : "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground truncate">{myStop?.stationName ?? "Not set"}</p>
                </div>
                <div className="rounded-lg bg-white dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground font-medium mb-0.5">🏫 School</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400 leading-tight">
                    {distToSchoolKm != null ? `${distToSchoolKm.toFixed(1)} km` : "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground truncate">{schoolStation?.stationName ?? "Last stop"}</p>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Riding Today / Leave Status */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{t.todaysStatus}</p>
          {(isFreezeActive || tripCompleted) && (
            <span className="flex items-center gap-1 rounded-full bg-sky-950/40 border border-sky-500/40 px-2 py-0.5 text-[10px] font-bold text-sky-400">
              <Lock size={10} /> 4h Freeze Active
            </span>
          )}
        </div>
        <div className={`grid grid-cols-2 gap-2 ${(isFreezeActive || tripCompleted) ? "opacity-50 pointer-events-none select-none" : ""}`}>
          <button
            onClick={handleLiveToday}
            disabled={isBoarded || onLeave || isFreezeActive || tripCompleted}
            className={`rounded-xl py-3 text-sm font-semibold transition-all ${
              isBoarded || isFreezeActive || tripCompleted
                ? "bg-muted text-muted-foreground border border-border opacity-50 cursor-not-allowed"
                : liveToday && !onLeave
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-muted text-muted-foreground border border-border disabled:opacity-50"
            }`}
          >
            {liveToday && !onLeave && !isBoarded ? t.ridingToday : t.markLive}
          </button>
          <button
            onClick={handleLeaveClick}
            disabled={isBoarded || isFreezeActive || tripCompleted}
            className={`rounded-xl py-3 text-sm font-semibold transition-all select-none ${
              isBoarded || isFreezeActive || tripCompleted
                ? "bg-muted text-muted-foreground border border-border opacity-50 cursor-not-allowed"
                : onLeave
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            {isBoarded ? (
              <span className="flex items-center justify-center gap-1"><Lock size={12} /> {t.locked}</span>
            ) : isFreezeActive || tripCompleted ? (
              <span className="flex items-center justify-center gap-1"><Lock size={12} /> Frozen</span>
            ) : onLeave ? (
              <span className="flex items-center justify-center gap-1"><X size={12} /> {t.onLeave}</span>
            ) : t.takeLeave}
          </button>
        </div>
        {(isFreezeActive || tripCompleted) ? (
          <div className="flex items-center gap-2 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 px-3 py-2">
            <Lock size={12} className="shrink-0 text-sky-600 dark:text-sky-400" />
            <p className="text-xs text-sky-700 dark:text-sky-400 font-medium">
              Status updates frozen after journey completion. Unfreezes when driver starts next run.
            </p>
          </div>
        ) : isBoarded ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2">
            <Lock size={12} className="shrink-0 text-green-600 dark:text-green-400" />
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">{t.actionsLocked}</p>
          </div>
        ) : sentMsg ? (
          <div className="rounded-lg dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 bg-background text-xs font-extrabold text-[#000]">
            Driver notified: <span className="font-semibold text-[#007500]">{onLeave ? "Not Riding Today" : "Coming to School Today"}</span>
          </div>
        ) : null}
      </div>

      {/* Featured School Spotlight Advertisement Board — placed between Today's Status and Notice Board */}
      {ads.length > 0 && (
        <AdCarousel ads={ads} />
      )}

      {/* Notice Board */}
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 overflow-hidden shadow-sm">
        {/* Board header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#FFF078]">
          <ClipboardList size={18} className="text-slate-900" />
          <div className="flex-1">
            <p className="font-bold text-slate-900 text-sm leading-tight">Notice Board</p>
            <p className="text-[10px] text-amber-900/70">From your school administration</p>
          </div>
          {filteredAnnouncements?.length ? (
            <span className="rounded-full bg-slate-900/20 px-2 py-0.5 text-[10px] font-bold text-slate-900">
              {filteredAnnouncements.length} notice{filteredAnnouncements.length > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
        {/* Notices list — 2 visible, rest scrollable */}
        <div className="divide-y divide-amber-200 dark:divide-amber-800/30 max-h-[116px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-300 dark:[&::-webkit-scrollbar-thumb]:bg-amber-700 hover:[&::-webkit-scrollbar-thumb]:bg-amber-500">
          {filteredAnnouncements?.length ? (
            filteredAnnouncements.map((a, idx) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3 bg-background">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-slate-900 bg-[#fff647]">
                  {idx + 1}
                </span>
                <p className="text-sm dark:text-amber-200 leading-snug text-[#FF9F00] font-bold">{a.message}</p>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-amber-700 dark:text-amber-400">No notices at this time</p>
              <p className="text-xs text-amber-600/60 dark:text-[#FFF078]/50 mt-0.5">Check back later for updates from your school</p>
            </div>
          )}
        </div>
      </div>



        {/* GPS / Tracking — paying users only */}
        {isPaying ? (
        <><div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-primary text-sm flex items-center gap-1.5"><Map size={14} /> Live Bus Location</h2>
            <div className="flex items-center gap-2">
              {(isFreezeActive || tripCompleted) ? (
                <span className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 font-bold">
                  <Lock size={12} /> CLOSED
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse inline-block" />
                  LIVE
                </span>
              )}
            </div>
          </div>

          {(isFreezeActive || tripCompleted) ? (
            <div className="rounded-2xl border border-sky-300 dark:border-sky-800/60 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-indigo-950/40 p-5 text-center space-y-2 shadow-inner">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300">
                <Lock size={24} />
              </div>
              <p className="text-sm font-bold text-sky-900 dark:text-sky-200">
                Live Map &amp; Bus Tracking Closed / नक्सा तथा बस स्थान बन्द छ 🎒
              </p>
              <p className="text-xs text-sky-700 dark:text-sky-300 max-w-sm mx-auto leading-relaxed">
                Today's bus journey is completed. Map tracking &amp; live location are frozen for 4 hours and will automatically unfreeze when the driver starts the next route run.
              </p>
            </div>
          ) : (
            <>
              {/* Route-locked Bus Info Banner */}
              {(() => {
                const selRoute = (routes ?? []).find((r) => r.id === Number(selectedRouteId));
                if (!selRoute) return (
                  <button
                    onClick={() => setTransportOpen(true)}
                    className="w-full flex items-center gap-3 rounded-xl border border-dashed border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10 px-4 py-2.5 text-left hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                  >
                    <Route size={14} className="text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">No route selected</p>
                      <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70">Tap to choose your bus route ↓</p>
                    </div>
                  </button>
                );
                return (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${selRoute.isActive ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{selRoute.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {selRoute.vehiclePlate ? (
                          <><span className="font-semibold text-amber-700 dark:text-amber-400">{selRoute.vehiclePlate}</span>{selRoute.driverName ? ` · ${selRoute.driverName}` : ""}</>
                        ) : selRoute.driverName ?? "No bus assigned"}
                      </p>
                    </div>
                    <button onClick={() => setTransportOpen(true)} className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">change</button>
                  </div>
                );
              })()}

              {/* GPS Status Bar with Real-Time Speed & Motion State */}
              {(() => {
                const isBusLive = driverLoc.isLive || tripActive;
                return (
                  <div className="rounded-xl border border-border bg-muted/40 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 truncate">
                        <Bus size={12} className="text-amber-500 shrink-0" />
                        {driverLoc.vehicleNumber ? `Bus: ${driverLoc.vehicleNumber}` : "Bus Location"}
                      </p>
                      <p className="text-sm font-semibold text-foreground font-mono truncate">
                        {isBusLive
                          ? `${driverLoc.lat.toFixed(4)}°N, ${driverLoc.lng.toFixed(4)}°E`
                          : "Bus Offline (Parked)"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground font-medium">
                        {isBusLive
                          ? ((driverLoc.speedKmh ?? 0) > 3 ? "⚡ Moving" : "⏸️ Stopped")
                          : "Status"}
                      </p>
                      <p className={`text-sm font-bold flex items-center gap-1 justify-end ${isBusLive ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                        <span className={`h-2 w-2 rounded-full inline-block ${isBusLive ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                        {isBusLive
                          ? `${driverLoc.speedKmh != null && driverLoc.speedKmh > 0 ? Math.round(driverLoc.speedKmh) : 0} km/h`
                          : "Offline"}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="rounded-xl overflow-hidden border border-border shadow-sm" style={{ height: 280 }}>
                <OsmMap
                  mode="tracking"
                  route={routeStations.filter((rs) => rs.lat && rs.lng).map((rs) => ({ lat: rs.lat!, lng: rs.lng!, name: rs.stationName ?? `Stop ${rs.id}` }))}
                  lat={driverLoc.lat}
                  lng={driverLoc.lng}
                  isLive={driverLoc.isLive || tripActive}
                  label={driverLoc.vehicleNumber ?? undefined}
                  height={280}
                />
              </div>
              {routeStations.length > 0 ? (
                <p className="text-xs text-muted-foreground text-center">
                  Your route · {routeStations.length} stop{routeStations.length !== 1 ? "s" : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground text-center">Next stop: Kalanki Chowk</p>
              )}
            </>
          )}
      </div>

      {/* Route Stops — my stop pinned, rest scrollable */}
      {routeStations.length > 0 && (() => {
        const myStop = routeStations.find(rs => String(rs.stationId) === selectedStationId);
        const otherStops = routeStations.filter(rs => String(rs.stationId) !== selectedStationId);
        const saveStop = async (rs: RouteStationItem) => {
          setSelectedStationId(String(rs.stationId));
          setTransportSaving(true);
          try {
            await updatePassenger.mutateAsync({
              id: me?.id ?? 1,
              data: { routeId: selectedRouteId ? Number(selectedRouteId) : undefined, stationId: rs.stationId },
            });
            queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
            setTransportSaved(true);
            setTimeout(() => setTransportSaved(false), 2500);
          } catch { /* ignore */ }
          finally { setTransportSaving(false); }
        };
        return (
          <div className="space-y-1.5">
            <button
              onClick={() => setRouteStopsOpen(!routeStopsOpen)}
              className="w-full flex items-center justify-between font-semibold text-primary text-sm focus:outline-none hover:opacity-85 transition-opacity"
            >
              <span className="flex items-center gap-1.5">
                <Navigation size={14} /> Your Route Stops
              </span>
              {routeStopsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {routeStopsOpen && (
              <div className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Pinned: user's current stop */}
                {myStop && (
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/40">
                    <MapPin size={13} className="shrink-0 text-amber-500" />
                    <p className="flex-1 text-sm font-bold text-amber-700 dark:text-amber-400 truncate">
                      {myStop.stationName ?? `Stop ${myStop.stationId}`}
                    </p>
                    <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">Your stop</span>
                  </div>
                )}
                {/* Scrollable: all other stops */}
                {otherStops.length > 0 && (
                  <div className="divide-y divide-border max-h-[180px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-amber-400">
                    {otherStops.map((rs) => (
                      <button
                        key={rs.id}
                        onClick={() => saveStop(rs)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      >
                        <div className="h-2 w-2 shrink-0 rounded-full border border-border bg-transparent" />
                        <p className="flex-1 text-xs text-foreground truncate">
                          {rs.stationName ?? `Stop ${rs.stationId}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {transportSaved && (
              <p className="text-xs text-green-600 font-medium flex items-center gap-1 px-1">
                <CheckCircle size={11} /> Stop updated
              </p>
            )}
          </div>
        );
      })()}

      {/* Tracking Timeline */}
      <div className="space-y-2">
        <h2 className="font-semibold text-primary text-sm flex items-center gap-1.5"><Clock size={14} /> Tracking Timeline</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {timeline ? (
            <div className="divide-y divide-border max-h-52 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-amber-500">
              {timeline.map((event, idx) => (
                <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <div className={`h-3 w-3 rounded-full border-2 ${
                      event.status === "completed"
                        ? "border-green-500 bg-green-500"
                        : idx === timeline.findIndex(e => e.status !== "completed")
                        ? "border-amber-500 bg-amber-500 animate-pulse"
                        : "border-border bg-transparent"
                    }`} />
                    {idx < timeline.length - 1 && (
                      <div className={`w-0.5 h-4 ${event.status === "completed" ? "bg-green-300" : "bg-border"}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="text-sm font-medium text-foreground">{event.description}</p>
                    <p className="text-xs text-muted-foreground">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground p-4">Loading timeline...</p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><MessageSquare size={14} /> Quick Message to Driver</p>
          {(isFreezeActive || tripCompleted) ? (
            <span className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 font-bold"><Lock size={10} /> Frozen</span>
          ) : isBoarded ? (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium"><Lock size={10} /> {t.locked}</span>
          ) : sentMsg ? (
            <span className="text-xs text-green-600 font-medium">✓ Sent</span>
          ) : null}
        </div>
        <div className={`grid grid-cols-2 gap-2 ${(isBoarded || isFreezeActive || tripCompleted) ? "opacity-50 pointer-events-none select-none" : ""}`}>
          {QUICK_MESSAGES.map((msg) => {
            const isActive = activeQuickMsg === msg.value;
            return (
              <button
                key={msg.value}
                onClick={() => handleQuickMessage(msg.value)}
                disabled={isBoarded || isFreezeActive || tripCompleted}
                className={`rounded-xl border px-3 py-2.5 text-xs font-medium text-left transition-all active:scale-[0.97] ${
                  isActive
                    ? "border-[#ffee47] bg-[#ffee47] text-slate-900 shadow-md scale-[0.98]"
                    : "border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 text-[#ffcd28] dark:text-amber-300 hover:border-[#ffee47] hover:bg-amber-100 dark:hover:bg-amber-950/70"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <msg.Icon size={13} className="shrink-0" />
                  {msg.label}
                </span>
              </button>
            );
          })}
        </div>
      </div></>) : (
        /* Non-paying paywall card */
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 px-5 py-4 bg-slate-100 dark:bg-slate-800/70 border-b border-border">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700">
              <ShieldAlert size={18} className="text-slate-500" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Bus Tracking Unavailable</p>
              <p className="text-xs text-muted-foreground mt-0.5">Activate your subscription to track your bus live</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              {[
                "Live GPS map of your school bus",
                "Real-time arrival alerts at your stop",
                "Driver communication & tracking timeline",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  {feat}
                </div>
              ))}
            </div>
            <div className="h-32 rounded-xl border border-dashed border-border bg-muted/30 flex items-center justify-center">
              <div className="text-center">
                <Map size={28} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">GPS map locked</p>
              </div>
            </div>
            {me?.routeId ? (
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-900 hover:bg-amber-400 transition-colors"
              >
                <CreditCard size={15} />
                Renew Bus Access — NPR 1,500/mo
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">First, select your route below to activate tracking</p>
                <button
                  onClick={() => { setTransportOpen(true); (document.getElementById("transport-config") as HTMLElement)?.scrollIntoView({ behavior: "smooth" }); }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/30 py-3 text-sm font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                >
                  <Route size={15} />
                  Select Your Route Below
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transport Configuration */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <button
          onClick={() => !(isFreezeActive || tripCompleted) && setTransportOpen((v) => !v)}
          disabled={isFreezeActive || tripCompleted}
          className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors ${(isFreezeActive || tripCompleted) ? "opacity-60 cursor-not-allowed bg-muted/20" : "hover:bg-muted/40"}`}
        >
          <div className="flex items-center gap-2.5">
            <Route size={15} className="text-[#FFF078] shrink-0" />
            <div className="text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Transport Configuration</p>
                {(isFreezeActive || tripCompleted) && (
                  <span className="flex items-center gap-1 rounded-full bg-sky-950/40 border border-sky-500/40 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                    <Lock size={10} /> Locked (4h Freeze)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {(isFreezeActive || tripCompleted)
                  ? "Route & station configuration is locked after trip completion"
                  : me?.routeId
                    ? `Route ${(routes ?? []).find((r) => r.id === me.routeId)?.name ?? `#${me.routeId}`} · station configured`
                    : "No route assigned — tap to configure"}
              </p>
            </div>
          </div>
          <span className="text-muted-foreground text-xs">{(isFreezeActive || tripCompleted) ? <Lock size={14} /> : transportOpen ? "▲" : "▼"}</span>
        </button>

        {transportOpen && !(isFreezeActive || tripCompleted) && (
          <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
            {/* Route picker */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Your Route</label>
              <select
                value={selectedRouteId}
                onChange={(e) => { setSelectedRouteId(e.target.value); setSelectedStationId(""); }}
                className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500"
              >
                <option value="">Select a route…</option>
                {(routes ?? []).filter((r) => r.isActive).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Station picker */}
            {selectedRouteId && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Navigation size={10} />Your Pickup / Drop-off Station
                </label>
                {loadingStations ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <RefreshCw size={11} className="animate-spin" />Loading stations…
                  </div>
                ) : routeStations.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">No stations on this route yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {routeStations.map((rs, idx) => (
                      <button
                        key={rs.id}
                        onClick={() => setSelectedStationId(String(rs.stationId))}
                        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                          selectedStationId === String(rs.stationId)
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                            : "border-border bg-muted/30 hover:border-amber-300"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-[#FFF078] w-4 shrink-0">{idx + 1}</span>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground">{rs.stationName ?? `Station #${rs.stationId}`}</p>
                          {rs.radius && <p className="text-[9px] text-muted-foreground">{rs.radius}m geofence</p>}
                        </div>
                        {selectedStationId === String(rs.stationId) && (
                          <CheckCircle size={13} className="text-[#FFF078] shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save button */}
            <div className="pt-1 flex items-center gap-3">
              <button
                onClick={handleSaveTransport}
                disabled={!selectedRouteId || !selectedStationId || transportSaving}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-50 transition-colors bg-[#ffee47]"
              >
                {transportSaving ? "Saving…" : "Save Transport Config"}
              </button>
              {transportSaved && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle size={12} />Saved!
                </span>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Your driver will see your assigned station on the boarding checklist
            </p>
          </div>
        )}
      </div>

      {/* ── Approved Leave Application Banner ── */}
      {appApproved && (
        <div className="rounded-xl border border-emerald-400 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-700 p-4 text-white shadow-lg space-y-2 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle size={32} className="text-white shrink-0 animate-bounce" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Leave Application Approved! ✓</p>
              <p className="text-xs text-emerald-100 mt-0.5 leading-snug">
                Your leave application has been officially approved by School Administration. (तपाईंको बिदाको निवेदन स्वीकृत भयो।)
              </p>
            </div>
            <button
              onClick={() => setAppApproved(false)}
              className="rounded-lg bg-emerald-900/60 p-1 text-emerald-200 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Direct Message to School Admin Section (Visible when unfrozen; during 4h freeze top blue banner handles this) ── */}
      {!(isFreezeActive || tripCompleted) && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-400">
              <MessageSquare size={14} />
              <p className="text-xs font-bold text-white">Send Message to School Admin</p>
            </div>
            <span className="rounded-full bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
              ✓ Active & Available
            </span>
          </div>
          <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
            Need help or have an inquiry? Send a direct message to school administration.
          </p>
          <button
            onClick={openAdminMsgModal}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] py-2 transition-colors shadow-md"
          >
            <Send size={12} />
            Message Admin / प्रशासनलाई सन्देश पठाउनुहोस्
          </button>
        </div>
      )}

      {/* ── Direct Message to School Admin Modal ── */}
      {adminMsgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Send size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Send Message to School Admin</h3>
                  <p className="text-[10px] text-muted-foreground">प्रशासनलाई प्रत्यक्ष सन्देश पठाउनुहोस्</p>
                </div>
              </div>
              <button
                onClick={() => setAdminMsgModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {adminMsgToast ? (
              <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 p-4 text-xs text-emerald-300 font-semibold text-center space-y-1">
                <p className="text-sm font-bold">✓ {adminMsgToast}</p>
                <p className="text-[10px] text-emerald-400/80">Delivered to School Administration log.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Select Application / Message Template:</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setAdminMsgText(generateLeaveTemplate())}
                      className="rounded-lg border border-blue-400/50 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1"
                    >
                      📄 Leave Application (बिदाको निवेदन)
                    </button>
                    <button
                      onClick={() => setAdminMsgText("Respected Admin,\nI have an inquiry regarding bus pickup timing & route today. Kindly inform.\nThank you!")}
                      className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors flex items-center gap-1"
                    >
                      🚌 Bus Inquiry (बस जानकारी)
                    </button>
                    <button
                      onClick={() => setAdminMsgText("")}
                      className="rounded-lg border border-border bg-muted px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      ✏️ Clear / Custom
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Application Letter Content (Editable):</label>
                  <textarea
                    value={adminMsgText}
                    onChange={(e) => setAdminMsgText(e.target.value)}
                    placeholder="Type your message to admin here... (उदा: बिदाको निवेदन / प्रश्न)"
                    rows={11}
                    className="w-full rounded-xl border border-input bg-background p-3 text-xs text-foreground font-mono focus:border-blue-500 focus:outline-none leading-relaxed resize-y select-text"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => setAdminMsgModalOpen(false)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendAdminMessage}
                    disabled={!adminMsgText.trim() || adminMsgSending}
                    className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-2 text-xs font-bold text-white shadow-md transition-all flex items-center gap-1.5"
                  >
                    {adminMsgSending ? "Sending…" : "Send Application ✓"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
