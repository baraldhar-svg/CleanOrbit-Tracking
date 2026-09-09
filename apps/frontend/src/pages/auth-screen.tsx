import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth, type AuthUser } from "@/hooks/use-auth";
import { startAuthentication } from "@simplewebauthn/browser";
import BiometricSetupModal from "@/components/BiometricSetupModal";
import { LiquidButton } from "@/components/ui/liquid-button";
import {
  Bus,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Fingerprint
} from "lucide-react";

type Step = "phone" | "schoolCode" | "otp";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    if (!res.ok) throw new Error(`Server error (${res.status}). Please try again shortly.`);
    throw new Error("Invalid response from server.");
  }
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

type BiometricAutoState = "idle" | "waiting" | "scanning" | "failed";
const BIOMETRIC_KEY = "orbittrack_biometric";

function isBiometricSupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

interface FoundUser {
  name: string;
  role: string;
  requiresSchoolCode: boolean;
  demoCode?: string;
  hasEmail?: boolean;
  maskedEmail?: string;
  method?: "email" | "sms";
}

const ROLE_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  superadmin: { label: "Super Admin", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: "⚡" },
  admin:      { label: "Organization Admin", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: "🏫" },
  teacher:    { label: "Class Teacher", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: "👩‍🏫" },
  driver:     { label: "Fleet Driver", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: "🚍" },
  staff:      { label: "Staff Member", badge: "bg-teal-500/20 text-teal-300 border-teal-500/30", icon: "👤" },
  student:    { label: "Student / Parent", badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", icon: "🎒" },
  parent:     { label: "Guardian / Parent", badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", icon: "👨‍👩‍👧" },
};

export default function AuthScreen() {
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [bioAutoState, setBioAutoState] = useState<BiometricAutoState>("idle");
  const [bioCredentialId, setBioCredentialId] = useState<string | null>(null);

  const [step, setStep] = useState<Step>(() => {
    try { return (sessionStorage.getItem("auth_step") as Step) || "phone"; } catch { return "phone"; }
  });
  
  const search = useSearch();
  const params = new URLSearchParams(search);
  const paramPhone = params.get("phone");
  
  const [phone, setPhone] = useState(() => {
    try { 
      const raw = paramPhone || sessionStorage.getItem("auth_phone") || "";
      return raw.replace(/^\+?977\s?/, "").replace(/\D/g, "").slice(0, 10);
    } catch { return ""; }
  });

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [schoolCode, setSchoolCode] = useState(() => {
    try { return sessionStorage.getItem("auth_schoolCode") || ""; } catch { return ""; }
  });
  
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const [foundUser, setFoundUser] = useState<FoundUser | null>(() => {
    try {
      const stored = sessionStorage.getItem("auth_foundUser");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    try {
      sessionStorage.setItem("auth_step", step);
      sessionStorage.setItem("auth_phone", phone);
      sessionStorage.setItem("auth_schoolCode", schoolCode);
      if (foundUser) sessionStorage.setItem("auth_foundUser", JSON.stringify(foundUser));
      else sessionStorage.removeItem("auth_foundUser");
    } catch {}
  }, [step, phone, schoolCode, foundUser]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "otp" && countdown > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const triggerBiometricLogin = useCallback(
    async (credentialId: string) => {
      setBioAutoState("scanning");
      try {
        const options = await apiPost("/auth/webauthn/login-options", { credentialId });
        const response = await startAuthentication({ optionsJSON: options });
        const result = await apiPost("/auth/webauthn/login-verify", { response });
        if (result.verified && result.user) {
          login({ ...result.user, tenant: result.user.tenant ?? null }, result.token);
          navigate("/dashboard");
        } else {
          setBioAutoState("failed");
        }
      } catch {
        setBioAutoState("failed");
      }
    },
    [login, navigate],
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const stored = localStorage.getItem(BIOMETRIC_KEY);
      if (stored && isBiometricSupported()) {
        const { credentialId } = JSON.parse(stored) as { phone: string; credentialId: string };
        if (credentialId) {
          setBioCredentialId(credentialId);
          setBioAutoState("waiting");
          timer = setTimeout(() => triggerBiometricLogin(credentialId), 350);
        }
      }
    } catch {}
    return () => { if (timer !== undefined) clearTimeout(timer); };
  }, [triggerBiometricLogin]);

  function finishAuth(user: AuthUser, token?: string) {
    try {
      sessionStorage.removeItem("auth_step");
      sessionStorage.removeItem("auth_phone");
      sessionStorage.removeItem("auth_schoolCode");
      sessionStorage.removeItem("auth_foundUser");
    } catch {}

    login(user, token);
    if (!user.biometricEnabled && isBiometricSupported()) {
      setPendingUser(user);
    } else {
      navigate("/dashboard");
    }
  }

  async function handleSendOtp(customPhone?: string) {
    const rawNumber = customPhone || phone;
    const cleanDigits = rawNumber.replace(/\D/g, "");
    
    if (cleanDigits.length < 10) {
      setErr("Please enter a valid 10-digit Nepal mobile number.");
      return;
    }

    setErr("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const data = await apiPost("/auth/check-phone", { phone: cleanDigits });

      if (data.found === false) {
        navigate(`/register?phone=${encodeURIComponent(cleanDigits)}`);
        return;
      }

      const fu: FoundUser = {
        name: data.user?.name ?? data.name ?? "User",
        role: data.user?.role ?? data.role ?? "student",
        requiresSchoolCode: data.requiresSchoolCode ?? false,
        demoCode: data.demoCode,
        hasEmail: data.hasEmail ?? false,
        maskedEmail: data.maskedEmail,
        method: data.method ?? (data.hasEmail ? "email" : "sms"),
      };

      setFoundUser(fu);
      setSchoolCode("");
      setCountdown(60);
      setCanResend(false);

      if (fu.requiresSchoolCode) {
        setStep("schoolCode");
      } else {
        setStep("otp");
        if (fu.method === "email" || fu.hasEmail) {
          setSuccessMsg(`Verification code sent to email (${fu.maskedEmail || "registered email"})`);
        } else {
          setSuccessMsg(`Verification code sent to mobile +977 ${cleanDigits}`);
        }
        setTimeout(() => otpInputsRef.current[0]?.focus(), 150);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not verify phone number";
      if (msg.toLowerCase().includes("not registered") || msg.toLowerCase().includes("not found")) {
        navigate(`/register?phone=${encodeURIComponent(cleanDigits)}`);
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!canResend || loading) return;
    setErr("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await apiPost("/auth/send-otp", { phone: phone.replace(/\D/g, "") });
      setCountdown(60);
      setCanResend(false);
      if (res?.method === "email" || res?.maskedEmail) {
        setSuccessMsg(`A fresh 6-digit OTP has been sent to your email (${res.maskedEmail || foundUser?.maskedEmail || ""}).`);
      } else {
        setSuccessMsg("A fresh 6-digit OTP has been sent to your mobile via SMS.");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(fullCode?: string) {
    const code = fullCode || otp.join("");
    if (code.length < 6) {
      setErr("Please enter the complete 6-digit verification code.");
      return;
    }

    if (foundUser?.requiresSchoolCode && !schoolCode.trim()) {
      setErr("Please enter your organization / school code.");
      return;
    }

    setErr("");
    setLoading(true);

    try {
      const cleanDigits = phone.replace(/\D/g, "");
      const data = await apiPost("/auth/verify-otp", {
        phone: cleanDigits,
        code: code.trim(),
        ...(foundUser?.requiresSchoolCode ? { schoolCode: schoolCode.trim() } : {}),
      });

      if (data.sessionId) {
        try { localStorage.setItem("orbittrack_session_id", data.sessionId); } catch {}
      }

      if (data.user) {
        finishAuth({ ...data.user, tenant: data.user.tenant ?? null }, data.token as string | undefined);
      } else {
        setErr("Verification failed. Please try again.");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  }

  const handleOtpChange = (index: number, val: string) => {
    const sanitized = val.replace(/\D/g, "");
    if (!sanitized) {
      const nextOtp = [...otp];
      nextOtp[index] = "";
      setOtp(nextOtp);
      return;
    }

    if (sanitized.length > 1) {
      const digits = sanitized.slice(0, 6).split("");
      const nextOtp = [...otp];
      digits.forEach((d, i) => { if (i < 6) nextOtp[i] = d; });
      setOtp(nextOtp);
      const targetIdx = Math.min(digits.length, 5);
      otpInputsRef.current[targetIdx]?.focus();
      if (digits.length === 6) handleVerifyOtp(digits.join(""));
      return;
    }

    const nextOtp = [...otp];
    nextOtp[index] = sanitized;
    setOtp(nextOtp);

    if (index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    } else if (index === 5 && nextOtp.every((d) => d !== "")) {
      handleVerifyOtp(nextOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === "Enter" && otp.every((d) => d !== "")) {
      handleVerifyOtp();
    }
  };

  const resetToPhone = () => {
    setStep("phone");
    setFoundUser(null);
    setOtp(["", "", "", "", "", ""]);
    setSchoolCode("");
    setErr("");
    setSuccessMsg("");
  };

  const userRoleMeta = foundUser?.role ? ROLE_CONFIG[foundUser.role] || ROLE_CONFIG.student : ROLE_CONFIG.student;

  return (
    <>
      {bioAutoState !== "idle" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-2xl px-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-white/20 p-8 text-center shadow-2xl">
            {bioAutoState === "failed" ? (
              <>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30 text-red-400">
                  <AlertTriangle size={36} />
                </div>
                <h2 className="text-xl font-black text-white mb-1">Scan Failed</h2>
                <p className="text-xs text-slate-400 mb-6">Scan not recognized or cancelled.</p>
                <div className="space-y-2.5">
                  <LiquidButton onClick={() => bioCredentialId && triggerBiometricLogin(bioCredentialId)} variant="primary" className="w-full justify-center">Try Again</LiquidButton>
                  <button onClick={() => setBioAutoState("idle")} className="w-full text-xs font-semibold text-slate-400 hover:text-white py-2">Use OTP instead →</button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/15 ring-4 ring-amber-400/30 animate-pulse">
                  <Fingerprint size={48} className="text-amber-400" />
                </div>
                <h2 className="text-xl font-black text-white mb-1">Biometric Verification</h2>
                <button onClick={() => setBioAutoState("idle")} className="text-xs font-semibold text-slate-400 hover:text-white py-1.5">Switch to Phone OTP →</button>
              </>
            )}
          </div>
        </div>
      )}

      {pendingUser && (
        <BiometricSetupModal
          user={pendingUser}
          onComplete={() => { setPendingUser(null); navigate("/dashboard"); }}
        />
      )}

      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-950 px-4 py-8">
        <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/10 p-6 sm:p-8 shadow-2xl relative">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => (step === "phone" ? navigate("/") : resetToPhone())} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer">
              <ArrowLeft size={14} /> <span>{step === "phone" ? "Back to Home" : "Change Number"}</span>
            </button>
          </div>

          <div className="mb-6 flex flex-col items-center text-center gap-2.5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg ring-2 ring-white/60">
              <Bus size={32} className="text-slate-950" />
            </div>
            <h1 className="text-2xl font-black text-white">Orbit<span className="text-amber-500">Track</span></h1>
          </div>

          {step === "phone" && (
            <div className="space-y-5">
              <div className="text-center"><h2 className="text-lg font-black text-white">Enter Mobile Number</h2></div>
              <div className="flex items-center rounded-2xl border-2 border-white/10 bg-slate-800 focus-within:border-amber-500 transition-all overflow-hidden">
                <div className="px-3.5 py-3 border-r border-slate-700 bg-slate-800"><span className="text-xs font-black text-white">+977</span></div>
                <input type="tel" placeholder="98XXXXXXXX" value={phone} maxLength={10} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className="flex-1 px-3.5 py-3 bg-transparent text-sm font-bold text-white outline-none" />
              </div>
              {err && <div className="p-3 bg-red-900/20 text-red-400 text-xs rounded-2xl border border-red-900">{err}</div>}
              <LiquidButton onClick={() => handleSendOtp()} disabled={phone.length < 10 || loading} variant="primary" className="w-full justify-center">Send OTP Code →</LiquidButton>
            </div>
          )}

          {step === "schoolCode" && foundUser && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-3.5 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 font-black text-base border border-amber-500/30">
                  {foundUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white truncate">
                    Welcome, {foundUser.name}! 👋
                  </p>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border mt-0.5 ${userRoleMeta.badge}`}>
                    <span>{userRoleMeta.icon}</span> {userRoleMeta.label}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                  Organization / School Code
                </label>
                <div className="flex items-center rounded-2xl border-2 border-white/10 bg-slate-800 px-3.5 py-3 focus-within:border-amber-500 transition-all">
                  <Building2 size={16} className="text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="e.g. APEX-1234"
                    value={schoolCode}
                    autoFocus
                    onChange={(e) => {
                      setSchoolCode(e.target.value.toUpperCase());
                      setErr("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && schoolCode.trim() && !loading) {
                        setStep("otp");
                        setTimeout(() => otpInputsRef.current[0]?.focus(), 150);
                      }
                    }}
                    className="flex-1 bg-transparent text-sm font-black font-mono tracking-wider text-white placeholder:text-slate-600 outline-none uppercase"
                  />
                </div>
              </div>

              {err && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <p className="font-medium">{err}</p>
                </div>
              )}

              <LiquidButton
                onClick={() => {
                  if (!schoolCode.trim()) {
                    setErr("Please enter your organization or school code.");
                    return;
                  }
                  setStep("otp");
                  setTimeout(() => otpInputsRef.current[0]?.focus(), 150);
                }}
                disabled={!schoolCode.trim() || loading}
                variant="primary"
                className="w-full justify-center py-3.5 text-sm font-black shadow-lg"
              >
                Proceed to Verification →
              </LiquidButton>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-5">
              {foundUser && (
                <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 font-black text-sm border border-amber-500/30">
                      {foundUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate">
                        {foundUser.name}
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${userRoleMeta.badge}`}>
                        {userRoleMeta.label}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 shrink-0">
                    +977 {phone}
                  </span>
                </div>
              )}

              <div className="text-center">
                <h2 className="text-lg font-black text-white">
                  Enter 6-Digit OTP Code
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {foundUser?.method === "email" || foundUser?.hasEmail ? (
                    <>
                      Sent to registered email{" "}
                      <strong className="text-amber-500 font-mono">
                        {foundUser?.maskedEmail || "your email"}
                      </strong>
                    </>
                  ) : (
                    <>
                      Sent to mobile <strong className="text-amber-500 font-mono">+977 {phone}</strong>
                    </>
                  )}
                </p>
              </div>

              {/* 6 High-Gloss Pin Boxes */}
              <div className="flex justify-center items-center gap-2 sm:gap-2.5 my-3">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { otpInputsRef.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text");
                      handleOtpChange(idx, pasted);
                    }}
                    className={`h-12 w-11 sm:h-14 sm:w-12 rounded-2xl text-center text-xl font-black font-mono outline-none transition-all duration-200 border-2 shadow-sm ${
                      digit
                        ? "border-amber-500 bg-amber-500/15 text-amber-400 shadow-md shadow-amber-500/20 scale-105"
                        : "border-white/15 bg-slate-800/80 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                    }`}
                  />
                ))}
              </div>

              {successMsg && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {err && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <p className="font-medium">{err}</p>
                </div>
              )}

              <LiquidButton
                onClick={() => handleVerifyOtp()}
                disabled={otp.some((d) => d === "") || loading}
                variant="primary"
                className="w-full justify-center py-3.5 text-sm font-black shadow-lg"
                icon={<CheckCircle2 size={16} />}
              >
                {loading ? "Verifying Credentials…" : "Verify & Sign In →"}
              </LiquidButton>

              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <button
                  onClick={resetToPhone}
                  className="font-bold text-slate-400 hover:text-amber-400 transition-colors"
                >
                  ← Edit Number
                </button>

                {canResend ? (
                  <button
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="font-black text-amber-500 hover:text-amber-400 underline transition-colors flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    Resend Code
                  </button>
                ) : (
                  <span className="font-mono font-bold text-slate-400">
                    Resend in <span className="text-amber-500">{countdown}s</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Security notice */}
        <div className="mt-4 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-center">
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-amber-400">OrbitTrack</span> — Multi-Tenant Multi-Role AI Calling &amp; Bus System
          </p>
        </div>
      </div>
    </>
  );
}
