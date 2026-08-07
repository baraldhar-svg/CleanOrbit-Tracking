import { useState } from "react";
import { useLocation } from "wouter";
import AppFooter from "@/components/app-footer";
import { Bot } from "lucide-react";

interface FeatureDetail {
  id: string;
  title: string;
  icon: string;
  context: string;
  details: string;
  colorClass: string;
  iconBg: string;
}

const FEATURE_DETAILS: Record<string, FeatureDetail> = {
  "live-gps": {
    id: "live-gps",
    title: "LIVE GPS TRACKING",
    icon: "🛰️",
    context: "Real-time location tracking of school buses.",
    details: "The system utilizes OpenStreetMap to monitor the live movement, coordinates, and routes of school buses. It ensures continuous visibility, allowing administrators and parents to know the exact physical location of the bus at any given moment during transit.",
    colorClass: "text-blue-300 border-blue-500/30",
    iconBg: "bg-blue-600/20 border-blue-600/40 text-blue-300",
  },
  "parent-portal": {
    id: "parent-portal",
    title: "PARENT PORTAL",
    icon: "👨‍👩‍👧",
    context: "Direct communication and updates sent to parents.",
    details: "Dedicated guardian portal designed to prioritize student safety and convenience. Parents receive direct updates, live tracking access, and timely notifications on their registered mobile devices regarding their child's transit status.",
    colorClass: "text-green-300 border-green-500/30",
    iconBg: "bg-green-600/20 border-green-600/40 text-green-300",
  },
  "driver-dashboard": {
    id: "driver-dashboard",
    title: "DRIVER DASHBOARD",
    icon: "🚍",
    context: "Interactive interface for bus drivers.",
    details: "A streamlined mobile-friendly dashboard that provides drivers with turn-by-turn navigation and a station-by-station checkpoint interface, making it easy to manage route progressions and communicate updates back to the central system seamlessly.",
    colorClass: "text-amber-300 border-amber-500/30",
    iconBg: "bg-amber-600/20 border-amber-600/40 text-amber-300",
  },
  "bus-location": {
    id: "bus-location",
    title: "Bus Location on Map",
    icon: "🗺️",
    context: "Map integration and spatial updates.",
    details: "Provides an interactive visual representation of the active transit route. Users can instantly view running buses, designated stops, and overall path progress on a clear digital map interface.",
    colorClass: "text-blue-400 border-blue-500/30",
    iconBg: "bg-blue-600 text-white shadow-lg shadow-blue-900/40",
  },
  "eta-updates": {
    id: "eta-updates",
    title: "ETA & Stop Updates",
    icon: "⏱️",
    context: "Automated arrival alerts and timing estimates via SMS/WhatsApp.",
    details: "Automatically calculates Estimated Time of Arrival (ETA) for upcoming stops and triggers automated alerts to parents or staff (e.g., notifying them a few stops prior to arrival) so students are ready at their pick-up points on time.",
    colorClass: "text-amber-400 border-amber-500/30",
    iconBg: "bg-amber-500 text-slate-950 shadow-lg shadow-amber-900/40",
  },
  "ride-history": {
    id: "ride-history",
    title: "Ride History & Reports",
    icon: "📋",
    context: "Logging historical transit data for administrative audits.",
    details: "Maintains detailed digital archives of past trips, student boarding logs, and transit durations. This data can be exported into reports for administrative reviews, compliance, and safety audits.",
    colorClass: "text-purple-400 border-purple-500/30",
    iconBg: "bg-purple-600 text-white shadow-lg shadow-purple-900/40",
  },
  "realtime-alerts": {
    id: "realtime-alerts",
    title: "Real-Time Alerts",
    icon: "🔔",
    context: "Emergency broadcast and instant push/SMS notifications.",
    details: "An instant notification mechanism that broadcasts critical updates—such as unexpected route deviations, traffic delays, vehicle breakdowns, or successful drop-off confirmations—directly to stakeholders.",
    colorClass: "text-yellow-400 border-yellow-800/50",
    iconBg: "bg-yellow-900/30 border-yellow-800/50 text-yellow-400",
  },
  "bs-calendar": {
    id: "bs-calendar",
    title: "BS Calendar",
    icon: "📅",
    context: "Localized date-time scheduling.",
    details: "Fully integrated Bikram Sambat (BS) calendar system built to synchronize school terms, holidays, and daily operational schedules seamlessly with the local academic calendar of Nepal.",
    colorClass: "text-sky-400 border-sky-800/50",
    iconBg: "bg-sky-900/30 border-sky-800/50 text-sky-400",
  },
  "boarding-checklist": {
    id: "boarding-checklist",
    title: "Boarding Checklist",
    icon: "📋",
    context: "Attendance verification during boarding and de-boarding.",
    details: "A digital manifest system used by drivers or bus assistants to verify and check off students as they successfully board or exit the bus, ensuring that no child is left behind or dropped off at the wrong station.",
    colorClass: "text-green-400 border-green-800/50",
    iconBg: "bg-green-900/30 border-green-800/50 text-green-400",
  },
  "fleet-management": {
    id: "fleet-management",
    title: "Fleet Management",
    icon: "🛡️",
    context: "Centralized command center for multiple buses.",
    details: "An administrative overarching tool used to oversee multiple school buses, assign drivers to specific routes, monitor vehicle health metrics, and manage transport operations across the entire educational institution efficiently.",
    colorClass: "text-purple-400 border-purple-800/50",
    iconBg: "bg-purple-900/30 border-purple-800/50 text-purple-400",
  },
};

export default function Landing() {
  const [, navigate] = useLocation();
  const [selectedFeature, setSelectedFeature] = useState<FeatureDetail | null>(null);

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-y-scroll bg-[#0F172A] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 hover:[&::-webkit-scrollbar-thumb]:bg-amber-500">

      {/* ── Top Nav ─────────────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center">
            <img src="/logo.png" alt="OrbitTrack Logo" className="bus-logo-bounce w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,208,0,0.5)]" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              Orbit<span className="text-[#ffd000]">Track</span>
            </h1>
            <p className="text-[10px] font-medium text-slate-400 -mt-0.5">Nepal's Smart Bus Platform</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/auth")}
          className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-amber-500 hover:text-amber-400 transition-colors"
        >
          Sign In
        </button>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 pb-8 pt-6 text-center">

        {/* Moving bus above headline */}
        <div className="relative w-full max-w-xl mx-auto h-10 mb-2 overflow-hidden rounded-full border border-slate-800/50 bg-slate-900/30 shadow-inner">
          <div className="absolute top-1 text-2xl" style={{ animation: "bus-drive 6s linear infinite" }}>
            🚌💨
          </div>
        </div>

        {/* Headline text (adjusted to smaller size as requested) */}
        <h1 className="mb-3 text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl max-w-xl leading-tight">
          Track Every School Bus.{" "}
          <span className="text-[#ffd000]">Every Stop. In Real Time.</span>
        </h1>
        <p className="mb-6 max-w-md text-xs sm:text-sm text-slate-400 leading-relaxed">
          OrbitTrack connects parents, drivers and school admins with live GPS tracking, OTP boarding, geofencing alerts and smart fleet management — built for Nepal.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row items-center justify-center">
          <button
            onClick={() => navigate("/auth")}
            className="ctaButton signInButton rounded-2xl transition-all hover:scale-105"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate("/register")}
            className="ctaButton getStartedButton rounded-2xl transition-all hover:scale-105"
          >
            Get Started Free
          </button>
        </div>
      </main>

      {/* ── Main Features (3 portal cards) ──────────────────────────── */}
      <section className="relative z-10 border-t border-slate-800 bg-slate-900/60 backdrop-blur px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <h3 className="text-center text-xl font-black text-white">
            Everything Your School Needs
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Live GPS Tracking */}
            <div 
              onClick={() => setSelectedFeature(FEATURE_DETAILS["live-gps"])}
              className="rounded-2xl border border-blue-800/60 bg-blue-950/40 p-5 hover:border-blue-500/60 transition-all cursor-pointer hover:bg-blue-950/60 active:scale-[0.98]"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-600/40 text-2xl">
                🛰️
              </div>
              <h4 className="text-sm font-black text-blue-300 uppercase tracking-wide mb-1">Live GPS Tracking</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Monitor bus location &amp; route in real time on OpenStreetMap.</p>
            </div>

            {/* Parent Portal */}
            <div 
              onClick={() => setSelectedFeature(FEATURE_DETAILS["parent-portal"])}
              className="rounded-2xl border border-green-800/60 bg-green-950/40 p-5 hover:border-green-500/60 transition-all cursor-pointer hover:bg-green-950/60 active:scale-[0.98]"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-600/20 border border-green-600/40 text-2xl">
                👨‍👩‍👧
              </div>
              <h4 className="text-sm font-black text-green-300 uppercase tracking-wide mb-1">Parent Portal</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Ensure child safety &amp; convenience with live tracking and alerts.</p>
            </div>

            {/* Driver Dashboard */}
            <div 
              onClick={() => setSelectedFeature(FEATURE_DETAILS["driver-dashboard"])}
              className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-5 hover:border-amber-500/60 transition-all cursor-pointer hover:bg-amber-950/50 active:scale-[0.98]"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600/20 border border-amber-600/40 text-2xl">
                🚍
              </div>
              <h4 className="text-sm font-black text-amber-300 uppercase tracking-wide mb-1">Driver Dashboard</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Easy navigation &amp; updates for drivers, station by station.</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800" />

          {/* Sub-features */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* View Bus Location on Map */}
            <div 
              onClick={() => setSelectedFeature(FEATURE_DETAILS["bus-location"])}
              className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 hover:border-blue-500/40 transition-all cursor-pointer hover:bg-slate-800 active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl shadow-lg shadow-blue-900/40 animate-pulse-slow">
                🗺️
              </div>
              <div>
                <p className="text-sm font-bold text-white">Bus Location on Map</p>
                <p className="text-xs text-slate-400 mt-0.5">View live route &amp; stops</p>
              </div>
            </div>

            {/* ETA & Stop Updates */}
            <div 
              onClick={() => setSelectedFeature(FEATURE_DETAILS["eta-updates"])}
              className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 hover:border-amber-500/40 transition-all cursor-pointer hover:bg-slate-800 active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-xl shadow-lg shadow-amber-900/40">
                ⏱️
              </div>
              <div>
                <p className="text-sm font-bold text-white">ETA &amp; Stop Updates</p>
                <p className="text-xs text-slate-400 mt-0.5">Alerted 5 stops before arrival</p>
              </div>
            </div>

            {/* Ride History */}
            <div 
              onClick={() => setSelectedFeature(FEATURE_DETAILS["ride-history"])}
              className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 hover:border-purple-500/40 transition-all cursor-pointer hover:bg-slate-800 active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-xl shadow-lg shadow-purple-900/40">
                📋
              </div>
              <div>
                <p className="text-sm font-bold text-white">Ride History &amp; Reports</p>
                <p className="text-xs text-slate-400 mt-0.5">Full boarding &amp; trip records</p>
              </div>
            </div>
          </div>

          {/* Additional feature strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: "realtime-alerts",    icon: "🔔", label: "Real-Time Alerts",    color: "text-yellow-400", bg: "bg-yellow-900/30 border-yellow-800/50" },
              { key: "bs-calendar",         icon: "📅", label: "BS Calendar",         color: "text-sky-400",    bg: "bg-sky-900/30 border-sky-800/50" },
              { key: "boarding-checklist",  icon: "📋", label: "Boarding Checklist",  color: "text-green-400",  bg: "bg-green-900/30 border-green-800/50" },
              { key: "fleet-management",    icon: "🛡️", label: "Fleet Management",    color: "text-purple-400", bg: "bg-purple-900/30 border-purple-800/50" },
            ].map((f) => (
              <div
                key={f.label}
                onClick={() => setSelectedFeature(FEATURE_DETAILS[f.key])}
                className={`rounded-xl border ${f.bg} p-3 flex flex-col items-center gap-2 text-center cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all`}
              >
                <span className="text-xl">{f.icon}</span>
                <span className={`text-xs font-semibold ${f.color}`}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Peace of Mind Banner ─────────────────────────────────────── */}
      <div className="relative z-10 overflow-hidden">
        <div className="bg-gradient-to-r from-[#1a3a6b] via-[#1e4d8c] to-[#1a3a6b] px-6 py-8 text-center">
          <div className="mb-3 flex justify-center gap-4 text-3xl">
            <span>🚌</span><span>👨‍👩‍👧</span><span>📍</span>
          </div>
          <p className="text-2xl font-black italic text-white drop-shadow">
            "Peace of Mind for Parents &amp; Schools"
          </p>
          <p className="mt-2 text-sm text-blue-200">
            Real-time safety, every school day.
          </p>
          <button
            onClick={() => navigate("/register")}
            className="mt-5 rounded-2xl bg-[#ffd000] px-8 py-3 text-sm font-black text-slate-900 hover:bg-yellow-300 transition-all hover:scale-105 shadow-lg shadow-black/30"
          >
            Start Free Today →
          </button>
        </div>
      </div>

      {/* ── Animated road decoration ────────────────────────────────── */}
      <div className="relative overflow-hidden pointer-events-none h-8 bg-[#0F172A]">
        <div className="road-line absolute inset-x-0 top-1/2 h-0.5 bg-slate-700/60" />
        <div className="absolute top-1 bus-drive text-2xl">🚌</div>
        <div className="absolute top-3 bus-drive2 text-base opacity-30">🚗</div>
      </div>

      {/* ── Advertise with Us (bottom) ───────────────────────────────── */}
      <div className="relative z-10 border-t border-slate-800 bg-slate-900/80 px-4 py-5 text-center">
        <button
          onClick={() => navigate("/advertise")}
          className="inline-flex items-center gap-2.5 rounded-2xl border border-amber-700/40 bg-amber-500/10 px-6 py-3 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/60 transition-colors"
        >
          📢
          <span>Advertise with Us</span>
        </button>
        <p className="mt-2 text-xs text-slate-600">Reach thousands of parents &amp; schools across Nepal</p>
      </div>

      {/* ── Floating Sticky Contact Buttons ──────────────────── */}
      <div className="fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4">
        {/* WhatsApp Button */}
        <a
          href="https://wa.me/9779747468885"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-b from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white p-2.5 shadow-2xl shadow-emerald-950/80 border border-emerald-300/40 transition-all hover:scale-110 active:scale-95 group backdrop-blur-md"
          title="Chat on WhatsApp (Get More Info): 9747468885"
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300"></span>
            </span>
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white drop-shadow" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.858L.057 23.882a.5.5 0 0 0 .61.61l6.098-1.464A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.886 9.886 0 0 1-5.031-1.37l-.361-.214-3.741.899.934-3.672-.235-.376A9.865 9.865 0 0 1 2.1 12C2.1 6.534 6.534 2.1 12 2.1c5.466 0 9.9 4.434 9.9 9.9 0 5.466-4.434 9.9-9.9 9.9z"/>
            </svg>
          </div>
          <span className="text-[10px] font-bold tracking-tight text-white drop-shadow whitespace-nowrap">Get more</span>
        </a>

        {/* AI Call Me Button */}
        <button
          onClick={() => {
            if (window.confirm("Call charge per Minute 1.20 pisa NTC want to call us?")) {
              window.location.href = "tel:142412602702428";
            }
          }}
          className="flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white p-2.5 shadow-2xl shadow-blue-950/80 border border-blue-300/40 transition-all hover:scale-110 active:scale-95 group backdrop-blur-md cursor-pointer"
          title="Call Us"
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-300"></span>
            </span>
            <Bot className="h-7 w-7 drop-shadow" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] font-bold tracking-tight text-white drop-shadow whitespace-nowrap">Call me</span>
        </button>
      </div>

      <AppFooter variant="dark" />

      {/* ── Feature Detail Modal ─────────────────────────────────────── */}
      {selectedFeature && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 py-6 transition-all duration-300 animate-fadeIn"
          onClick={() => setSelectedFeature(null)}
        >
          <div 
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-b from-slate-800 to-slate-900 p-6 sm:p-8 shadow-2xl transition-all duration-300 transform scale-100 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button top-right */}
            <button
              onClick={() => setSelectedFeature(null)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-700/40 text-slate-400 hover:bg-slate-700/80 hover:text-white transition-colors text-sm font-bold"
            >
              ✕
            </button>

            {/* Header info */}
            <div className="flex items-center gap-4 mb-6">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-3xl ${selectedFeature.iconBg}`}>
                {selectedFeature.icon}
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-white uppercase sm:text-xl">
                  {selectedFeature.title}
                </h3>
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">OrbitTrack Feature</p>
              </div>
            </div>

            {/* Content Body */}
            <div className="space-y-4 text-left">
              {/* Context Block */}
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Integration Context</h4>
                <p className="text-xs sm:text-sm text-amber-300 font-medium leading-relaxed">
                  {selectedFeature.context}
                </p>
              </div>

              {/* Details Block */}
              <div className="p-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Description &amp; Details</h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {selectedFeature.details}
                </p>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-700/50 pt-5">
              <button
                onClick={() => setSelectedFeature(null)}
                className="rounded-xl bg-slate-700/50 px-5 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                Close Window
              </button>
              <button
                onClick={() => {
                  setSelectedFeature(null);
                  navigate("/auth");
                }}
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-900 hover:bg-amber-400 transition-all shadow-md shadow-black/20"
              >
                Try OrbitTrack Now →
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-slideUp {
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
