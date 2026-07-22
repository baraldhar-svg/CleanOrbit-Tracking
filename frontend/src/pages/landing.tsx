import { useLocation } from "wouter";
import AppFooter from "@/components/app-footer";

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-y-scroll bg-[#0F172A] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 hover:[&::-webkit-scrollbar-thumb]:bg-amber-500">

      {/* ── Top Nav ─────────────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center">
            <div className="bus-logo-bounce text-3xl">🚌</div>
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
      <main className="relative z-10 flex flex-col items-center justify-center px-4 pb-10 pt-8 text-center">
        <div className="mb-6 flex items-center justify-center">
          <div className="relative">
            <img
              src="/hero_bus_image.png"
              alt="Hero School Bus"
              className="heroBus h-48 sm:h-56 md:h-64 w-auto max-w-full object-contain rounded-2xl drop-shadow-[0_20px_50px_rgba(255,208,0,0.25)] transition-transform hover:scale-105"
            />
            <div className="absolute -right-3 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-xs animate-pulse shadow-lg shadow-green-500/50">
              📍
            </div>
          </div>
        </div>

        <h1 className="mb-4 text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl max-w-3xl leading-tight">
          Track Every School Bus.{" "}
          <span className="text-[#ffd000]">Every Stop. In Real Time.</span>
        </h1>
        <p className="mb-8 max-w-md text-base text-slate-400 leading-relaxed">
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
            <div className="rounded-2xl border border-blue-800/60 bg-blue-950/40 p-5 hover:border-blue-500/60 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-600/40 text-2xl">
                🛰️
              </div>
              <h4 className="text-sm font-black text-blue-300 uppercase tracking-wide mb-1">Live GPS Tracking</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Monitor bus location &amp; route in real time on OpenStreetMap.</p>
            </div>

            {/* Parent Portal */}
            <div className="rounded-2xl border border-green-800/60 bg-green-950/40 p-5 hover:border-green-500/60 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-600/20 border border-green-600/40 text-2xl">
                👨‍👩‍👧
              </div>
              <h4 className="text-sm font-black text-green-300 uppercase tracking-wide mb-1">Parent Portal</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Ensure child safety &amp; convenience with live tracking and alerts.</p>
            </div>

            {/* Driver Dashboard */}
            <div className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-5 hover:border-amber-500/60 transition-colors">
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
            <div className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 hover:border-blue-500/40 transition-colors">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl shadow-lg shadow-blue-900/40">
                🗺️
              </div>
              <div>
                <p className="text-sm font-bold text-white">Bus Location on Map</p>
                <p className="text-xs text-slate-400 mt-0.5">View live route &amp; stops</p>
              </div>
            </div>

            {/* ETA & Stop Updates */}
            <div className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 hover:border-amber-500/40 transition-colors">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-xl shadow-lg shadow-amber-900/40">
                ⏱️
              </div>
              <div>
                <p className="text-sm font-bold text-white">ETA &amp; Stop Updates</p>
                <p className="text-xs text-slate-400 mt-0.5">Alerted 5 stops before arrival</p>
              </div>
            </div>

            {/* Ride History */}
            <div className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 hover:border-purple-500/40 transition-colors">
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
              { icon: "🔔", label: "Real-Time Alerts",    color: "text-yellow-400", bg: "bg-yellow-900/30 border-yellow-800/50" },
              { icon: "📅", label: "BS Calendar",         color: "text-sky-400",    bg: "bg-sky-900/30 border-sky-800/50" },
              { icon: "📋", label: "Boarding Checklist",  color: "text-green-400",  bg: "bg-green-900/30 border-green-800/50" },
              { icon: "🛡️", label: "Fleet Management",    color: "text-purple-400", bg: "bg-purple-900/30 border-purple-800/50" },
            ].map((f) => (
              <div
                key={f.label}
                className={`rounded-xl border ${f.bg} p-3 flex flex-col items-center gap-2 text-center`}
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

      <AppFooter variant="dark" />
    </div>
  );
}
