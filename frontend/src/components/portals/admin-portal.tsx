import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { PhotoPicker } from "@/components/photo-picker";
import {
  useListStations,
  useListAnnouncements,
  useListPassengers,
  useListDrivers,
  useListRoutes,
  useListRouteStations,
  useListVehicles,
  getListPassengersQueryKey,
  getListDriversQueryKey,
  getListRoutesQueryKey,
  getListRouteStationsQueryKey,
  getListStationsQueryKey,
  getListVehiclesQueryKey,
  getListAnnouncementsQueryKey,
  useListCalendarEvents,
  getListCalendarEventsQueryKey,
  getTenantId,
  useListTripHistory,
} from "@workspace/api-client-react";
import {
  CheckCircle,
  MapPin,
  Home,
  Bus,
  Upload,
  Camera,
  Pencil,
  AlertTriangle,
  Wrench,
  Send,
  MessageSquare,
  Megaphone,
  Phone,
  Facebook,
  Instagram,
  Youtube,
  Mail,
  Globe,
  Building2,
  Route,
  Plus,
  Trash2,
  Search,
  Navigation,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Star,
  Clock,
  Lock,
  User,
  Bell,
  Droplets,
  FileText,
  BarChart3,
  Gauge,
  AlertCircle,
  Settings2,
  MessageCircle,
  Download,
  History as HistoryIcon,
} from "lucide-react";
import StationMapPicker from "@/components/station-map-picker";
import OsmMap, { RouteStop, FleetBus } from "@/components/osm-map";
import { useLiveLocations } from "@/hooks/use-live-locations";
import {
  adToBs,
  bsToAd,
  getDaysInBsMonth,
  getFirstWeekdayOfBsMonth,
  todayBs,
  bsDateToAd,
  BS_MONTH_NAMES_NE,
  AD_MONTH_NAMES,
} from "@/lib/bs-calendar";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useDriverMessages } from "@/lib/driver-messages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const WEEKDAYS_NE = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];

function tenantHeaders(): Record<string, string> {
  const id = getTenantId();
  return id !== null
    ? { "Content-Type": "application/json", "x-tenant-id": String(id) }
    : { "Content-Type": "application/json" };
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: tenantHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errMsg = "Failed";
    try {
      const data = await res.json();
      errMsg = data.error ?? errMsg;
    } catch {
      errMsg = `HTTP Error ${res.status}: ${res.statusText || "Internal Server Error"}`;
    }
    throw new Error(errMsg);
  }
  return await res.json();
}

async function apiPatch(path: string, body: unknown) {
  const res = await fetch(`/api${path}`, {
    method: "PATCH",
    headers: tenantHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errMsg = "Failed";
    try {
      const data = await res.json();
      errMsg = data.error ?? errMsg;
    } catch {
      errMsg = `HTTP Error ${res.status}: ${res.statusText || "Internal Server Error"}`;
    }
    throw new Error(errMsg);
  }
  return await res.json();
}

async function apiPut(path: string, body: unknown) {
  const res = await fetch(`/api${path}`, {
    method: "PUT",
    headers: tenantHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errMsg = "Failed";
    try {
      const data = await res.json();
      errMsg = data.error ?? errMsg;
    } catch {
      errMsg = `HTTP Error ${res.status}: ${res.statusText || "Internal Server Error"}`;
    }
    throw new Error(errMsg);
  }
  return await res.json();
}

async function apiDelete(path: string) {
  const id = getTenantId();
  const headers: Record<string, string> =
    id !== null ? { "x-tenant-id": String(id) } : {};
  const res = await fetch(`/api${path}`, { method: "DELETE", headers });
  if (!res.ok) {
    let errMsg = "Failed to delete";
    try {
      const data = await res.json();
      errMsg = data.error ?? errMsg;
    } catch {
      errMsg = `HTTP Error ${res.status}: ${res.statusText || "Internal Server Error"}`;
    }
    throw new Error(errMsg);
  }
}

// ── Shared Models ──
type FuelLogRow = {
  id: number;
  vehicleId: number | null;
  vehiclePlate: string | null;
  date: string;
  liters: number;
  amountNpr: number;
  odometerKm: number;
  notes: string | null;
};
type MaintenanceRow = {
  id: number;
  vehicleId: number | null;
  vehiclePlate: string | null;
  partType: string;
  description: string | null;
  costNpr: number;
  odometerKm: number;
  serviceDate: string;
  vendor: string | null;
};
type VehicleDocRow = {
  id: number;
  vehicleId: number;
  vehiclePlate: string | null;
  vehicleModel: string | null;
  bluebookExpiry: string | null;
  insuranceExpiry: string | null;
  pollutionExpiry: string | null;
  bluebookPhotoUrl: string | null;
  engineNumber: string | null;
  chassisNumber: string | null;
  daysUntilBluebook: number | null;
  daysUntilInsurance: number | null;
  daysUntilPollution: number | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
type DriverRow = {
  id: number;
  name: string;
  phone: string;
  vehicleNumber: string;
  isActive: boolean;
  isOnline: boolean;
  photoUrl?: string | null;
};
type LiveFleetVehicle = {
  id: number;
  plate: string;
  driver: string;
  lat: number | null;
  lng: number | null;
  status: "on-route" | "depot";
  isLive: boolean;
};
type Passenger = {
  id: number;
  name: string;
  phone?: string | null;
  role: string;
  status: string;
  liveToday: number;
  stationId: number;
  stationName?: string | null;
  quickMessage?: string | null;
  photoUrl?: string | null;
};
type CalendarEvent = {
  id: number;
  title: string;
  description?: string | null;
  type: string;
  eventDate: string;
  notified: boolean;
  autoNotify: boolean;
};

// ── 🛠️ १. VEHICLE SERVICE & MANAGEMENT PANEL COMPONENT (ब्याकटिक्स एरर फिक्स गरिएको) ──
function VehicleServiceTabs({ vehicles }: { vehicles: any[] | undefined }) {
  const [subTab, setSubTab] = useState<"fuel" | "service" | "docs">("fuel");
  const [fuelRows, setFuelRows] = useState<FuelLogRow[]>([]);
  const [fuelForm, setFuelForm] = useState({
    vehicleId: "",
    date: new Date().toISOString().slice(0, 10),
    liters: "",
    amountNpr: "",
    odometerKm: "",
    notes: "",
  });
  const [maintRows, setMaintRows] = useState<MaintenanceRow[]>([]);
  const [maintForm, setMaintForm] = useState({
    vehicleId: "",
    partType: "",
    description: "",
    costNpr: "",
    odometerKm: "",
    serviceDate: new Date().toISOString().slice(0, 10),
    vendor: "",
  });
  const [docRows, setDocRows] = useState<VehicleDocRow[]>([]);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [docForm, setDocForm] = useState({
    bluebookExpiry: "",
    insuranceExpiry: "",
    pollutionExpiry: "",
    bluebookPhotoUrl: "",
    engineNumber: "",
    chassisNumber: "",
  });
  const [uploadingDocPhoto, setUploadingDocPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);

  async function loadAllData() {
    setLoading(true);
    try {
      const [f, m, d] = await Promise.all([
        fetch(`/api/fuel-logs`, {
          headers: tenantHeaders(),
        }).then((res) => res.json()),
        fetch(`/api/maintenance-records`, {
          headers: tenantHeaders(),
        }).then((res) => res.json()),
        fetch(`/api/vehicle-documents`, {
          headers: tenantHeaders(),
        }).then((res) => res.json()),
      ]);
      setFuelRows(f || []);
      setMaintRows(m || []);
      setDocRows(d || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAllData();
  }, []);

  async function handleAddFuel() {
    if (
      !fuelForm.date ||
      !fuelForm.liters ||
      !fuelForm.amountNpr ||
      !fuelForm.odometerKm
    )
      return;
    try {
      await apiPost("/fuel-logs", {
        vehicleId: fuelForm.vehicleId ? Number(fuelForm.vehicleId) : null,
        date: fuelForm.date,
        liters: Number(fuelForm.liters),
        amountNpr: Number(fuelForm.amountNpr),
        odometerKm: Number(fuelForm.odometerKm),
        notes: fuelForm.notes || null,
      });
      setFuelForm({
        vehicleId: "",
        date: new Date().toISOString().slice(0, 10),
        liters: "",
        amountNpr: "",
        odometerKm: "",
        notes: "",
      });
      void loadAllData();
    } catch {
      alert("Failed");
    }
  }

  async function handleAddMaint() {
    if (!maintForm.partType || !maintForm.serviceDate || !maintForm.odometerKm)
      return;
    try {
      await apiPost("/maintenance-records", {
        vehicleId: maintForm.vehicleId ? Number(maintForm.vehicleId) : null,
        partType: maintForm.partType,
        description: maintForm.description || null,
        costNpr: Number(maintForm.costNpr) || 0,
        odometerKm: Number(maintForm.odometerKm),
        serviceDate: maintForm.serviceDate,
        vendor: maintForm.vendor || null,
      });
      setMaintForm({
        vehicleId: "",
        partType: "",
        description: "",
        costNpr: "",
        odometerKm: "",
        serviceDate: new Date().toISOString().slice(0, 10),
        vendor: "",
      });
      void loadAllData();
    } catch {
      alert("Failed");
    }
  }

  async function handleSaveDoc(vehicleId: number) {
    try {
      await apiPut(`/vehicle-documents/${vehicleId}`, {
        bluebookExpiry: docForm.bluebookExpiry || null,
        insuranceExpiry: docForm.insuranceExpiry || null,
        pollutionExpiry: docForm.pollutionExpiry || null,
        bluebookPhotoUrl: docForm.bluebookPhotoUrl || null,
        engineNumber: docForm.engineNumber || null,
        chassisNumber: docForm.chassisNumber || null,
      });
      setEditingDocId(null);
      void loadAllData();
    } catch {
      alert("Failed");
    }
  }

  async function handleDocPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDocPhoto(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setDocForm((f) => ({ ...f, bluebookPhotoUrl: dataUrl }));
    } finally {
      setUploadingDocPhoto(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <span className="text-sm font-bold text-primary">Vehicle Service</span>
        <button
          onClick={() => setAddVehicleOpen(true)}
          className="flex items-center gap-1 bg-amber-500 text-slate-900 text-[11px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-amber-400"
        >
          <Plus size={12} /> Add New
        </button>
      </div>
      <AddVehicleDialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen} />
      <div className="flex border-b border-border bg-muted/20 p-1 gap-1 text-xs font-semibold mt-3">
        <button
          onClick={() => setSubTab("fuel")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${subTab === "fuel" ? "bg-amber-500 text-slate-900 font-bold" : "text-muted-foreground"}`}
        >
          <Droplets size={13} /> Fuel Logs
        </button>
        <button
          onClick={() => setSubTab("service")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${subTab === "service" ? "bg-amber-500 text-slate-900 font-bold" : "text-muted-foreground"}`}
        >
          <Wrench size={13} /> Service Records
        </button>
        <button
          onClick={() => setSubTab("docs")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${subTab === "docs" ? "bg-amber-500 text-slate-900 font-bold" : "text-muted-foreground"}`}
        >
          <FileText size={13} /> Documents
        </button>
      </div>
      <div className="p-4">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Loading...
          </p>
        )}
        {!loading && subTab === "fuel" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={fuelForm.vehicleId}
                onChange={(e) =>
                  setFuelForm((f) => ({ ...f, vehicleId: e.target.value }))
                }
                className="border rounded-lg p-2 bg-background"
              >
                <option value="">Select Bus</option>
                {(vehicles ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={fuelForm.date}
                onChange={(e) =>
                  setFuelForm((f) => ({ ...f, date: e.target.value }))
                }
                className="border rounded-lg p-2 bg-background text-foreground"
              />
              <input
                type="number"
                placeholder="Liters"
                value={fuelForm.liters}
                onChange={(e) =>
                  setFuelForm((f) => ({ ...f, liters: e.target.value }))
                }
                className="border rounded-lg p-2 bg-background"
              />
              <input
                type="number"
                placeholder="Amount (NPR)"
                value={fuelForm.amountNpr}
                onChange={(e) =>
                  setFuelForm((f) => ({ ...f, amountNpr: e.target.value }))
                }
                className="border rounded-lg p-2 bg-background"
              />
              <input
                type="number"
                placeholder="Odometer"
                value={fuelForm.odometerKm}
                onChange={(e) =>
                  setFuelForm((f) => ({ ...f, odometerKm: e.target.value }))
                }
                className="border rounded-lg p-2 bg-background"
              />
            </div>
            <button
              onClick={handleAddFuel}
              className="w-full bg-amber-500 text-slate-900 font-bold py-2 rounded-xl text-xs"
            >
              ✓ Save Fuel Entry
            </button>
            <div className="max-h-40 overflow-y-auto border rounded-xl divide-y text-xs mt-2 bg-muted/10">
              {fuelRows.map((r) => (
                <div
                  key={r.id}
                  className="p-2 flex justify-between items-center bg-card"
                >
                  <div>
                    <p className="font-semibold">
                      {r.vehiclePlate || "General"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.date} · {r.liters}L · Rs {r.amountNpr}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm("Delete?")) {
                        await apiDelete(`/fuel-logs/${r.id}`);
                        void loadAllData();
                      }
                    }}
                    className="text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {!loading && subTab === "service" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={maintForm.vehicleId}
                onChange={(e) =>
                  setMaintForm((f) => ({ ...f, vehicleId: e.target.value }))
                }
                className="border rounded-lg p-2 bg-background"
              >
                <option value="">Select Bus</option>
                {(vehicles ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber}
                  </option>
                ))}
              </select>
              <input
                placeholder="Part"
                value={maintForm.partType}
                onChange={(e) =>
                  setMaintForm((f) => ({ ...f, partType: e.target.value }))
                }
                className="border rounded-lg p-2 bg-background"
              />
              <input
                type="number"
                placeholder="Cost NPR"
                value={maintForm.costNpr}
                onChange={(e) =>
                  setMaintForm((f) => ({ ...f, costNpr: e.target.value }))
                }
                className="border rounded-lg p-2 bg-background"
              />
              <input
                type="number"
                placeholder="Odometer"
                value={maintForm.odometerKm}
                onChange={(e) =>
                  setMaintForm((f) => ({ ...f, odometerKm: e.target.value }))
                }
                className="border rounded-lg p-2 bg-background"
              />
            </div>
            <button
              onClick={handleAddMaint}
              className="w-full bg-amber-500 text-slate-900 font-bold py-2 rounded-xl text-xs"
            >
              ✓ Save Service Record
            </button>
            <div className="max-h-40 overflow-y-auto border rounded-xl divide-y text-xs mt-2 bg-muted/10">
              {maintRows.map((r) => (
                <div
                  key={r.id}
                  className="p-2 flex justify-between items-center bg-card"
                >
                  <div>
                    <p className="font-semibold">
                      {r.vehiclePlate} — {r.partType}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.serviceDate} · Rs {r.costNpr}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm("Delete?")) {
                        await apiDelete(`/maintenance-records/${r.id}`);
                        void loadAllData();
                      }
                    }}
                    className="text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {!loading && subTab === "docs" && (
          <div className="space-y-3 text-xs">
            <div className="divide-y border rounded-xl max-h-56 overflow-y-auto bg-card">
              {(vehicles ?? []).map((v) => {
                const doc = docRows.find((d) => d.vehicleId === v.id);
                const isEditing = editingDocId === v.id;
                const daysLeft = doc?.daysUntilBluebook ?? null;
                const isDueSoon = daysLeft !== null && daysLeft <= 30;
                const isExpired = daysLeft !== null && daysLeft < 0;
                return (
                  <div key={v.id} className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-foreground">
                        {v.plateNumber}
                      </p>
                      <button
                        onClick={() => {
                          if (isEditing) setEditingDocId(null);
                          else {
                            setEditingDocId(v.id);
                            setDocForm({
                              bluebookExpiry: doc?.bluebookExpiry || "",
                              insuranceExpiry: doc?.insuranceExpiry || "",
                              pollutionExpiry: doc?.pollutionExpiry || "",
                              bluebookPhotoUrl: doc?.bluebookPhotoUrl || "",
                              engineNumber: doc?.engineNumber || "",
                              chassisNumber: doc?.chassisNumber || "",
                            });
                          }
                        }}
                        className="text-amber-600 font-bold flex items-center gap-1"
                      >
                        <Pencil size={11} /> {isEditing ? "Cancel" : "Update"}
                      </button>
                    </div>
                    {isEditing ? (
                      <div className="space-y-2 bg-muted/40 p-2 rounded-xl">
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground">
                            Bluebook Renewal Date
                          </label>
                          <input
                            type="date"
                            value={docForm.bluebookExpiry}
                            onChange={(e) =>
                              setDocForm((f) => ({
                                ...f,
                                bluebookExpiry: e.target.value,
                              }))
                            }
                            className="border p-1 rounded w-full text-xs bg-background"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            placeholder="Engine No."
                            value={docForm.engineNumber}
                            onChange={(e) =>
                              setDocForm((f) => ({
                                ...f,
                                engineNumber: e.target.value,
                              }))
                            }
                            className="border p-1 rounded w-full text-xs bg-background"
                          />
                          <input
                            placeholder="Chassis No."
                            value={docForm.chassisNumber}
                            onChange={(e) =>
                              setDocForm((f) => ({
                                ...f,
                                chassisNumber: e.target.value,
                              }))
                            }
                            className="border p-1 rounded w-full text-xs bg-background"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground">
                            Bluebook Photo
                          </label>
                          <div className="flex items-center gap-2">
                            {docForm.bluebookPhotoUrl && (
                              <img
                                src={docForm.bluebookPhotoUrl}
                                alt="Bluebook"
                                className="h-10 w-10 object-cover rounded-lg border"
                              />
                            )}
                            <label className="flex-1 flex items-center justify-center gap-1.5 border rounded-lg py-1.5 text-[11px] font-semibold text-muted-foreground cursor-pointer bg-background">
                              <Upload size={12} />
                              {uploadingDocPhoto
                                ? "Uploading..."
                                : docForm.bluebookPhotoUrl
                                  ? "Replace Photo"
                                  : "Upload Photo"}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleDocPhotoChange}
                              />
                            </label>
                          </div>
                        </div>
                        <button
                          onClick={() => void handleSaveDoc(v.id)}
                          className="w-full bg-green-600 text-white font-bold py-1 rounded text-xs"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          Bluebook Renewal:{" "}
                          <span className="font-mono font-bold text-foreground">
                            {doc?.bluebookExpiry || "Not Set"}
                          </span>
                          {(isExpired || isDueSoon) && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isExpired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                            >
                              <AlertTriangle size={10} />
                              {isExpired
                                ? "Expired"
                                : `${daysLeft}d left`}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Engine No:{" "}
                          <span className="font-mono font-bold text-foreground">
                            {doc?.engineNumber || "Not Set"}
                          </span>
                          {"  ·  "}Chassis No:{" "}
                          <span className="font-mono font-bold text-foreground">
                            {doc?.chassisNumber || "Not Set"}
                          </span>
                        </p>
                        {doc?.bluebookPhotoUrl && (
                          <img
                            src={doc.bluebookPhotoUrl}
                            alt="Bluebook"
                            className="h-14 w-14 object-cover rounded-lg border"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 📅 CalendarManager ──
function CalendarManager() {
  const queryClient = useQueryClient();
  const todayB = todayBs();
  const todayAd = new Date();
  const [calSystem, setCalSystem] = useState<"bs" | "ad">("bs");
  const [bsYear, setBsYear] = useState(todayB.year);
  const [bsMonth, setBsMonth] = useState(todayB.month);
  const [adYear, setAdYear] = useState(todayAd.getFullYear());
  const [adMonth, setAdMonth] = useState(todayAd.getMonth() + 1);

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const [eventType, setEventType] = useState("holiday");
  const [savingNote, setSavingNote] = useState(false);

  const adMonthStart = bsToAd(bsYear, bsMonth, 1);
  const adMonthEnd = bsToAd(bsYear, bsMonth, getDaysInBsMonth(bsYear, bsMonth));

  const queryMonth1 = `${adMonthStart.year}-${String(adMonthStart.month).padStart(2, "0")}`;
  const queryMonth2 =
    calSystem === "bs" && adMonthEnd.month !== adMonthStart.month
      ? `${adMonthEnd.year}-${String(adMonthEnd.month).padStart(2, "0")}`
      : null;

  const { data: eventsA, refetch: refetchA } = useListCalendarEvents({
    month: queryMonth1,
  });
  const { data: eventsB, refetch: refetchB } = useListCalendarEvents({
    month: queryMonth2 ?? queryMonth1,
  });

  const events = useMemo(() => {
    const all = [...(eventsA ?? []), ...(queryMonth2 ? (eventsB ?? []) : [])];
    const seen = new Set<number>();
    return all.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [eventsA, eventsB, queryMonth2]);

  function refetch() {
    void refetchA();
    if (queryMonth2) void refetchB();
  }

  function prevMonth() {
    if (bsMonth === 1) {
      setBsYear((y) => y - 1);
      setBsMonth(12);
    } else setBsMonth((m) => m - 1);
  }
  function nextMonth() {
    if (bsMonth === 12) {
      setBsYear((y) => y + 1);
      setBsMonth(1);
    } else setBsMonth((m) => m + 1);
  }

  const daysInMonth = getDaysInBsMonth(bsYear, bsMonth);
  const firstWeekday = getFirstWeekdayOfBsMonth(bsYear, bsMonth);

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const ev of events ?? []) {
    const parts = ev.eventDate.split("-").map(Number);
    const bs = adToBs(parts[0], parts[1], parts[2]);
    if (bs.year === bsYear && bs.month === bsMonth) {
      const list = eventsByDay.get(bs.day) ?? [];
      list.push(ev as CalendarEvent);
      eventsByDay.set(bs.day, list);
    }
  }

  async function handleSaveNote() {
    if (!selectedDay || !noteTitle.trim()) return;
    setSavingNote(true);
    try {
      const adDateStr = bsDateToAd(bsYear, bsMonth, selectedDay);
      await apiPost("/calendar-events", {
        title: noteTitle.trim(),
        description: noteDescription.trim() || null,
        type: eventType,
        eventDate: adDateStr,
        autoNotify: true,
      });
      setNoteTitle("");
      setNoteDescription("");
      setSelectedDay(null);
      refetch();
      queryClient.invalidateQueries({
        queryKey: getListCalendarEventsQueryKey(),
      });
    } catch {
      alert("Failed");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSetWeeklyHolidays() {
    if (!confirm("Set all Saturdays as Holidays?")) return;
    try {
      for (let day = 1; day <= daysInMonth; day++) {
        let weekday = (firstWeekday + day - 1) % 7;
        if (weekday === 6) {
          const adDateStr = bsDateToAd(bsYear, bsMonth, day);
          await apiPost("/calendar-events", {
            title: "साप्ताहिक बिदा (Saturday Holiday)",
            type: "holiday",
            eventDate: adDateStr,
            autoNotify: false,
          });
        }
      }
      refetch();
      queryClient.invalidateQueries({
        queryKey: getListCalendarEventsQueryKey(),
      });
    } catch {
      alert("Failed");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
        <button
          onClick={prevMonth}
          className="rounded-lg p-1.5 hover:bg-muted transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="font-bold text-sm text-foreground">
            {BS_MONTH_NAMES_NE[bsMonth - 1]} {bsYear}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSetWeeklyHolidays}
            className="text-[10px] bg-red-500 text-white font-bold px-2 py-1 rounded-lg"
          >
            Sat Holidays
          </button>
          <button
            onClick={nextMonth}
            className="rounded-lg p-1.5 hover:bg-muted transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS_NE.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-semibold text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === todayB.day && bsMonth === todayB.month;
              const dayEvents = eventsByDay.get(day) ?? [];
              const isHoliday = dayEvents.some((e) => e.type === "holiday");
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`relative flex flex-col items-center rounded-xl py-1.5 text-xs ${isToday ? "bg-amber-400 text-white font-bold" : isHoliday ? "bg-red-100 text-red-700" : "hover:bg-muted"}`}
                >
                  <span>{day}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-2 bg-muted/20 rounded-xl space-y-2 text-xs">
          <h3 className="font-bold text-primary">Notes Management</h3>
          {selectedDay ? (
            <div className="space-y-2">
              <input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Title"
                className="w-full border p-1 rounded bg-background"
              />
              <textarea
                value={noteDescription}
                onChange={(e) => setNoteDescription(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full border p-1 rounded bg-background resize-none"
              />
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full border p-1 rounded bg-background"
              >
                <option value="holiday">Holiday</option>
                <option value="event">Event</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNote}
                  className="flex-1 bg-amber-500 py-1 rounded font-bold text-slate-900"
                >
                  Save note
                </button>
                <button
                  onClick={() => {
                    setSelectedDay(null);
                    setNoteTitle("");
                    setNoteDescription("");
                  }}
                  className="flex-1 border border-border py-1 rounded font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground italic text-center pt-4">
              Click date to add notes
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 🚀 २. आन्तरिक एप ब्रोडकास्टर प्यानल (WhatsApp को सट्टा connected internally + custom classes) ──
function InternalAppNotificationsPanel() {
  const [activeSubTab, setActiveSubTab] = useState<
    "students" | "staff" | "drivers"
  >("students");
  const [classes, setClasses] = useState<string[]>([
    "Class 1",
    "Class 2",
    "Class 3",
    "Class 4",
    "Class 5",
    "Class 6",
    "Class 7",
    "Class 8",
    "Class 9",
    "Class 10",
    "Class 11",
    "Class 12",
  ]);
  const [selectedClass, setSelectedClass] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [showAddClassInput, setShowAddClassInput] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    setHistory([
      {
        id: 1,
        type: "Delay Alert",
        target: "Class 10 Students & Parents",
        status: "delivered",
        time: "Jun 27, 09:59 PM",
      },
      {
        id: 2,
        type: "Notice",
        target: "All School Staff Group",
        status: "delivered",
        time: "Jun 27, 09:56 PM",
      },
      {
        id: 3,
        type: "Emergency",
        target: "All Drivers Route B",
        status: "delivered",
        time: "Jun 27, 08:55 PM",
      },
    ]);
  }, []);

  function handleAddCustomClass() {
    if (!newClassName.trim()) return;
    const trimmedClass = newClassName.trim();
    if (classes.includes(trimmedClass)) {
      alert("यो क्लास वा ग्रुप पहिले नै उपलब्ध छ!");
      return;
    }
    setClasses((prev) => [...prev, trimmedClass]);
    setSelectedClass(trimmedClass);
    setNewClassName("");
    setShowAddClassInput(false);
  }

  async function handleAppBroadcast() {
    if (!customMessage.trim()) return;
    setSending(true);
    try {
      await apiPost("/announcements", {
        message: customMessage.trim(),
        severity: "info",
        targetGroup: activeSubTab,
        targetClass:
          activeSubTab === "students" ? selectedClass || "All" : null,
      });
      setHistory((prev) => [
        {
          id: Date.now(),
          type:
            activeSubTab === "students" ? "Class Notice" : "Staff/Driver Alert",
          target:
            activeSubTab === "students"
              ? `${selectedClass || "All Classes"} parents`
              : `All ${activeSubTab}`,
          status: "delivered",
          time: "Just now",
        },
        ...prev,
      ]);
      setCustomMessage("");
      alert(
        "✓ Internal Notification sent successfully to parent & student apps!",
      );
    } catch {
      alert("Failed to send internal app notification.");
    } finally {
      setSending(false);
    }
  }

  const latestMessage = history[0];
  const olderMessages = history.slice(1);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border font-bold text-sm text-primary flex items-center gap-2">
        <Bell size={15} className="text-amber-500 animate-bounce" />{" "}
        <span>OrbitTrack Internal App Broadcaster</span>
      </div>
      <div className="flex bg-muted/40 p-1 text-xs font-semibold gap-1">
        <button
          onClick={() => setActiveSubTab("students")}
          className={`flex-1 py-1.5 rounded-lg transition-colors ${activeSubTab === "students" ? "bg-amber-500 text-slate-900 font-bold shadow" : "text-muted-foreground"}`}
        >
          Students/Parents
        </button>
        <button
          onClick={() => setActiveSubTab("staff")}
          className={`flex-1 py-1.5 rounded-lg transition-colors ${activeSubTab === "staff" ? "bg-amber-500 text-slate-900 font-bold shadow" : "text-muted-foreground"}`}
        >
          Staff
        </button>
        <button
          onClick={() => setActiveSubTab("drivers")}
          className={`flex-1 py-1.5 rounded-lg transition-colors ${activeSubTab === "drivers" ? "bg-amber-500 text-slate-900 font-bold shadow" : "text-muted-foreground"}`}
        >
          Drivers
        </button>
      </div>
      <div className="p-4 space-y-3">
        {activeSubTab === "students" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-muted-foreground">
                Target Class / Grade
              </label>
              <button
                type="button"
                onClick={() => setShowAddClassInput(!showAddClassInput)}
                className="text-[10px] text-amber-500 font-bold hover:underline"
              >
                {showAddClassInput
                  ? "✕ Close Input"
                  : "+ Create Custom Class/Group"}
              </button>
            </div>
            {showAddClassInput && (
              <div className="flex gap-2 p-2 rounded-xl bg-muted/30 border border-border/60">
                <input
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g., Staff Bus, PlayGroup"
                  className="flex-1 border rounded-lg p-1.5 text-xs bg-background outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomClass}
                  className="bg-amber-500 text-slate-900 text-xs px-3 font-bold rounded-lg"
                >
                  Add
                </button>
              </div>
            )}
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full border rounded-xl p-2 text-xs bg-background"
            >
              <option value="">All Registered Classes (Whole School)</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            Notification Message
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder={`Write broadcast notification details to all ${activeSubTab}...`}
            rows={3}
            className="w-full border rounded-xl p-2.5 text-xs bg-muted/20 outline-none resize-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={handleAppBroadcast}
          disabled={sending || !customMessage.trim()}
          className="w-full bg-amber-500 text-slate-900 font-bold text-xs py-2.5 rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-40"
        >
          {sending ? "Transmitting..." : `🚀 Send Internal Notification Alert`}
        </button>
        <div className="pt-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
            Recent Broadcast Feed
          </p>
          {latestMessage && (
            <div className="flex items-center justify-between p-3 border rounded-xl bg-amber-500/10 border-amber-500/30 text-xs mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-slate-900 uppercase">
                  {latestMessage.type}
                </span>
                <p className="truncate text-foreground font-semibold">
                  {latestMessage.target}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {latestMessage.time}
              </span>
            </div>
          )}
          {olderMessages.length > 0 && (
            <div className="space-y-1.5">
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-muted/40 border border-border rounded-xl text-[11px] font-medium text-muted-foreground"
              >
                <span>
                  {isHistoryOpen
                    ? "🔼 Hide Older Logs"
                    : `🔽 View Older Logs history (${olderMessages.length})`}
                </span>
              </button>
              {isHistoryOpen && (
                <div className="border border-border rounded-xl divide-y max-h-36 overflow-y-auto bg-muted/10">
                  {olderMessages.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-2 text-xs"
                    >
                      <span>{h.target}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {h.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Live Fleet Map Panel with Strict Holiday Freeze Lock ──
const SPEED_ALERT_THRESHOLD_KMH = 60;
const ADMIN_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function LiveFleetMapPanel() {
  const liveLocations = useLiveLocations();
  const todayB = todayBs();
  const queryMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const { data: monthEvents } = useListCalendarEvents({ month: queryMonth });
  const [speedAlert, setSpeedAlert] = useState<{ vehicleNumber: string | null; driverName: string | null; speedKmh: number } | null>(null);

  useEffect(() => {
    const es = new EventSource(`${ADMIN_BASE}/api/events`);
    es.addEventListener("speed_alert", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as {
          vehicleNumber?: string | null; driverName?: string | null; speedKmh?: number;
        };
        if (typeof d.speedKmh === "number") {
          setSpeedAlert({ vehicleNumber: d.vehicleNumber ?? null, driverName: d.driverName ?? null, speedKmh: d.speedKmh });
        }
      } catch { /* malformed event */ }
    });
    return () => es.close();
  }, []);

  const isTodayHoliday = useMemo(() => {
    if (!monthEvents) return false;
    return monthEvents.some((ev: any) => {
      const parts = ev.eventDate.split("-").map(Number);
      const bs = adToBs(parts[0], parts[1], parts[2]);
      return (
        bs.year === todayB.year &&
        bs.month === todayB.month &&
        bs.day === todayB.day &&
        ev.type === "holiday"
      );
    });
  }, [monthEvents, todayB]);

  const buses: FleetBus[] = useMemo(() => {
    if (isTodayHoliday) return [];
    return liveLocations
      .filter((loc) => loc.isLive && loc.lat !== null && loc.lng !== null)
      .map((loc) => ({
        id: loc.id,
        label: loc.vehicleNumber,
        driverName: loc.name,
        lat: loc.lat!,
        lng: loc.lng!,
        status: "on-route",
        speed: loc.speedKmh != null ? Math.round(loc.speedKmh) : undefined,
      }));
  }, [liveLocations, isTodayHoliday]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border font-bold text-sm text-primary flex items-center gap-2">
        <MapPin size={15} className="text-amber-500" /> Live Fleet Map Tracker
      </div>
      {speedAlert && (
        <div className="mx-4 mt-3 rounded-xl bg-red-600 text-white px-4 py-2.5 flex items-center gap-2.5 animate-pulse">
          <AlertCircle size={18} className="shrink-0" />
          <p className="text-xs font-bold">
            Overspeed Alert — {speedAlert.vehicleNumber ? `Bus ${speedAlert.vehicleNumber}` : "A bus"}
            {speedAlert.driverName ? ` (${speedAlert.driverName})` : ""} is driving at {Math.round(speedAlert.speedKmh)} km/h (limit {SPEED_ALERT_THRESHOLD_KMH} km/h).
          </p>
          <button onClick={() => setSpeedAlert(null)} className="ml-auto text-white/80 hover:text-white text-xs shrink-0">✕</button>
        </div>
      )}
      {isTodayHoliday ? (
        <div className="p-6 bg-red-500/5 text-center space-y-1.5">
          <AlertCircle size={24} className="text-red-500 mx-auto" />
          <p className="text-xs font-bold text-red-600">
            🏫 आज विद्यालय सार्वजनिक/साप्ताहिक बिदा रहेको छ।
          </p>
          <p className="text-[10px] text-muted-foreground">
            सुरक्षा कारण बिदाको दिनमा बसको लाइभ ट्र्याकिङ र जीपीएस मेसेजहरू
            रोक्का (Freeze) गरिएको छ।
          </p>
        </div>
      ) : buses.length === 0 ? (
        <p className="text-xs text-muted-foreground p-6 text-center italic">
          No active buses online right now.
        </p>
      ) : (
        <OsmMap mode="fleet" buses={buses} height={260} />
      )}
    </div>
  );
}

function SmartStationManager({
  stations,
  onChanged,
}: {
  stations: any[] | undefined;
  onChanged: () => void;
}) {
  const [pendingName, setPendingName] = useState("");
  async function handleSave() {
    if (!pendingName.trim()) return;
    try {
      await apiPost("/stations", {
        name: pendingName.trim(),
        lat: 27.7172,
        lng: 85.324,
        radius: 100,
      });
      onChanged();
      setPendingName("");
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="font-bold text-sm text-primary mb-3">Geofence Stations</h2>
      <div className="flex gap-2">
        <input
          value={pendingName}
          onChange={(e) => setPendingName(e.target.value)}
          placeholder="New Station Name"
          className="flex-1 border p-2 text-xs rounded-xl"
        />
        <button
          onClick={handleSave}
          className="bg-amber-500 text-xs px-4 py-2 font-bold rounded-xl text-slate-900"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function VehicleTagGrid({
  vehicles,
  routes,
  onTagUpdated,
}: {
  vehicles: any[] | undefined;
  routes: any[] | undefined;
  onTagUpdated: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="font-semibold text-primary text-sm">Vehicle Assets</h2>
      <p className="text-xs text-muted-foreground mt-1">
        Total registered transport logs configuration asset grid.
      </p>
    </div>
  );
}

function BoardingLogPanel() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="font-semibold text-primary text-sm">Live Boarding Log</h2>
      <p className="text-xs text-muted-foreground mt-1">
        Real-time board/absent logs from drivers.
      </p>
    </div>
  );
}
function DriverCommunicationsPanel() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="font-semibold text-primary text-sm">Driver Status Logs</h2>
      <p className="text-xs text-muted-foreground mt-1">
        Driver network connectivity pings log.
      </p>
    </div>
  );
}

// ── In-App Notification types and utilities ──
type NotificationRow = {
  id: number;
  passengerId: number | null;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

function notifIcon(type: string): string {
  switch (type) {
    case "absent": return "🚌";
    case "delay": return "⏰";
    case "boarding": return "✅";
    case "announcement": return "📢";
    default: return "🔔";
  }
}

function notifColors(type: string): string {
  switch (type) {
    case "absent":
      return "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-900/10";
    case "delay":
      return "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10";
    case "boarding":
      return "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10";
    default:
      return "border-border bg-muted/30";
  }
}

// ── 🔔 Live Alert Log Panel (replaces WhatsApp panel) ──
function NotificationLogPanel({
  onNewUnread,
}: {
  onNewUnread?: (count: number) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<NotificationRow[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { headers: tenantHeaders() });
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json();
    },
    refetchInterval: 12000,
  });

  const rows = data ?? [];
  const unread = rows.filter((r) => !r.readAt).length;

  useEffect(() => {
    onNewUnread?.(unread);
  }, [unread, onNewUnread]);

  async function markAllRead() {
    await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: tenantHeaders(),
    });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-amber-500" />
          <h2 className="font-semibold text-primary text-sm">Live Alert Log</h2>
          {unread > 0 && (
            <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
              {unread} new
            </span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-[11px] text-amber-600 hover:text-amber-500 font-semibold transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Real-time absence &amp; delay alerts — delivered instantly in the OrbitTrack app. No WhatsApp required.
      </p>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Loading alerts…</p>
      )}

      {!isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-6">
          No alerts yet. Alerts appear here when a student is marked absent or a bus delay is reported.
        </p>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`rounded-lg border p-2.5 flex gap-2.5 items-start text-xs transition-all ${notifColors(row.type)} ${
                !row.readAt ? "ring-1 ring-amber-400/40" : "opacity-75"
              }`}
            >
              <span className="text-base leading-none mt-0.5 shrink-0">{notifIcon(row.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-semibold text-foreground ${!row.readAt ? "text-amber-700 dark:text-amber-300" : ""}`}>
                    {row.title}
                  </span>
                  {!row.readAt && (
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{row.body}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {new Date(row.createdAt).toLocaleString("en-NP", { timeZone: "Asia/Kathmandu" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function FleetCostsSummaryCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="font-semibold text-primary text-sm">
        Monthly Logistics Costs
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        Monthly consolidated metrics overview matrix.
      </p>
    </div>
  );
}

const STUDENT_CLASS_OPTIONS = [
  "Play Group", "Nursery", "LKG", "UKG",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
  "Others",
];

const STUDENT_FACULTY_OPTIONS = [
  "Science",
  "Management",
  "Humanities/Arts",
  "Law",
  "Education",
  "Engineering",
  "Medical/Nursing",
  "BCA/CSIT",
  "BBA",
  "Vocational",
  "Others",
];

const STUDENT_FACULTY_CLASSES = new Set(["11", "12", "Others"]);

// ── ➕ Add Student / Staff Dialog (mirrors public registration form fields) ──
function AddPersonDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: "student" | "staff";
}) {
  const queryClient = useQueryClient();
  const { data: stations } = useListStations();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [gender, setGender] = useState("");
  const [stationId, setStationId] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [faculty, setFaculty] = useState("");
  const [customFaculty, setCustomFaculty] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const showFaculty = role === "student" && STUDENT_FACULTY_CLASSES.has(className);

  function reset() {
    setName("");
    setPhone("");
    setParentName("");
    setGender("");
    setStationId("");
    setClassName("");
    setSection("");
    setRollNumber("");
    setFaculty("");
    setCustomFaculty("");
    setDesignation("");
    setPhotoUrl("");
    setErr("");
  }

  async function handleSave() {
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    if (!stationId) {
      setErr("Please select a boarding station");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      await apiPost("/passengers", {
        name: name.trim(),
        phone: phone.trim() || undefined,
        parentName: parentName.trim() || undefined,
        gender: gender || undefined,
        role,
        stationId: Number(stationId),
        photoUrl: photoUrl || undefined,
        ...(role === "student"
          ? {
              className: className || undefined,
              section: section.trim() || undefined,
              rollNumber: rollNumber.trim() || undefined,
              faculty: showFaculty
                ? faculty === "Others"
                  ? customFaculty.trim() || "Others"
                  : faculty || undefined
                : undefined,
            }
          : { designation: designation.trim() || undefined }),
      });
      queryClient.invalidateQueries({
        queryKey: getListPassengersQueryKey(),
      });
      reset();
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Add New {role === "student" ? "Student" : "Staff"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 text-xs">
          <PhotoPicker value={photoUrl} onChange={setPhotoUrl} name={name || "New"} />
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Full Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Aayush Shrestha"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Mobile Number
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98XXXXXXXX"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Parent / Guardian Name
            </label>
            <input
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="e.g., Ram Prasad Shrestha"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Gender</label>
            <div className="flex gap-2">
              {["Male", "Female", "Other"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(gender === g ? "" : g)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                    gender === g
                      ? "bg-amber-500 border-amber-500 text-slate-900"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Boarding Station *
            </label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background"
            >
              <option value="">Select station</option>
              {(stations ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {role === "student" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-semibold text-muted-foreground">
                    Class
                  </label>
                  <select
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full border rounded-lg p-2 bg-background"
                  >
                    <option value="">Select class</option>
                    {STUDENT_CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-muted-foreground">
                    Section
                  </label>
                  <input
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="A"
                    className="w-full border rounded-lg p-2 bg-background outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-muted-foreground">
                  Roll Number
                </label>
                <input
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g., 12"
                  className="w-full border rounded-lg p-2 bg-background outline-none"
                />
              </div>
              {showFaculty && (
                <div>
                  <label className="mb-1 block font-semibold text-muted-foreground">
                    Faculty
                  </label>
                  <select
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    className="w-full border rounded-lg p-2 bg-background"
                  >
                    <option value="">Select faculty</option>
                    {STUDENT_FACULTY_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  {faculty === "Others" && (
                    <input
                      value={customFaculty}
                      onChange={(e) => setCustomFaculty(e.target.value)}
                      placeholder="Specify faculty"
                      className="w-full border rounded-lg p-2 mt-2 bg-background outline-none"
                    />
                  )}
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">
                Designation
              </label>
              <input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g., Teacher, Accountant"
                className="w-full border rounded-lg p-2 bg-background outline-none"
              />
            </div>
          )}
          {err && <p className="text-red-500 font-semibold">{err}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 text-slate-900 font-bold py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Register"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ➕ Add Driver Dialog ──
function AddDriverDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: routes } = useListRoutes();
  const { data: vehicles } = useListVehicles();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [gender, setGender] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [routeId, setRouteId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function reset() {
    setName("");
    setPhone("");
    setPhotoUrl("");
    setGender("");
    setVehicleNumber("");
    setRouteId("");
    setErr("");
  }

  async function handleSave() {
    if (!name.trim() || !phone.trim() || !vehicleNumber.trim()) {
      setErr("Name, mobile number and vehicle number are required");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      const driver = await apiPost("/drivers", {
        name: name.trim(),
        phone: phone.trim(),
        photoUrl: photoUrl || undefined,
        gender: gender || undefined,
        vehicleNumber: vehicleNumber.trim(),
      });
      if (routeId) {
        await apiPatch(`/routes/${routeId}`, { driverId: driver.id });
      }
      queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListRoutesQueryKey() });
      reset();
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to add driver");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add New Driver</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 text-xs">
          <PhotoPicker value={photoUrl} onChange={setPhotoUrl} name={name || "New Driver"} />
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Full Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ram Bahadur"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Mobile Number *
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98XXXXXXXX"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Gender</label>
            <div className="flex gap-2">
              {["Male", "Female", "Other"].map((g) => (
                <button key={g} type="button" onClick={() => setGender(gender === g ? "" : g)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${gender === g ? "bg-amber-500 border-amber-500 text-slate-900" : "border-border bg-background text-foreground hover:bg-muted"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Vehicle Number *
            </label>
            <select
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background outline-none"
            >
              <option value="">Select Vehicle</option>
              {(vehicles ?? []).map((v: any) => (
                <option key={v.id} value={v.plateNumber}>
                  {v.plateNumber} ({v.model})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Assign Route (optional)
            </label>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background outline-none"
            >
              <option value="">No route</option>
              {(routes ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="text-red-500 font-semibold">{err}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 text-slate-900 font-bold py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Register"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ✏️ Edit Driver Dialog (also lets you (re)assign the driver's route) ──
function EditDriverDialog({
  open,
  onOpenChange,
  driver,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: any | null;
}) {
  const queryClient = useQueryClient();
  const { data: routes } = useListRoutes();
  const { data: vehicles } = useListVehicles();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [gender, setGender] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [routeId, setRouteId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (driver && open) {
      setName(driver.name ?? "");
      setPhone(driver.phone ?? "");
      setPhotoUrl(driver.photoUrl ?? "");
      setGender(driver.gender ?? "");
      setVehicleNumber(driver.vehicleNumber ?? "");
      const currentRoute = (routes ?? []).find(
        (r: any) => r.driverId === driver.id,
      );
      setRouteId(currentRoute ? String(currentRoute.id) : "");
      setErr("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, open]);

  async function handleSave() {
    if (!driver) return;
    if (!name.trim() || !phone.trim() || !vehicleNumber.trim()) {
      setErr("Name, mobile number and vehicle number are required");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      await apiPatch(`/drivers/${driver.id}`, {
        name: name.trim(),
        phone: phone.trim(),
        photoUrl: photoUrl || undefined,
        gender: gender || undefined,
        vehicleNumber: vehicleNumber.trim(),
      });
      const previousRoute = (routes ?? []).find(
        (r: any) => r.driverId === driver.id,
      );
      if (previousRoute && String(previousRoute.id) !== routeId) {
        await apiPatch(`/routes/${previousRoute.id}`, { driverId: null });
      }
      if (routeId) {
        await apiPatch(`/routes/${routeId}`, { driverId: driver.id });
      }
      queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListRoutesQueryKey() });
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to update driver");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Driver</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 text-xs">
          <PhotoPicker value={photoUrl} onChange={setPhotoUrl} name={name || "Driver"} />
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Full Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Mobile Number *
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Gender</label>
            <div className="flex gap-2">
              {["Male", "Female", "Other"].map((g) => (
                <button key={g} type="button" onClick={() => setGender(gender === g ? "" : g)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${gender === g ? "bg-amber-500 border-amber-500 text-slate-900" : "border-border bg-background text-foreground hover:bg-muted"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Vehicle Number *
            </label>
            <select
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background outline-none"
            >
              <option value="">Select Vehicle</option>
              {vehicleNumber && !(vehicles ?? []).some((v: any) => v.plateNumber === vehicleNumber) && (
                <option value={vehicleNumber}>{vehicleNumber}</option>
              )}
              {(vehicles ?? []).map((v: any) => (
                <option key={v.id} value={v.plateNumber}>
                  {v.plateNumber} ({v.model})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Assign Route
            </label>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background outline-none"
            >
              <option value="">No route</option>
              {(routes ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="text-red-500 font-semibold">{err}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 text-slate-900 font-bold py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ➕ Add Vehicle Dialog ──
function AddVehicleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [plateNumber, setPlateNumber] = useState("");
  const [model, setModel] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function reset() {
    setPlateNumber("");
    setModel("");
    setCapacity("");
    setErr("");
  }

  async function handleSave() {
    if (!plateNumber.trim() || !model.trim()) {
      setErr("Plate number and model are required");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      await apiPost("/vehicles", {
        plateNumber: plateNumber.trim(),
        model: model.trim(),
        capacity: capacity ? Number(capacity) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
      reset();
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to add vehicle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Plate Number *
            </label>
            <input
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="e.g., BA 3 CHA 4567"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Model *
            </label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g., Tata Starbus"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Seating Capacity
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="40"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          {err && <p className="text-red-500 font-semibold">{err}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 text-slate-900 font-bold py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Register"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ✏️ Edit Student / Staff Dialog ──
function EditPersonDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: any | null;
}) {
  const queryClient = useQueryClient();
  const { data: stations } = useListStations();
  const isStudent = person?.role === "student";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [gender, setGender] = useState("");
  const [stationId, setStationId] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [faculty, setFaculty] = useState("");
  const [customFaculty, setCustomFaculty] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const showFaculty = isStudent && STUDENT_FACULTY_CLASSES.has(className);

  useEffect(() => {
    if (person && open) {
      setName(person.name ?? "");
      setPhone(person.phone ?? "");
      setParentName(person.parentName ?? "");
      setGender(person.gender ?? "");
      setStationId(person.stationId ? String(person.stationId) : "");
      setClassName(person.className ?? "");
      setSection(person.section ?? "");
      setRollNumber(person.rollNumber ?? "");
      const fac = person.faculty ?? "";
      const isKnown = STUDENT_FACULTY_OPTIONS.includes(fac) || fac === "";
      if (!isKnown) {
        setFaculty("Others");
        setCustomFaculty(fac);
      } else {
        setFaculty(fac);
        setCustomFaculty("");
      }
      setDesignation(person.designation ?? "");
      setPhotoUrl(person.photoUrl ?? "");
      setErr("");
    }
  }, [person, open]);

  async function handleSave() {
    if (!name.trim()) { setErr("Name is required"); return; }
    setErr(""); setSaving(true);
    try {
      const effectiveFaculty = showFaculty
        ? faculty === "Others" ? customFaculty.trim() || "Others" : faculty
        : undefined;
      await apiPatch(`/passengers/${person.id}`, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        parentName: parentName.trim() || undefined,
        gender: gender || undefined,
        photoUrl: photoUrl || undefined,
        stationId: stationId ? Number(stationId) : undefined,
        ...(isStudent ? {
          className: className || undefined,
          section: section.trim() || undefined,
          rollNumber: rollNumber.trim() || undefined,
          faculty: effectiveFaculty,
        } : {
          designation: designation.trim() || undefined,
        }),
      });
      queryClient.invalidateQueries({ queryKey: getListPassengersQueryKey() });
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {isStudent ? "Student" : "Staff"} Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 text-xs">
          <PhotoPicker value={photoUrl} onChange={setPhotoUrl} name={name || "Person"} />
          {/* Name */}
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Full Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background outline-none focus:border-amber-500" />
          </div>
          {/* Mobile */}
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Mobile Number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX"
              className="w-full border rounded-lg p-2 bg-background outline-none focus:border-amber-500" />
          </div>
          {/* Parent Name */}
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              {isStudent ? "Parent / Guardian Name" : "Emergency Contact Name"}
            </label>
            <input value={parentName} onChange={(e) => setParentName(e.target.value)}
              placeholder="e.g., Ram Prasad Shrestha"
              className="w-full border rounded-lg p-2 bg-background outline-none focus:border-amber-500" />
          </div>
          {/* Gender */}
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Gender</label>
            <div className="grid grid-cols-3 gap-1.5">
              {["Male", "Female", "Other"].map((g) => (
                <button key={g} type="button"
                  onClick={() => setGender(gender === g ? "" : g)}
                  className={`rounded-lg border py-2 text-[11px] font-semibold transition-all ${
                    gender === g
                      ? "border-amber-500 bg-amber-500/10 text-amber-600"
                      : "border-border bg-background text-muted-foreground hover:border-amber-400"
                  }`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          {/* Boarding Station */}
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Boarding Station</label>
            <select value={stationId} onChange={(e) => setStationId(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background">
              <option value="">Select station</option>
              {(stations ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {isStudent ? (
            <>
              {/* Class + Section */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-semibold text-muted-foreground">Class</label>
                  <select value={className}
                    onChange={(e) => { setClassName(e.target.value); setFaculty(""); }}
                    className="w-full border rounded-lg p-2 bg-background">
                    <option value="">Select class</option>
                    {STUDENT_CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-muted-foreground">Section</label>
                  <input value={section} onChange={(e) => setSection(e.target.value.toUpperCase())}
                    placeholder="e.g., A"
                    className="w-full border rounded-lg p-2 bg-background outline-none focus:border-amber-500" />
                </div>
              </div>
              {/* Roll Number */}
              <div>
                <label className="mb-1 block font-semibold text-muted-foreground">Roll Number</label>
                <input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g., 12"
                  className="w-full border rounded-lg p-2 bg-background outline-none focus:border-amber-500" />
              </div>
              {/* Faculty */}
              {showFaculty && (
                <div>
                  <label className="mb-1 block font-semibold text-muted-foreground">Faculty</label>
                  <select value={faculty} onChange={(e) => setFaculty(e.target.value)}
                    className="w-full border rounded-lg p-2 bg-background">
                    <option value="">Select faculty</option>
                    {STUDENT_FACULTY_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  {faculty === "Others" && (
                    <input value={customFaculty} onChange={(e) => setCustomFaculty(e.target.value)}
                      placeholder="Specify faculty"
                      className="w-full border rounded-lg p-2 mt-2 bg-background outline-none focus:border-amber-500" />
                  )}
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Designation</label>
              <input value={designation} onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g., Teacher, Accountant"
                className="w-full border rounded-lg p-2 bg-background outline-none focus:border-amber-500" />
            </div>
          )}

          {err && <p className="text-red-500 font-semibold">{err}</p>}
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-amber-500 text-slate-900 font-bold py-2 rounded-lg disabled:opacity-50 hover:bg-amber-400 transition-colors">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── 🎓 Students Panel: class → section → students, search by name/mobile/class ──
function StudentsPanel() {
  const { data: passengers } = useListPassengers();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<any | null>(null);

  const students = useMemo(
    () => (passengers ?? []).filter((p: any) => p.role === "student"),
    [passengers],
  );

  const classes = useMemo(
    () =>
      Array.from(
        new Set(students.map((s: any) => s.className).filter(Boolean)),
      ).sort() as string[],
    [students],
  );
  const sections = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .filter((s: any) => !classFilter || s.className === classFilter)
            .map((s: any) => s.section)
            .filter(Boolean),
        ),
      ).sort() as string[],
    [students, classFilter],
  );
  const faculties = useMemo(
    () =>
      Array.from(
        new Set(students.map((s: any) => s.faculty).filter(Boolean)),
      ).sort() as string[],
    [students],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s: any) => {
      if (classFilter && s.className !== classFilter) return false;
      if (sectionFilter && s.section !== sectionFilter) return false;
      if (facultyFilter && s.faculty !== facultyFilter) return false;
      if (!q) return true;
      return (
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        (s.className ?? "").toLowerCase().includes(q) ||
        (s.rollNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [students, search, classFilter, sectionFilter, facultyFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, any[]>>();
    for (const s of filtered) {
      const cls = s.className || "Unassigned";
      const sec = s.section || "—";
      if (!map.has(cls)) map.set(cls, new Map());
      const secMap = map.get(cls)!;
      if (!secMap.has(sec)) secMap.set(sec, []);
      secMap.get(sec)!.push(s);
    }
    return map;
  }, [filtered]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border font-bold text-sm text-primary flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <User size={15} className="text-amber-500" /> Students Directory
        </span>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 bg-amber-500 text-slate-900 text-[11px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-amber-400"
        >
          <Plus size={12} /> Add New
        </button>
      </div>
      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} role="student" />
      <EditPersonDialog
        open={!!editStudent}
        onOpenChange={(o) => !o && setEditStudent(null)}
        person={editStudent}
      />
      <div className="p-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name / mobile / roll no."
            className="w-full border rounded-xl pl-8 pr-2 py-2 text-xs bg-background outline-none"
          />
        </div>
        {/* Filter row */}
        <div className="grid grid-cols-3 gap-2">
          <select
            value={classFilter}
            onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(""); }}
            className="border rounded-xl px-2 py-2 text-xs bg-background"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="border rounded-xl px-2 py-2 text-xs bg-background"
          >
            <option value="">All Sections</option>
            {sections.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <select
            value={facultyFilter}
            onChange={(e) => setFacultyFilter(e.target.value)}
            className="border rounded-xl px-2 py-2 text-xs bg-background"
          >
            <option value="">All Faculty</option>
            {faculties.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {filtered.length} student{filtered.length !== 1 ? "s" : ""} · tap a name to edit
        </p>

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 italic">
            No students found.
          </p>
        ) : (
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([cls, secMap]) => (
              <div key={cls} className="space-y-2">
                <p className="text-xs font-bold text-amber-600">{cls}</p>
                {Array.from(secMap.entries()).map(([sec, list]) => (
                  <div key={sec} className="border rounded-xl overflow-hidden bg-muted/10">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/30 flex items-center justify-between">
                      <span>Section {sec}</span>
                      <span>{list.length} student(s)</span>
                    </div>
                    <div className="divide-y">
                      {list.map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setEditStudent(s)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-left hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors group"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground group-hover:text-amber-600 transition-colors">
                              {s.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Roll: {s.rollNumber || "—"}
                              {s.faculty ? ` · ${s.faculty}` : ""}
                              {s.gender ? ` · ${s.gender}` : ""}
                              {s.parentName ? ` · Parent: ${s.parentName}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone size={11} />
                              <span className="font-mono">{s.phone || "—"}</span>
                            </span>
                            <Pencil size={12} className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 🚌 Driver Panel: list all drivers with search ──
function DriverPanel() {
  const { data: drivers } = useListDrivers();
  const { data: routes } = useListRoutes();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<any | null>(null);

  const routeNameByDriverId = useMemo(() => {
    const map = new Map<number, string>();
    (routes ?? []).forEach((r: any) => {
      if (r.driverId) map.set(r.driverId, r.name);
    });
    return map;
  }, [routes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers ?? [];
    return (drivers ?? []).filter(
      (d: any) =>
        (d.name ?? "").toLowerCase().includes(q) ||
        (d.phone ?? "").toLowerCase().includes(q) ||
        (d.vehicleNumber ?? "").toLowerCase().includes(q),
    );
  }, [drivers, search]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border font-bold text-sm text-primary flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Bus size={15} className="text-amber-500" /> Drivers Directory
        </span>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 bg-amber-500 text-slate-900 text-[11px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-amber-400"
        >
          <Plus size={12} /> Add New
        </button>
      </div>
      <AddDriverDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditDriverDialog
        open={!!editDriver}
        onOpenChange={(o) => !o && setEditDriver(null)}
        driver={editDriver}
      />
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name / mobile / vehicle"
            className="w-full border rounded-xl pl-8 pr-2 py-2 text-xs bg-background outline-none"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 italic">
            No drivers found.
          </p>
        ) : (
          <div className="divide-y border rounded-xl overflow-hidden bg-muted/10">
            {filtered.map((d: any) => (
              <button
                key={d.id}
                onClick={() => setEditDriver(d)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${d.isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`}
                  />
                  <div>
                    <p className="font-semibold text-foreground">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.vehicleNumber}
                      {routeNameByDriverId.has(d.id)
                        ? ` · Route: ${routeNameByDriverId.get(d.id)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone size={11} />
                    <span className="font-mono">{d.phone}</span>
                  </span>
                  <Pencil size={12} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 👔 Staff Panel: list passengers with role=staff ──
function StaffPanel() {
  const { data: passengers } = useListPassengers();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<any | null>(null);

  const staff = useMemo(
    () => (passengers ?? []).filter((p: any) => p.role === "staff"),
    [passengers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s: any) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        (s.designation ?? "").toLowerCase().includes(q),
    );
  }, [staff, search]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border font-bold text-sm text-primary flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <User size={15} className="text-amber-500" /> Staff Directory
        </span>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 bg-amber-500 text-slate-900 text-[11px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-amber-400"
        >
          <Plus size={12} /> Add New
        </button>
      </div>
      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} role="staff" />
      <EditPersonDialog
        open={!!editStaff}
        onOpenChange={(o) => !o && setEditStaff(null)}
        person={editStaff}
      />
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name / mobile / designation"
            className="w-full border rounded-xl pl-8 pr-2 py-2 text-xs bg-background outline-none"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          {filtered.length} staff member{filtered.length !== 1 ? "s" : ""} · tap a name to edit
        </p>
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 italic">
            No staff found.
          </p>
        ) : (
          <div className="divide-y border rounded-xl overflow-hidden bg-muted/10">
            {filtered.map((s: any) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setEditStaff(s)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-left hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors group"
              >
                <div>
                  <p className="font-semibold text-foreground group-hover:text-amber-600 transition-colors">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.designation || "Staff"}
                    {s.gender ? ` · ${s.gender}` : ""}
                    {s.parentName ? ` · ${s.parentName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone size={11} />
                    <span className="font-mono">{s.phone || "—"}</span>
                  </span>
                  <Pencil size={12} className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 🛣️ Route Panel: list routes, expand to see all stations on a route ──
type EditingStation = {
  routeStationId: number; // route_stations row id (for DELETE)
  stationId: number;      // stations row id (for PATCH)
  name: string; lat: number; lng: number; radius: number;
};

function RouteStationsList({ routeId }: { routeId: number }) {
  const { data: routeStations } = useListRouteStations(routeId);
  const queryClient = useQueryClient();
  const [pickerOpen,    setPickerOpen]    = useState(false);
  const [editStation,   setEditStation]   = useState<EditingStation | null>(null);
  const [deletingId,    setDeletingId]    = useState<number | null>(null);

  function refreshStations() {
    queryClient.invalidateQueries({ queryKey: getListRouteStationsQueryKey(routeId) });
    queryClient.invalidateQueries({ queryKey: getListStationsQueryKey() });
  }

  async function handleAddStation(station: { name: string; lat: number; lng: number; radius: number }) {
    const created = await apiPost("/stations", station);
    await apiPost(`/routes/${routeId}/stations`, {
      stationId: created.id,
      position: (routeStations?.length ?? 0) + 1,
    });
    refreshStations();
    // map stays open — picker handles success flash & form reset
  }

  async function handleEditStation(station: { name: string; lat: number; lng: number; radius: number }) {
    if (!editStation) return;
    await apiPatch(`/stations/${editStation.stationId}`, station);
    refreshStations();
    setEditStation(null);
  }

  async function handleDeleteStation(rs: { id: number; stationId: number }) {
    setDeletingId(rs.id);
    try {
      // remove from route first
      await apiDelete(`/routes/${routeId}/stations/${rs.id}`);
      // then delete the station itself
      await apiDelete(`/stations/${rs.stationId}`);
      refreshStations();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
          Stops ({routeStations?.length ?? 0})
        </span>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1 bg-amber-500 text-slate-900 text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-amber-400"
        >
          <Plus size={11} /> Add Station
        </button>
      </div>

      {!routeStations ? (
        <p className="text-[11px] text-muted-foreground italic px-3 py-2">Loading stations…</p>
      ) : routeStations.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic px-3 py-2">No stations added yet.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {routeStations.map((rs: any, i: number) => (
            <div key={rs.id} className="flex items-center gap-2 px-3 py-2 text-xs group">
              {/* Position badge */}
              <span className="h-5 w-5 shrink-0 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-600 font-bold text-[10px]">
                {i + 1}
              </span>
              {/* Name + direction */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{rs.stopLabel || rs.stationName}</p>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {rs.direction || "forward"}
                  {rs.eta ? <> · <span className="font-mono">ETA {rs.eta}</span></> : null}
                </p>
              </div>
              {/* Action buttons */}
              {rs.direction !== "return" && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Edit station"
                    onClick={() => setEditStation({
                      routeStationId: rs.id,
                      stationId: rs.stationId,
                      name: rs.stopLabel || rs.stationName || "",
                      lat:  rs.lat    ?? 27.7172,
                      lng:  rs.lng    ?? 85.324,
                      radius: rs.radius ?? 100,
                    })}
                    className="p-1 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    title="Remove station"
                    disabled={deletingId === rs.id}
                    onClick={() => handleDeleteStation({ id: rs.id, stationId: rs.stationId })}
                    className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                  >
                    {deletingId === rs.id
                      ? <RefreshCw size={11} className="animate-spin" />
                      : <Trash2 size={11} />
                    }
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ADD picker — stays open after each add ── */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center pt-8 pb-4 px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md">
            <StationMapPicker
              mode="add"
              existingStations={routeStations?.map(s => ({
                name: s.stationName || s.stopLabel || "",
                stationName: s.stationName,
                stopLabel: s.stopLabel,
                lat: s.lat ?? 0,
                lng: s.lng ?? 0,
                radius: s.radius,
                position: s.position,
                direction: s.direction
              }))}
              onConfirm={handleAddStation}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── EDIT picker — closes after save ── */}
      {editStation && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center pt-8 pb-4 px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md">
            <StationMapPicker
              mode="edit"
              initialStation={{
                name:   editStation.name,
                lat:    editStation.lat,
                lng:    editStation.lng,
                radius: editStation.radius,
              }}
              existingStations={routeStations?.map(s => ({
                name: s.stationName || s.stopLabel || "",
                stationName: s.stationName,
                stopLabel: s.stopLabel,
                lat: s.lat ?? 0,
                lng: s.lng ?? 0,
                radius: s.radius,
                position: s.position,
                direction: s.direction
              }))}
              onConfirm={handleEditStation}
              onClose={() => setEditStation(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── ➕ Add Route Dialog (lets you assign a driver up front) ──
function AddRouteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: drivers } = useListDrivers();
  const [name, setName] = useState("");
  const [driverId, setDriverId] = useState("");
  const [departureTime, setDepartureTime] = useState("06:00 AM");
  const [returnInSameRoute, setReturnInSameRoute] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function reset() {
    setName("");
    setDriverId("");
    setDepartureTime("06:00 AM");
    setReturnInSameRoute(false);
    setErr("");
  }

  async function handleSave() {
    if (!name.trim()) {
      setErr("Route name is required");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      await apiPost("/routes", {
        name: name.trim(),
        driverId: driverId ? Number(driverId) : undefined,
        departureTime: departureTime.trim() || undefined,
        returnInSameRoute,
      });
      queryClient.invalidateQueries({ queryKey: getListRoutesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
      reset();
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to add route");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add New Route</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Route Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Baneshwor Route"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Assign Driver (optional)
            </label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background outline-none"
            >
              <option value="">No driver</option>
              {(drivers ?? []).map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Departure Time
            </label>
            <input
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              placeholder="e.g., 06:00 AM"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="returnInSameRouteAdd"
              checked={returnInSameRoute}
              onChange={(e) => setReturnInSameRoute(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="returnInSameRouteAdd" className="font-semibold text-muted-foreground cursor-pointer select-none">
              Return in Same Route
            </label>
          </div>
          {err && <p className="text-red-500 font-semibold">{err}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 text-slate-900 font-bold py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Route"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ✏️ Edit Route Dialog (reassign driver / vehicle / timing) ──
function EditRouteDialog({
  open,
  onOpenChange,
  route,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: any | null;
}) {
  const queryClient = useQueryClient();
  const { data: drivers } = useListDrivers();
  const [name, setName] = useState("");
  const [driverId, setDriverId] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [returnInSameRoute, setReturnInSameRoute] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (route && open) {
      setName(route.name ?? "");
      setDriverId(route.driverId ? String(route.driverId) : "");
      setDepartureTime(route.departureTime ?? "");
      setReturnInSameRoute(route.returnInSameRoute ?? false);
      setErr("");
    }
  }, [route, open]);

  async function handleSave() {
    if (!route) return;
    if (!name.trim()) {
      setErr("Route name is required");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      await apiPatch(`/routes/${route.id}`, {
        name: name.trim(),
        driverId: driverId ? Number(driverId) : null,
        departureTime: departureTime.trim() || undefined,
        returnInSameRoute,
      });
      queryClient.invalidateQueries({ queryKey: getListRoutesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to update route");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Route</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Route Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Assign Driver
            </label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full border rounded-lg p-2 bg-background outline-none"
            >
              <option value="">No driver</option>
              {(drivers ?? []).map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              Departure Time
            </label>
            <input
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              placeholder="e.g., 06:00 AM"
              className="w-full border rounded-lg p-2 bg-background outline-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="returnInSameRouteEdit"
              checked={returnInSameRoute}
              onChange={(e) => setReturnInSameRoute(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="returnInSameRouteEdit" className="font-semibold text-muted-foreground cursor-pointer select-none">
              Return in Same Route
            </label>
          </div>
          {err && <p className="text-red-500 font-semibold">{err}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 text-slate-900 font-bold py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoutePanel() {
  const { data: routes } = useListRoutes();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editRoute, setEditRoute] = useState<any | null>(null);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border font-bold text-sm text-primary flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Route size={15} className="text-amber-500" /> Routes Directory
        </span>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 bg-amber-500 text-slate-900 text-[11px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-amber-400"
        >
          <Plus size={12} /> Add New
        </button>
      </div>
      <AddRouteDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditRouteDialog
        open={!!editRoute}
        onOpenChange={(o) => !o && setEditRoute(null)}
        route={editRoute}
      />
      <div className="p-4 space-y-2">
        {(routes ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 italic">
            No routes found.
          </p>
        ) : (
          (routes ?? []).map((r: any) => {
            const isOpen = expandedId === r.id;
            return (
              <div
                key={r.id}
                className="border rounded-xl overflow-hidden bg-muted/10"
              >
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : r.id)}
                    className="flex-1 flex items-center justify-between px-3 py-2.5 text-xs"
                  >
                    <div className="text-left">
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        {r.name}
                        {r.isActive && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.driverName || "No driver"} ·{" "}
                        {r.vehiclePlate || "No vehicle"} ·{" "}
                        {r.departureTime || "—"}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronUp
                        size={14}
                        className="text-muted-foreground"
                      />
                    ) : (
                      <ChevronDown
                        size={14}
                        className="text-muted-foreground"
                      />
                    )}
                  </button>
                  <button
                    onClick={() => setEditRoute(r)}
                    className="px-3 py-2.5 text-muted-foreground hover:text-foreground"
                    aria-label="Edit route"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
                {isOpen && <RouteStationsList routeId={r.id} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AdminAdRequestTab({ schoolName }: { schoolName: string }) {
  const [form, setForm] = useState({
    advertiserName: schoolName,
    contactPerson: "",
    phone: "",
    email: "",
    adTitle: schoolName ? `${schoolName} — ` : "",
    subtitle: "",
    imageUrl: "",
    targetUrl: "",
    daysRequested: 7,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: number; costNpr: number } | null>(null);
  const [error, setError] = useState("");

  const costNpr = form.daysRequested * 500;
  function set(key: string, val: string | number) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone || !form.adTitle || !form.imageUrl) {
      setError("Phone, Ad Title and Banner Image are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${ADMIN_BASE}/api/ad-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, costNpr }),
      });
      const data = await res.json() as { id?: number; costNpr?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSubmitted({ id: data.id!, costNpr: data.costNpr! });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-700/60 bg-green-900/20 p-6 text-center space-y-3">
          <div className="text-4xl">✅</div>
          <h3 className="font-bold text-green-300">Ad Request Submitted!</h3>
          <p className="text-sm text-muted-foreground">Your request is pending SuperAdmin review. You'll be contacted once approved.</p>
          <div className="rounded-xl border border-border bg-card p-4 text-left space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference ID</span>
              <span className="font-mono font-bold text-amber-500">#{submitted.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-semibold">{form.daysRequested} days</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-semibold">Total Cost</span>
              <span className="font-bold text-amber-500">NPR {submitted.costNpr.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Rate: NPR 500/day · Payment collected after approval by SuperAdmin</p>
          <button
            onClick={() => setSubmitted(null)}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <Megaphone size={22} className="text-amber-500" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-base">Place an Advertisement</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Your banner will appear on all user dashboards across OrbitTrack. Rate: <strong className="text-amber-500">NPR 500 / day</strong>.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Advertiser info */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Advertiser Details</p>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Company / School Name</label>
            <input
              value={form.advertiserName}
              onChange={(e) => set("advertiserName", e.target.value)}
              placeholder="Your school or company name"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Contact Person</label>
              <input
                value={form.contactPerson}
                onChange={(e) => set("contactPerson", e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Phone <span className="text-red-400">*</span></label>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="98XXXXXXXX"
                type="tel"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email (optional)</label>
            <input
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="contact@school.edu.np"
              type="email"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Ad Content */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Ad Content</p>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ad Title <span className="text-red-400">*</span></label>
            <input
              value={form.adTitle}
              onChange={(e) => set("adTitle", e.target.value)}
              placeholder="Sunrise Academy — Admissions Open 2082"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Subtitle / Tagline</label>
            <input
              value={form.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
              placeholder="Nepal's Premier School · Kathmandu"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Banner Image <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              <input
                value={form.imageUrl}
                onChange={(e) => set("imageUrl", e.target.value)}
                placeholder="https://... or upload →"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500"
              />
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                ↑ Upload
                <input type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) set("imageUrl", await fileToDataUrl(f));
                    e.target.value = "";
                  }} />
              </label>
            </div>
          </div>

          {/* Preview */}
          {form.imageUrl && (
            <div className="relative h-24 w-full overflow-hidden rounded-xl border border-border">
              <img
                src={form.imageUrl}
                alt="preview"
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/600x96/1e293b/64748b?text=Invalid+URL"; }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center px-4">
                <div>
                  <p className="text-sm font-bold text-white">{form.adTitle || "Ad Title"}</p>
                  {form.subtitle && <p className="text-xs text-slate-300">{form.subtitle}</p>}
                </div>
              </div>
              <span className="absolute top-2 right-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-slate-900">PREVIEW</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Website Link (optional)</label>
            <input
              value={form.targetUrl}
              onChange={(e) => set("targetUrl", e.target.value)}
              placeholder="https://yourschool.edu.np"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Duration & cost */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Duration & Cost</p>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-muted-foreground">Number of Days</label>
              <span className="text-xs font-bold text-foreground">{form.daysRequested} day{form.daysRequested !== 1 ? "s" : ""}</span>
            </div>
            <input
              type="range"
              min={1}
              max={90}
              value={form.daysRequested}
              onChange={(e) => set("daysRequested", Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>1 day</span>
              <span>30 days</span>
              <span>90 days</span>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Cost Estimate</p>
              <p className="text-xs text-muted-foreground mt-0.5">NPR 500 × {form.daysRequested} days</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-amber-500">NPR {costNpr.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">collected after approval</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting || !form.phone || !form.adTitle || !form.imageUrl}
          className="w-full rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-50 transition-colors shadow-md"
        >
          {submitting ? "Submitting…" : `Submit Ad Request — NPR ${costNpr.toLocaleString()}`}
        </button>
        <p className="text-center text-xs text-muted-foreground">No payment now · SuperAdmin reviews and contacts you</p>
      </form>
    </div>
  );
}

function TikTokIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

function BannerAdjusterDialog({
  src,
  open,
  onConfirm,
  onClose,
}: {
  src: string;
  open: boolean;
  onConfirm: (adjustedDataUrl: string) => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  function handleApply() {
    setLoading(true);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setLoading(false);
      onClose();
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      
      // Translate to canvas center
      ctx.translate(canvas.width / 2, canvas.height / 2);
      
      // Apply scale
      ctx.scale(zoom, zoom);
      
      // Apply pan offset scaled from 450px preview to 1200px canvas
      const scaleFactor = 1200 / 450;
      ctx.translate(panX * scaleFactor, panY * scaleFactor);

      // Sizing to cover canvas at scale=1
      const imgRatio = img.width / img.height;
      const targetRatio = canvas.width / canvas.height;
      let drawW = canvas.width;
      let drawH = canvas.height;
      if (imgRatio > targetRatio) {
        drawW = canvas.height * imgRatio;
      } else {
        drawH = canvas.width / imgRatio;
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      try {
        const adjustedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        onConfirm(adjustedDataUrl);
      } catch (err) {
        console.error("Failed to crop banner:", err);
      } finally {
        setLoading(false);
        onClose();
      }
    };
    img.onerror = () => {
      setLoading(false);
      onClose();
    };
    img.src = src;
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-5 space-y-4 shadow-2xl text-foreground">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <Pencil size={15} className="text-amber-500" /> Frame & Adjust Banner
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Use sliders to zoom and pan the banner image</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex justify-center py-2 bg-muted/30 rounded-xl border border-dashed border-border/80">
          <div className="w-[450px] h-[150px] max-w-full relative overflow-hidden bg-slate-950 rounded-xl shadow-inner border border-border/60">
            <img
              src={src}
              alt="Preview"
              className="w-full h-full object-cover select-none pointer-events-none origin-center"
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              }}
            />
            {/* Aspect Ratio Guide Grid */}
            <div className="absolute inset-0 border border-amber-500/20 pointer-events-none flex items-center justify-center">
              <div className="w-full h-[1px] bg-white/10" />
              <div className="absolute h-full w-[1px] bg-white/10" />
            </div>
          </div>
        </div>

        {/* Adjustments Sliders */}
        <div className="space-y-3.5 bg-muted/20 p-3.5 rounded-xl border border-border text-xs">
          {/* Zoom Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span className="font-semibold">Zoom Scale</span>
              <span className="font-mono text-amber-500">{zoom.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Pan X Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span className="font-semibold">Horizontal Pan (Left / Right)</span>
              <span className="font-mono text-amber-500">{panX > 0 ? `+${panX}` : panX}px</span>
            </div>
            <input
              type="range"
              min="-150"
              max="150"
              value={panX}
              onChange={(e) => setPanX(parseInt(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Pan Y Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span className="font-semibold">Vertical Pan (Up / Down)</span>
              <span className="font-mono text-amber-500">{panY > 0 ? `+${panY}` : panY}px</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={panY}
              onChange={(e) => setPanY(parseInt(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold hover:bg-muted text-muted-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="flex-1 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-1.5"
          >
            {loading ? "Processing..." : "Apply Adjustments"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ensureExternalLink(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function AdminContactTab({
  tenant,
  onTenantUpdate,
}: {
  tenant: any;
  onTenantUpdate: (updated: any) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [name, setName] = useState(tenant?.name ?? "");
  const [address, setAddress] = useState(tenant?.address ?? "");
  const [phone, setPhone] = useState(tenant?.contactPhone ?? "");
  const [email, setEmail] = useState(tenant?.email ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(tenant?.websiteUrl ?? "");
  const [facebookUrl, setFacebookUrl] = useState(tenant?.facebookUrl ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(tenant?.tiktokUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(tenant?.instagramUrl ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(tenant?.youtubeUrl ?? "");
  
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(tenant?.bannerUrl ?? "");
  
  // Temporary state for the uncropped banner file
  const [sourceBanner, setSourceBanner] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Sync state if tenant updates from background (only when NOT editing)
  useEffect(() => {
    if (tenant && !isEditing) {
      setName(tenant.name ?? "");
      setAddress(tenant.address ?? "");
      setPhone(tenant.contactPhone ?? "");
      setEmail(tenant.email ?? "");
      setWebsiteUrl(tenant.websiteUrl ?? "");
      setFacebookUrl(tenant.facebookUrl ?? "");
      setTiktokUrl(tenant.tiktokUrl ?? "");
      setInstagramUrl(tenant.instagramUrl ?? "");
      setYoutubeUrl(tenant.youtubeUrl ?? "");
      setLogoUrl(tenant.logoUrl ?? "");
      setBannerUrl(tenant.bannerUrl ?? "");
    }
  }, [tenant, isEditing]);

  async function handleSave() {
    setSaving(true);
    setSuccess(false);
    setError("");
    try {
      const data = await apiPatch(`/tenants/${tenant.id}`, {
        name,
        address: address || null,
        contactPhone: phone || null,
        email: email || null,
        websiteUrl: websiteUrl || null,
        facebookUrl: facebookUrl || null,
        tiktokUrl: tiktokUrl || null,
        instagramUrl: instagramUrl || null,
        youtubeUrl: youtubeUrl || null,
        logoUrl: logoUrl || null,
        bannerUrl: bannerUrl || null,
      });
      onTenantUpdate(data);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsEditing(false); // Auto-close/redirect to view mode!
      }, 1000);
    } catch (e: any) {
      setError(e.message || "Failed to update school contact details");
    } finally {
      setSaving(false);
    }
  }

  // Read-only View Mode render
  if (!isEditing) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
          {/* Cover Banner */}
          <div className="relative h-44 bg-slate-800 shrink-0">
            {bannerUrl ? (
              <img src={bannerUrl} alt="School Banner" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#1e1e2d]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
            
            {/* Logo overlay */}
            <div className="absolute -bottom-8 left-6 h-20 w-20 rounded-full border-4 border-background bg-slate-900 overflow-hidden flex items-center justify-center shadow-lg">
              {logoUrl ? (
                <img src={logoUrl} alt="School Logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 size={28} className="text-amber-500" />
              )}
            </div>
            
            {/* Edit button on banner top right */}
            <button
              onClick={() => setIsEditing(true)}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-amber-500 hover:text-slate-900 transition-all text-white border border-white/20 hover:border-amber-500/40 text-xs font-bold backdrop-blur-sm shadow-sm"
            >
              <Pencil size={12} /> Edit Profile & Branding
            </button>
          </div>
          
          <div className="pt-10 px-6 pb-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-foreground text-xl leading-tight">{name || "School Name"}</h3>
                <span className="font-mono text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5 uppercase tracking-wider">
                  {tenant?.schoolCode || "SCHOOLCODE"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Official institutional profile and connections</p>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border">
              <div className="space-y-3.5 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Address</p>
                  <p className="text-foreground font-medium mt-0.5 flex items-center gap-2">
                    <MapPin size={14} className="text-amber-500 shrink-0" /> {address || <span className="text-muted-foreground/60 italic">No address set</span>}
                  </p>
                </div>
                
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Phone Number</p>
                  <p className="text-foreground font-medium mt-0.5 flex items-center gap-2">
                    <Phone size={14} className="text-amber-500 shrink-0" /> {phone || <span className="text-muted-foreground/60 italic">No phone number set</span>}
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email Address</p>
                  <p className="text-foreground font-medium mt-0.5 flex items-center gap-2">
                    <Mail size={14} className="text-amber-500 shrink-0" /> {email || <span className="text-muted-foreground/60 italic">No email address set</span>}
                  </p>
                </div>
                
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Website URL</p>
                  <p className="text-foreground font-medium mt-0.5 flex items-center gap-2">
                    <Globe size={14} className="text-amber-500 shrink-0" /> 
                    {websiteUrl ? (
                      <a href={ensureExternalLink(websiteUrl)} target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">{websiteUrl}</a>
                    ) : (
                      <span className="text-muted-foreground/60 italic">No website set</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Social media connections display */}
            <div className="border-t border-border pt-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Social Connections</p>
              <div className="flex gap-2.5">
                {facebookUrl && (
                  <a href={ensureExternalLink(facebookUrl)} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted hover:bg-amber-500 hover:text-slate-900 transition-colors border border-border" title="Facebook">
                    <Facebook size={14} />
                  </a>
                )}
                {tiktokUrl && (
                  <a href={ensureExternalLink(tiktokUrl)} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted hover:bg-amber-500 hover:text-slate-900 transition-colors border border-border" title="TikTok">
                    <TikTokIcon size={14} />
                  </a>
                )}
                {instagramUrl && (
                  <a href={ensureExternalLink(instagramUrl)} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted hover:bg-amber-500 hover:text-slate-900 transition-colors border border-border" title="Instagram">
                    <Instagram size={14} />
                  </a>
                )}
                {youtubeUrl && (
                  <a href={ensureExternalLink(youtubeUrl)} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-muted hover:bg-amber-500 hover:text-slate-900 transition-colors border border-border" title="YouTube">
                    <Youtube size={14} />
                  </a>
                )}
                {!facebookUrl && !tiktokUrl && !instagramUrl && !youtubeUrl && (
                  <span className="text-xs text-muted-foreground italic">No social media links connected. Click edit to add them.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit Mode render (two-column layout with adjuster dialog)
  return (
    <div className="grid gap-6 md:grid-cols-12 animate-in fade-in duration-200">
      {/* Banner Adjuster modal */}
      <BannerAdjusterDialog
        src={sourceBanner || ""}
        open={!!sourceBanner}
        onConfirm={(adjustedUrl) => {
          setBannerUrl(adjustedUrl);
          setSourceBanner(null);
        }}
        onClose={() => setSourceBanner(null)}
      />

      {/* Left side: Live Preview */}
      <div className="md:col-span-5 space-y-4">
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="relative h-28 bg-slate-800 shrink-0">
            {bannerUrl ? (
              <img src={bannerUrl} alt="School Banner" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#1e1e2d]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            
            {/* Logo overlay */}
            <div className="absolute -bottom-6 left-4 h-14 w-14 rounded-full border-2 border-amber-500 bg-slate-900 overflow-hidden flex items-center justify-center shadow-lg">
              {logoUrl ? (
                <img src={logoUrl} alt="School Logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 size={20} className="text-amber-500" />
              )}
            </div>
          </div>
          
          <div className="pt-8 px-4 pb-4 flex-1 space-y-4">
            <div>
              <h3 className="font-black text-foreground text-base truncate">{name || "School Name"}</h3>
              <p className="text-[10px] text-[#FFF078] font-mono mt-0.5 font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 rounded inline-block px-1.5 py-0.5">
                {tenant?.schoolCode || "SCHOOLCODE"}
              </p>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-2">
              <p className="flex items-center gap-2"><MapPin size={13} className="text-amber-500" /> {address || "No address set"}</p>
              <p className="flex items-center gap-2"><Phone size={13} className="text-amber-500" /> {phone || "No phone set"}</p>
              <p className="flex items-center gap-2"><Mail size={13} className="text-amber-500" /> {email || "No email set"}</p>
              <p className="flex items-center gap-2"><Globe size={13} className="text-amber-500" /> {websiteUrl ? <span className="text-amber-500 truncate">{websiteUrl}</span> : "No website set"}</p>
            </div>
            
            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Social Connections (Preview)</p>
              <div className="flex gap-2">
                {facebookUrl && <span className="p-1.5 rounded-full bg-muted border border-border"><Facebook size={12} /></span>}
                {tiktokUrl && <span className="p-1.5 rounded-full bg-muted border border-border"><TikTokIcon size={12} /></span>}
                {instagramUrl && <span className="p-1.5 rounded-full bg-muted border border-border"><Instagram size={12} /></span>}
                {youtubeUrl && <span className="p-1.5 rounded-full bg-muted border border-border"><Youtube size={12} /></span>}
                {!facebookUrl && !tiktokUrl && !instagramUrl && !youtubeUrl && (
                  <span className="text-xs text-muted-foreground italic">None connected</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right side: School details update form */}
      <div className="md:col-span-7 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Edit School Profile & Branding</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Manage logo, banner, and tenant-wide contact details.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all font-semibold"
            >
              Cancel
            </button>
          </div>
          
          <div className="space-y-3.5">
            {/* Branding Uploads */}
            <div className="grid gap-4 sm:grid-cols-2 border-b border-border pb-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">School Logo (1:1 Square)</label>
                <div className="flex items-center gap-2">
                  <div className="h-12 w-12 rounded-full border border-border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <Building2 size={16} className="text-muted-foreground" />}
                  </div>
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-bold text-muted-foreground hover:bg-muted transition-colors">
                    <Upload size={12} /> Upload
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (f) setLogoUrl(await fileToDataUrl(f)); }} />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">School Banner (Landscape)</label>
                <div className="flex items-center gap-2">
                  <div className="h-12 w-24 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {bannerUrl ? <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" /> : <Globe size={16} className="text-muted-foreground" />}
                  </div>
                  <button type="button" onClick={() => bannerInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-bold text-muted-foreground hover:bg-muted transition-colors">
                    <Upload size={12} /> Upload & Adjust
                  </button>
                  <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const dataUrl = await fileToDataUrl(f);
                        setSourceBanner(dataUrl);
                        // Reset file input value so same file can be uploaded/adjusted again
                        e.target.value = "";
                      }
                    }} />
                </div>
              </div>
            </div>
            
            {/* Core Info */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">School Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g., Apex Boarding School"
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500" />
              </div>
              
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Phone Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="E.g., +977-1-4400000"
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500" />
              </div>
              
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">School Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E.g., info@school.edu.np"
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500" />
              </div>
              
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Address</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="E.g., Ghatthagr, Bhaktapur"
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500" />
              </div>
              
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Website URL</label>
                <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="E.g., https://school.edu.np"
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500" />
              </div>
            </div>
            
            {/* Social Links */}
            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Social Platform Links</h4>
              
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Facebook Link</label>
                  <input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/..."
                    className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500" />
                </div>
                
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Instagram Link</label>
                  <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..."
                    className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500" />
                </div>
                
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">TikTok Link</label>
                  <input value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@..."
                    className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500" />
                </div>
                
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">YouTube Link</label>
                  <input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..."
                    className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-500" />
                </div>
              </div>
            </div>
          </div>
          
          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-green-500 font-bold">✓ School profile saved successfully!</p>}
          
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="flex-1 rounded-xl border border-border py-3 text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !name.trim()}
              className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-50 transition-colors shadow-md">
              {saving ? "Saving Changes..." : "Save School Branding"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPortal({
  tenant,
  onTenantUpdate,
}: {
  tenant?: any;
  onTenantUpdate?: (updated: any) => void;
}) {
  const { user, login } = useAuth();
  const { data: stations } = useListStations();
  const { data: drivers } = useListDrivers();
  const { data: vehicles } = useListVehicles();
  const { data: adminRoutes } = useListRoutes();
  const queryClient = useQueryClient();

  const [localTenant, setLocalTenant] = useState<any | null>(tenant || user?.tenant || null);
  useEffect(() => {
    if (tenant) setLocalTenant(tenant);
  }, [tenant]);

  const handleTenantUpdate = (updated: any) => {
    setLocalTenant(updated);
    if (onTenantUpdate) onTenantUpdate(updated);
    if (user) {
      login({ ...user, tenant: updated });
    }
  };

  const tenantId = user?.tenantId ?? 1;
  const [mainTab, setMainTab] = useState<
    "overview" | "students" | "drivers" | "staff" | "route" | "vehicleService" | "tripHistory" | "contact" | "advertise"
  >("overview");
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Real-time: listen for "notification" SSE events and invalidate the query
  useEffect(() => {
    const es = new EventSource(`/api/events?tenantId=${tenantId}`);
    es.addEventListener("notification", () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
    return () => es.close();
  }, [tenantId, queryClient]);
  const { data: tripHistory } = useListTripHistory({ limit: 100 });

  useEffect(() => {
    if (!localTenant) {
      fetch(`/api/tenants/${tenantId}`)
        .then((r) => r.json())
        .then((data: any) => {
          setLocalTenant(data);
          if (onTenantUpdate) onTenantUpdate(data);
        })
        .catch(() => {});
    }
  }, [tenantId, localTenant, onTenantUpdate]);

  function refetchAll() {
    queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListStationsQueryKey() });
  }

  return (
    <div className="mx-auto w-full max-w-[860px] p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">{localTenant?.name}</p>
        </div>
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative flex items-center justify-center h-10 w-10 rounded-xl border border-border bg-card hover:bg-muted transition-colors shadow-sm"
            title="Notifications"
          >
            <Bell size={18} className="text-amber-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-12 w-80 z-50 shadow-xl rounded-2xl border border-border bg-background overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-semibold text-sm text-primary">Notifications</span>
                <button onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-3">
                <NotificationLogPanel onNewUnread={setUnreadCount} />
              </div>
            </div>
          )}
        </div>
      </header>

      <nav className="rounded-xl border border-border bg-card shadow-sm flex p-1 gap-1.5 text-xs font-semibold bg-muted/20 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {(
          [
            { key: "overview",       label: "Dashboard", icon: null },
            { key: "students",       label: "Students",  icon: <User size={13} /> },
            { key: "drivers",        label: "Driver",    icon: <Bus size={13} /> },
            { key: "staff",          label: "Staff",     icon: <User size={13} /> },
            { key: "route",          label: "Route",     icon: <Route size={13} /> },
            { key: "vehicleService", label: "Vehicle",   icon: <Wrench size={13} /> },
            { key: "tripHistory",    label: "History",   icon: <HistoryIcon size={13} /> },
            { key: "contact",        label: "Contact",   icon: <Phone size={13} /> },
            { key: "advertise",      label: "Advertise", icon: <Megaphone size={13} /> },
          ] as const
        ).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={`flex-shrink-0 whitespace-nowrap px-3 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 ${
              mainTab === key ? "bg-amber-500 text-slate-900" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </nav>

      {mainTab === "overview" && (
        <div className="space-y-6">
          <FleetCostsSummaryCard />
          <LiveFleetMapPanel />

          <BoardingLogPanel />

          <NotificationLogPanel onNewUnread={setUnreadCount} />

          {/* ── 🚀 ह्वाट्सएपको सट्टा हाम्रै आन्तरिक इन-एप ब्रोडकास्टर थपिएको ── */}
          <InternalAppNotificationsPanel />

          <DriverCommunicationsPanel />
          <SmartStationManager
            stations={stations as any[] | undefined}
            onChanged={refetchAll}
          />
          <VehicleTagGrid
            vehicles={vehicles as any[] | undefined}
            routes={adminRoutes as any[] | undefined}
            onTagUpdated={refetchAll}
          />
          <CalendarManager />
        </div>
      )}

      {mainTab === "students" && (
        <div className="space-y-6">
          <StudentsPanel />
        </div>
      )}

      {mainTab === "drivers" && (
        <div className="space-y-6">
          <DriverPanel />
        </div>
      )}

      {mainTab === "staff" && (
        <div className="space-y-6">
          <StaffPanel />
        </div>
      )}

      {mainTab === "route" && (
        <div className="space-y-6">
          <RoutePanel />
        </div>
      )}

      {mainTab === "vehicleService" && (
        <div className="space-y-6">
          <VehicleServiceTabs vehicles={vehicles as any[] | undefined} />
        </div>
      )}

      {mainTab === "advertise" && (
        <AdminAdRequestTab schoolName={localTenant?.name ?? ""} />
      )}

      {mainTab === "contact" && (
        <AdminContactTab tenant={localTenant} onTenantUpdate={handleTenantUpdate} />
      )}

      {mainTab === "tripHistory" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <HistoryIcon size={16} className="text-amber-500" />
              <h2 className="font-bold text-foreground">Trip History</h2>
              <span className="ml-auto text-xs text-muted-foreground">{(tripHistory ?? []).length} trips</span>
            </div>
            {!tripHistory || tripHistory.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No trips recorded yet. Trips are logged when a driver starts a journey.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tripHistory.map((t) => {
                  const startD = new Date(t.startedAt);
                  const startLabel = startD.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
                  const durationLabel = t.completedAt
                    ? (() => { const mins = Math.round((new Date(t.completedAt).getTime() - startD.getTime()) / 60000); return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`; })()
                    : "In progress";
                  return (
                    <div key={t.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                      <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${t.completedAt ? "bg-green-500" : "bg-amber-400 animate-pulse"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{t.driverName ?? "—"}</span>
                          {t.vehicleNumber && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">{t.vehicleNumber}</span>
                          )}
                          {t.routeName && (
                            <span className="text-xs text-muted-foreground">· {t.routeName}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{startLabel} · {durationLabel}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">{t.passengersBoarded}/{t.passengersTotal}</p>
                        <p className="text-[10px] text-muted-foreground">boarded</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
