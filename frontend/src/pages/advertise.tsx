import { useState } from "react";
import { useLocation } from "wouter";
import AppFooter from "@/components/app-footer";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdvertisePage() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    advertiserName: "",
    contactPerson: "",
    phone: "",
    email: "",
    adTitle: "",
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
    if (!form.advertiserName || !form.phone || !form.adTitle || !form.imageUrl) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/ad-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, costNpr }),
      });
      const data = await res.json() as { id?: number; costNpr?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSubmitted({ id: data.id!, costNpr: data.costNpr! });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-[100dvh] bg-[#0F172A] flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-slate-300 hover:text-amber-400 transition-colors text-sm font-semibold">
            ← Back
          </button>
          <div className="text-xl font-black text-white">Orbit<span className="text-[#ffd000]">Track</span></div>
        </header>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex items-center justify-center">
              <div className="h-20 w-20 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-4xl">✅</div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white mb-2">Ad Request Submitted!</h2>
              <p className="text-slate-400 text-sm">Your request has been received and is pending SuperAdmin review. We'll contact you via phone/email once approved.</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 text-left space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Reference ID</span>
                <span className="font-mono font-bold text-amber-400">#{submitted.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Days Requested</span>
                <span className="font-semibold text-slate-200">{form.daysRequested} days</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-700 pt-3">
                <span className="text-sm font-semibold text-slate-300">Total Cost</span>
                <span className="text-lg font-black text-amber-400">NPR {submitted.costNpr.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">Rate: NPR 500/day · Payment collected after approval</p>
            <button onClick={() => navigate("/")} className="w-full rounded-2xl bg-amber-500 py-3 font-bold text-slate-900 hover:bg-amber-400 transition-colors">
              Back to Home
            </button>
          </div>
        </div>
        <AppFooter variant="dark" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0F172A] flex flex-col [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 z-20 bg-[#0F172A]/95 backdrop-blur">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-slate-300 hover:text-amber-400 transition-colors text-sm font-semibold">
          ← Back
        </button>
        <div className="text-xl font-black text-white">Orbit<span className="text-[#ffd000]">Track</span></div>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="text-center px-4 py-10 border-b border-slate-800">
          <div className="mb-4 flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl">📢</div>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Advertise on OrbitTrack</h1>
          <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
            Reach thousands of parents, students and school admins across Nepal. Your banner appears on all user dashboards.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-5 py-2">
            <span className="text-2xl font-black text-amber-400">NPR 500</span>
            <span className="text-slate-400 text-sm">/ day</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {/* Advertiser info */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5 space-y-4">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Your Details</p>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Company / School Name <span className="text-red-400">*</span>
              </label>
              <input
                value={form.advertiserName}
                onChange={(e) => set("advertiserName", e.target.value)}
                placeholder="e.g. Sunrise Academy"
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Contact Person</label>
                <input
                  value={form.contactPerson}
                  onChange={(e) => set("contactPerson", e.target.value)}
                  placeholder="Ram Bahadur"
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Phone <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="98XXXXXXXX"
                  type="tel"
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">Email (optional)</label>
              <input
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="contact@school.edu.np"
                type="email"
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Ad content */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5 space-y-4">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Ad Content</p>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Ad Title <span className="text-red-400">*</span>
              </label>
              <input
                value={form.adTitle}
                onChange={(e) => set("adTitle", e.target.value)}
                placeholder="Sunrise Academy — Admissions Open 2081"
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">Subtitle / Tagline</label>
              <input
                value={form.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="Nepal's Premier School · Kathmandu"
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Banner Image <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  value={form.imageUrl}
                  onChange={(e) => set("imageUrl", e.target.value)}
                  placeholder="https://... or upload →"
                  className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-500"
                />
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-600 transition-colors">
                  📤 Upload
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
              <div className="relative h-28 w-full overflow-hidden rounded-xl border border-slate-700">
                <img
                  src={form.imageUrl}
                  alt="preview"
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/600x96/1e293b/64748b?text=Invalid+Image+URL"; }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center px-4">
                  <div>
                    <p className="text-sm font-bold text-white">{form.adTitle || "Your Ad Title"}</p>
                    {form.subtitle && <p className="text-xs text-slate-300">{form.subtitle}</p>}
                  </div>
                </div>
                <span className="absolute top-2 right-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-slate-900">PREVIEW</span>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">Website / Link (optional)</label>
              <input
                value={form.targetUrl}
                onChange={(e) => set("targetUrl", e.target.value)}
                placeholder="https://yourschool.edu.np"
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Duration & cost */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5 space-y-4">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Duration & Cost</p>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-300">Number of Days</label>
                <span className="text-xs text-slate-400">{form.daysRequested} day{form.daysRequested !== 1 ? "s" : ""}</span>
              </div>
              <input
                type="range"
                min={1}
                max={90}
                value={form.daysRequested}
                onChange={(e) => set("daysRequested", Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>1 day</span>
                <span>30 days</span>
                <span>90 days</span>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Estimated Total</p>
                <p className="text-xs text-slate-500 mt-0.5">NPR 500 × {form.daysRequested} days</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-amber-400">NPR {costNpr.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">collected after approval</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting || !form.advertiserName || !form.phone || !form.adTitle || !form.imageUrl}
            className="w-full rounded-2xl bg-amber-500 py-4 text-base font-black text-slate-900 hover:bg-amber-400 disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-amber-500/20"
          >
            {submitting ? "Submitting…" : `Submit Ad Request — NPR ${costNpr.toLocaleString()}`}
          </button>
          <p className="text-center text-xs text-slate-600">No payment now · Admin reviews and contacts you · NPR 500/day</p>
        </form>
      </div>

      <AppFooter variant="dark" />
    </div>
  );
}
