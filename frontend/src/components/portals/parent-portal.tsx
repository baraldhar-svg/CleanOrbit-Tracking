import { useState, useEffect } from "react";
import OsmMap from "@/components/osm-map";
import { useDriverLocation } from "@/hooks/use-driver-location";
import { useAuth } from "@/hooks/use-auth";
import { useListAnnouncements, useGetTripTimeline, useListCalendarEvents, useListRoutes, useListTripHistory, useListPassengers } from "@workspace/api-client-react";
import { PhotoPicker } from "@/components/photo-picker";
import { Bus, Lock, Unlock, MapPin, Navigation, ChevronDown, CheckCircle, Star, Clock, History as HistoryIcon, X, User } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ROUTE_PREF_KEY = "orbittrack_parent_route";
// v2: now stores route_station row ID (supports duplicate stops)
const STOP_PREF_KEY = "orbittrack_parent_stop_v2";
const LOCKED_KEY = "orbittrack_parent_locked";

type RouteStation = {
  id: number; routeId: number; stationId: number; position: number;
  direction: string; stopLabel: string | null; eta: string | null;
  stationName: string | null; lat: number | null; lng: number | null; radius: number | null;
};

type Tab = "tracking" | "history";

function todayAdStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function tomorrowAdStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ParentPortal() {
  const { user, login } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("tracking");
  const [childProfileOpen, setChildProfileOpen] = useState(false);

  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(() => {
    const v = localStorage.getItem(ROUTE_PREF_KEY);
    return v ? Number(v) : null;
  });

  // Look up passengers linked to the current parent's phone number so we can
  // pass a real passengerId to the trip history query and get per-child boarding status.
  const { data: myPassengers } = useListPassengers(
    user?.phone ? { phone: user.phone } : undefined
  );
  const childPassengerId = myPassengers?.[0]?.id ?? null;

  const { data: announcements } = useListAnnouncements();
  const { data: timeline } = useGetTripTimeline();
  const { data: tripHistory } = useListTripHistory({
    ...(selectedRouteId != null ? { routeId: selectedRouteId } : {}),
    ...(childPassengerId != null ? { passengerId: childPassengerId } : {}),
    limit: 30,
  });
  const { data: routes } = useListRoutes();

  const thisMonth = todayAdStr().slice(0, 7);
  const { data: calEvents } = useListCalendarEvents({ month: thisMonth });

  const todayStr = todayAdStr();
  const tmrStr = tomorrowAdStr();

  const upcomingEvents = (calEvents ?? []).filter(
    (e) => e.eventDate === todayStr || e.eventDate === tmrStr
  );
  // selectedStopId = route_station row ID (not stationId) so duplicate stops are uniquely identified
  const [selectedStopId, setSelectedStopId] = useState<number | null>(() => {
    const v = localStorage.getItem(STOP_PREF_KEY);
    return v ? Number(v) : null;
  });
  const [locked, setLocked] = useState<boolean>(() => localStorage.getItem(LOCKED_KEY) === "1");
  const [routeStations, setRouteStations] = useState<RouteStation[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [childPhoto, setChildPhoto] = useState("");
  const [childPhotoSaving, setChildPhotoSaving] = useState(false);
  const [childPhotoSaved, setChildPhotoSaved] = useState(false);
  const [childParentName, setChildParentName] = useState("");
  const [childGender, setChildGender] = useState("");
  const [childClassName, setChildClassName] = useState("");
  const [childSection, setChildSection] = useState("");
  const [childRollNumber, setChildRollNumber] = useState("");
  const [childProfileSaving, setChildProfileSaving] = useState(false);
  const [childProfileSaved, setChildProfileSaved] = useState(false);

  useEffect(() => {
    if (!selectedRouteId) { setRouteStations([]); return; }
    setLoadingStations(true);
    fetch(`${BASE}/api/routes/${selectedRouteId}/stations`)
      .then((r) => r.json())
      .then((data: RouteStation[]) => setRouteStations(Array.isArray(data) ? data : []))
      .catch(() => setRouteStations([]))
      .finally(() => setLoadingStations(false));
  }, [selectedRouteId]);

  const childPassenger = myPassengers?.[0] ?? null;

  useEffect(() => {
    if (childPassenger?.photoUrl) setChildPhoto(childPassenger.photoUrl);
    setChildParentName(childPassenger?.parentName ?? "");
    setChildGender(childPassenger?.gender ?? "");
    setChildClassName(childPassenger?.className ?? "");
    setChildSection(childPassenger?.section ?? "");
    setChildRollNumber(childPassenger?.rollNumber ?? "");
  }, [childPassenger?.id, childPassenger?.photoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveChildPhoto() {
    if (!childPassenger?.id || !user) return;
    setChildPhotoSaving(true);
    setChildPhotoSaved(false);
    try {
      await fetch(`${BASE}/api/passengers/${childPassenger.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: childPhoto || null }),
      });
      // Sync photo to auth user for top-right avatar
      const res = await fetch(`${BASE}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, name: user.name, title: user.title ?? null, photoUrl: childPhoto || null }),
      });
      if (res.ok) {
        const data = await res.json() as { photoUrl?: string | null };
        login({ ...user, photoUrl: data.photoUrl ?? childPhoto ?? null });
      }
      setChildPhotoSaved(true);
      setTimeout(() => setChildPhotoSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setChildPhotoSaving(false); }
  }

  async function handleSaveChildProfile() {
    if (!childPassenger?.id) return;
    setChildProfileSaving(true);
    setChildProfileSaved(false);
    try {
      await fetch(`${BASE}/api/passengers/${childPassenger.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: childParentName.trim() || null,
          gender: childGender || null,
          className: childClassName || null,
          section: childSection.trim().toUpperCase() || null,
          rollNumber: childRollNumber.trim() || null,
        }),
      });
      setChildProfileSaved(true);
      setChildProfileOpen(false);
      setTimeout(() => setChildProfileSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setChildProfileSaving(false); }
  }

  function handleSelectRoute(id: number | null) {
    if (locked) return;
    setSelectedRouteId(id);
    setSelectedStopId(null);
    setRouteStations([]);
    if (id) localStorage.setItem(ROUTE_PREF_KEY, String(id));
    else localStorage.removeItem(ROUTE_PREF_KEY);
    localStorage.removeItem(STOP_PREF_KEY);
  }

  function handleSelectStop(rowId: number | null) {
    if (locked) return;
    setSelectedStopId(rowId);
    if (rowId != null) localStorage.setItem(STOP_PREF_KEY, String(rowId));
    else localStorage.removeItem(STOP_PREF_KEY);
  }

  function handleToggleLock() {
    if (!selectedRouteId || !selectedStopId) return;
    const next = !locked;
    setLocked(next);
    localStorage.setItem(LOCKED_KEY, next ? "1" : "0");
  }

  const selectedRoute = (routes ?? []).find((r) => r.id === selectedRouteId) ?? null;
  // Find by route_station row ID
  const selectedStop = routeStations.find((s) => s.id === selectedStopId) ?? null;

  const driverLoc = useDriverLocation();
  const mapLat = selectedStop?.lat ?? 27.7172;
  const mapLng = selectedStop?.lng ?? 85.3240;

  const dirLabel = (dir: string) => dir === "return" ? "↩ Return" : "→ Forward";
  const dirClass = (dir: string) =>
    dir === "return"
      ? "bg-blue-100 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
      : "bg-green-100 dark:bg-green-950/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400";

  return (
    <div className="mx-auto w-full max-w-[480px] bg-card p-4 shadow-md sm:my-8 sm:rounded-xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <Bus size={20} className="text-[#FFF078]" />OrbitTrack
        </h1>
        <span className="rounded-full bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">Parent</span>
      </div>

      {/* Tab bar */}
      <div className="flex rounded-xl border border-border overflow-hidden bg-muted/30">
        <button
          onClick={() => setActiveTab("tracking")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "tracking"
              ? "bg-amber-500 text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapPin size={12} />Live Tracking
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "history"
              ? "bg-amber-500 text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <HistoryIcon size={12} />Trip History
          {tripHistory && tripHistory.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
              activeTab === "history" ? "bg-white/20 text-white" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
            }`}>
              {tripHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* Child Profile Modal */}
      {childProfileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <p className="text-sm font-bold text-foreground">
              {childPassenger ? `${childPassenger.name}'s Profile` : "Child Profile"}
            </p>
            <button onClick={() => setChildProfileOpen(false)} className="rounded-full p-1.5 hover:bg-muted transition-colors">
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {childPassenger ? (
              <>
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">School Photo</p>
                  <PhotoPicker value={childPhoto} onChange={setChildPhoto} name={childPassenger.name} />
                  {childPhoto !== (childPassenger.photoUrl ?? "") && (
                    <button onClick={handleSaveChildPhoto} disabled={childPhotoSaving}
                      className="w-full rounded-xl bg-amber-500 py-2 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors">
                      {childPhotoSaving ? "Saving…" : "Save Photo"}
                    </button>
                  )}
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3 text-xs">
                  <p className="text-sm font-semibold text-foreground">Personal Details</p>
                  <div>
                    <label className="mb-1 block font-semibold text-muted-foreground">Parent / Guardian Name</label>
                    <input value={childParentName} onChange={(e) => setChildParentName(e.target.value)}
                      placeholder="e.g., Ram Prasad Shrestha"
                      className="w-full border border-border rounded-lg p-2.5 bg-background outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-muted-foreground">Gender</label>
                    <div className="flex gap-2">
                      {["Male", "Female", "Other"].map((g) => (
                        <button key={g} type="button" onClick={() => setChildGender(childGender === g ? "" : g)}
                          className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${childGender === g ? "bg-amber-500 border-amber-500 text-slate-900" : "border-border bg-background text-foreground hover:bg-muted"}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block font-semibold text-muted-foreground">Class</label>
                      <select value={childClassName} onChange={(e) => setChildClassName(e.target.value)}
                        className="w-full border border-border rounded-lg p-2.5 bg-background">
                        <option value="">Select class</option>
                        {["Play Group","Nursery","LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12","Others"].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-muted-foreground">Section</label>
                      <input value={childSection} onChange={(e) => setChildSection(e.target.value.toUpperCase())}
                        placeholder="e.g., A"
                        className="w-full border border-border rounded-lg p-2.5 bg-background outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-muted-foreground">Roll Number</label>
                    <input value={childRollNumber} onChange={(e) => setChildRollNumber(e.target.value)}
                      placeholder="e.g., 12"
                      className="w-full border border-border rounded-lg p-2.5 bg-background outline-none" />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No child record linked. Contact admin.</p>
            )}
          </div>
          {childPassenger && (
            <div className="px-4 py-4 border-t border-border bg-card">
              <button onClick={handleSaveChildProfile} disabled={childProfileSaving}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors">
                {childProfileSaving ? "Saving…" : childProfileSaved ? "✓ Saved!" : "Save Details"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── LIVE TRACKING TAB ── */}
      {activeTab === "tracking" && (
        <>
          {/* Child Profile chip — tappable, opens profile modal */}
          <button
            onClick={() => setChildProfileOpen(true)}
            className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 hover:bg-muted/50 transition-colors text-left shadow-sm"
          >
            <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-amber-400 bg-muted shrink-0 flex items-center justify-center">
              {childPhoto || childPassenger?.photoUrl
                ? <img src={childPhoto || childPassenger?.photoUrl!} alt={childPassenger?.name ?? "Child"} className="h-full w-full object-cover" />
                : <User size={18} className="text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">
                {childPassenger?.name ?? "Child"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                {[
                  childPassenger?.gender,
                  childPassenger?.className ? `Class ${childPassenger.className}` : null,
                  childPassenger?.section ? `Sec ${childPassenger.section}` : null,
                  childParentName ? `Guardian: ${childParentName}` : null,
                ].filter(Boolean).join(" · ") || "Tap to fill in child's profile"}
              </p>
            </div>
          </button>

          {/* Upcoming Calendar Events urgent banner */}
          {upcomingEvents.length > 0 && (
            <div className="space-y-2">
              {upcomingEvents.map((ev) => {
                const isToday = ev.eventDate === todayStr;
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

          {/* ── Bus Route & Stop Picker ── */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-primary flex items-center gap-2"><Navigation size={14} />My Bus Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select your route and boarding stop — pick the correct direction for round-trips
                </p>
              </div>
              {locked ? (
                <button onClick={handleToggleLock} className="flex items-center gap-1.5 rounded-xl bg-green-100 dark:bg-green-950/30 border border-green-300 dark:border-green-700 px-3 py-1.5 text-[10px] font-bold text-green-700 dark:text-green-400 hover:opacity-80 transition-opacity">
                  <Lock size={10} />Locked
                </button>
              ) : (
                <button onClick={handleToggleLock} disabled={!selectedRouteId || !selectedStopId}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[10px] font-semibold text-muted-foreground hover:border-amber-500 hover:text-amber-600 disabled:opacity-40 transition-colors">
                  <Unlock size={10} />Lock Selection
                </button>
              )}
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Route dropdown */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Bus Route</label>
                {locked && selectedRoute ? (
                  <div className="flex items-center gap-2 rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 px-3 py-2.5">
                    <CheckCircle size={14} className="text-green-600 dark:text-green-400 shrink-0" />
                    <p className="text-sm font-semibold text-foreground">{selectedRoute.name}</p>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedRouteId ?? ""}
                      onChange={(e) => handleSelectRoute(e.target.value ? Number(e.target.value) : null)}
                      disabled={locked}
                      className="w-full appearance-none rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500 pr-8"
                    >
                      <option value="">Choose your route…</option>
                      {(routes ?? []).filter((r) => r.isActive).map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Stop list — grouped by direction, showing ETA */}
              {selectedRouteId && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    Boarding Stop
                    <span className="ml-1 text-muted-foreground font-normal">— choose direction if same stop appears twice</span>
                  </label>
                  {loadingStations ? (
                    <p className="text-xs text-muted-foreground py-2">Loading stops…</p>
                  ) : routeStations.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 italic">No stops on this route yet</p>
                  ) : locked && selectedStop ? (
                    /* Locked state — show the selected stop with ETA */
                    <div className="rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 px-4 py-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-green-600 dark:text-green-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {selectedStop.stopLabel || selectedStop.stationName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${dirClass(selectedStop.direction)}`}>
                              {dirLabel(selectedStop.direction)}
                            </span>
                            {selectedStop.eta && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                <Clock size={9} />ETA {selectedStop.eta}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Unlocked — scrollable stop list */
                    <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                      {routeStations.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleSelectStop(s.id)}
                          disabled={locked}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selectedStopId === s.id ? "bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-500" : "hover:bg-muted"}`}
                        >
                          <span className="text-[10px] font-bold text-[#FFF078] w-5 shrink-0">{s.position + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground leading-tight">
                              {s.stopLabel || s.stationName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${dirClass(s.direction)}`}>
                                {dirLabel(s.direction)}
                              </span>
                              {s.eta && (
                                <span className="flex items-center gap-1 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                                  <Clock size={8} />ETA {s.eta}
                                </span>
                              )}
                              {s.lat && s.lng && (
                                <span className="text-[9px] text-muted-foreground">
                                  {s.lat.toFixed(3)}, {s.lng.toFixed(3)}
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedStopId === s.id && <CheckCircle size={14} className="text-[#FFF078] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Live Bus Tracking Map */}
          <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <MapPin size={11} />Live Bus Map
                {selectedStop?.stopLabel || selectedStop?.stationName
                  ? ` — ${selectedStop.stopLabel || selectedStop.stationName}`
                  : ""}
              </p>
              <div className="flex items-center gap-1.5">
                {driverLoc.isLive ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400">GPS LIVE</span>
                  </>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Bus offline</span>
                )}
                {selectedStop?.eta && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 ml-2">
                    <Clock size={9} />ETA {selectedStop.eta}
                  </span>
                )}
              </div>
            </div>
            <div style={{ height: 220 }}>
              <OsmMap
                mode="tracking"
                route={routeStations.filter((s) => s.lat && s.lng).map((s) => ({ lat: s.lat!, lng: s.lng!, name: s.stopLabel || s.stationName || `Stop ${s.id}` }))}
                lat={driverLoc.lat}
                lng={driverLoc.lng}
                isLive={driverLoc.isLive}
                label={driverLoc.vehicleNumber ?? undefined}
                height={220}
              />
            </div>
            <div className="px-5 py-2 flex items-center justify-between bg-muted/20">
              <p className="text-[10px] text-muted-foreground font-mono">
                {driverLoc.isLive
                  ? `Bus: ${driverLoc.lat.toFixed(4)}°N, ${driverLoc.lng.toFixed(4)}°E`
                  : "Awaiting driver GPS…"}
              </p>
              <a
                href={`https://www.google.com/maps?q=${driverLoc.lat},${driverLoc.lng}`}
                target="_blank" rel="noreferrer"
                className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                Open in Google Maps →
              </a>
            </div>
          </div>

          {/* Live Distance Card — updates every GPS ping from the driver */}
          {driverLoc.isLive && (() => {
            const schoolStation = routeStations.length > 0 ? routeStations[routeStations.length - 1] : null;
            const distToMyStopKm = selectedStop?.lat && selectedStop?.lng
              ? haversineKm(driverLoc.lat, driverLoc.lng, selectedStop.lat, selectedStop.lng)
              : null;
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
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">🚏 Child's Stop</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400 leading-tight">
                      {distToMyStopKm != null ? `${distToMyStopKm.toFixed(1)} km` : "—"}
                    </p>
                    <p className="text-[9px] text-muted-foreground truncate">
                      {selectedStop?.stopLabel || selectedStop?.stationName || "Not set"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-3 py-2 text-center">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">🏫 School</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400 leading-tight">
                      {distToSchoolKm != null ? `${distToSchoolKm.toFixed(1)} km` : "—"}
                    </p>
                    <p className="text-[9px] text-muted-foreground truncate">
                      {schoolStation?.stopLabel || schoolStation?.stationName || "Last stop"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Announcements */}
          {announcements?.length ? (
            <div className="space-y-2">
              <h2 className="font-semibold text-primary">Notices</h2>
              {announcements.map((a) => (
                <div key={a.id} className="rounded-md border border-red-200 bg-red-50 p-3 text-red-900">
                  <p className="text-sm">{a.message}</p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Tracking Timeline */}
          <div>
            <h2 className="mb-2 font-semibold text-primary">Tracking Timeline</h2>
            {timeline ? (
              <div className="space-y-3">
                {timeline.map((event) => (
                  <div key={event.id} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full shrink-0 ${event.status === "completed" ? "bg-green-500" : "bg-gray-300"}`} />
                    <div>
                      <p className="text-sm font-medium">{event.description}</p>
                      <p className="text-xs text-muted-foreground">{event.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading timeline...</p>
            )}
          </div>

          {/* Driver Rating */}
          <DriverRating routeId={selectedRouteId} />
        </>
      )}

      {/* ── TRIP HISTORY TAB ── */}
      {activeTab === "history" && (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-primary flex items-center gap-2">
              <HistoryIcon size={14} className="text-amber-500" />
              Travel History
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedRoute
                ? `Recent trips on ${selectedRoute.name}`
                : "All recent trips — select a route in Tracking to filter"}
            </p>
          </div>

          {!tripHistory || tripHistory.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <HistoryIcon size={32} className="mx-auto text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No trips recorded yet</p>
              <p className="text-xs text-muted-foreground">
                {selectedRoute
                  ? `Trips on ${selectedRoute.name} will appear here once a driver starts a journey.`
                  : "Select a route in the Tracking tab to see route-specific history."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tripHistory.map((t) => {
                const startD = new Date(t.startedAt);
                const dateLabel = startD.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                const timeLabel = startD.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                const durationLabel = t.completedAt
                  ? (() => {
                      const mins = Math.round((new Date(t.completedAt).getTime() - startD.getTime()) / 60000);
                      return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
                    })()
                  : "In progress";
                const boardingPct = t.passengersTotal > 0
                  ? Math.round((t.passengersBoarded / t.passengersTotal) * 100)
                  : 0;
                return (
                  <div key={t.id} className="px-5 py-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${t.completedAt ? "bg-green-500" : "bg-amber-400 animate-pulse"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{dateLabel}</span>
                          <span className="text-xs text-muted-foreground">{timeLabel}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${t.completedAt ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"}`}>
                            {t.completedAt ? "Completed" : "In Progress"}
                          </span>
                          {/* Per-child boarding status — only shown when passengerId was used */}
                          {t.childBoarded != null && (
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${t.childBoarded ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400"}`}>
                              {t.childBoarded ? "✓ Boarded" : "✗ Absent"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {t.driverName && <span>🚌 {t.driverName}</span>}
                          {t.routeName && <span>📍 {t.routeName}</span>}
                          <span>⏱ {durationLabel}</span>
                        </div>
                      </div>
                    </div>
                    {/* Boarding progress bar */}
                    <div className="ml-5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{t.passengersBoarded} of {t.passengersTotal} students boarded</span>
                        <span className="font-bold text-foreground">{boardingPct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all"
                          style={{ width: `${boardingPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const RATING_KEY = "orbittrack_driver_rating";

function DriverRating({ routeId }: { routeId: number | null }) {
  const [hover, setHover] = useState(0);
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const saved = routeId ? localStorage.getItem(`${RATING_KEY}_${routeId}`) : null;
    setRating(saved ? Number(saved) : 0);
    setSubmitted(!!saved);
  }, [routeId]);

  function handleRate(r: number) {
    if (!rating || !routeId) return;
    localStorage.setItem(`${RATING_KEY}_${routeId}`, String(r));
    setRating(r);
    setSubmitted(true);
  }

  if (!routeId) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-primary flex items-center gap-2"><Star size={14} className="text-[#FFF078]" />Rate Your Driver</h2>
        <p className="text-xs text-muted-foreground mt-0.5">How was today's journey?</p>
      </div>
      {submitted ? (
        <div className="flex items-center gap-2">
          {[1,2,3,4,5].map((s) => (
            <Star key={s} size={24} className={s <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"} />
          ))}
          <p className="text-xs text-muted-foreground ml-2">Thanks for your feedback!</p>
          <button onClick={() => { setSubmitted(false); setRating(0); localStorage.removeItem(`${RATING_KEY}_${routeId}`); }}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline">
            Change
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {[1,2,3,4,5].map((s) => (
            <button key={s} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => handleRate(s)}>
              <Star size={28} className={s <= (hover || rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
