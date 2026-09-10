import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Building2,
} from "lucide-react";

type Step = "new" | "admin_form" | "admin_pending";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface FieldDetail {
  field: string;
  message: string;
}

class ApiError extends Error {
  details?: FieldDetail[];
  constructor(message: string, details?: FieldDetail[]) {
    super(message);
    this.details = details;
  }
}

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
    if (!res.ok) throw new ApiError(`Server error (${res.status}). Please try again shortly.`);
    throw new ApiError("Invalid response from server.");
  }
  if (!res.ok) throw new ApiError(data.error ?? "Request failed", data.details);
  return data;
}

const ROLE_LABELS: Record<string, string> = {
  student: "Student / Parent",
  staff: "Staff / Teacher",
  driver: "Driver",
  admin: "School Admin",
};

const CLASS_OPTIONS = [
  "Play Group", "Nursery", "LKG", "UKG",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
  "Others",
];

const FACULTY_OPTIONS = [
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

const FACULTY_CLASSES = new Set(["11", "12", "Others"]);

export default function RegisterScreen() {
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const search = useSearch();
  const params = new URLSearchParams(search);
  const paramPhone = (params.get("phone") ?? "").replace(/\D/g, "").slice(0, 10);

  const [step, setStep] = useState<Step>("new");
  const [phone, setPhone] = useState(paramPhone);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Mobile OTP verification state
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // User registration state
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [regSchoolCode, setRegSchoolCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Student-specific registration state
  const [className, setClassName] = useState("");
  const [customClass, setCustomClass] = useState("");
  const [section, setSection] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [faculty, setFaculty] = useState("");
  const [customFaculty, setCustomFaculty] = useState("");

  // Driver & Staff registration state
  const [gender, setGender] = useState("male");
  const [designation, setDesignation] = useState("");
  const [customDesignation, setCustomDesignation] = useState("");
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  // Admin registration state
  const [adminSchoolName, setAdminSchoolName] = useState("");
  const [adminContactName, setAdminContactName] = useState("");
  const [adminLandline, setAdminLandline] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPosition, setAdminPosition] = useState("");
  const [adminMobile, setAdminMobile] = useState(paramPhone);
  const [adminName, setAdminName] = useState("");
  const [adminFieldErrors, setAdminFieldErrors] = useState<Record<string, string>>({});

  // Geo-detection state — null = detecting, true = Nepal, false = international
  const [isNepal, setIsNepal] = useState<boolean | null>(null);

  useEffect(() => {
    if (paramPhone && !phone) {
      setPhone(paramPhone);
      setAdminMobile(paramPhone);
    }
  }, [paramPhone, phone]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpSent && countdown > 0) {
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
  }, [otpSent, countdown]);

  useEffect(() => {
    if (step !== "admin_pending") return;
    setIsNepal(null);
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((d: { country_code?: string }) => setIsNepal(d.country_code === "NP"))
      .catch(() => {
        setIsNepal(/^9[6-8]/.test(adminMobile));
      });
  }, [step, adminMobile]);

  // Handle OTP SMS sending
  async function handleSendMobileOtp() {
    const num = phone.replace(/\D/g, "");
    if (num.length < 10) {
      setOtpError("Please enter a valid 10-digit Nepal mobile number.");
      return;
    }

    setOtpSending(true);
    setOtpError("");
    setOtpSuccess("");
    setErr("");

    try {
      // Check if number already registered
      const check = await apiPost("/auth/check-phone", { phone: num });
      if (check.found === true && check.user) {
        setOtpError("This number already has an account. Please Sign In.");
        setOtpSending(false);
        return;
      }

      await apiPost("/auth/send-otp", { phone: num });
      setOtpSent(true);
      setCountdown(60);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
      setOtpSuccess(`6-digit OTP sent via SMS to +977 ${num}`);
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : "Failed to send SMS OTP. Please try again.");
    } finally {
      setOtpSending(false);
    }
  }

  // Handle OTP Inputs
  function handleOtpKey(i: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length === 0) return;
    e.preventDefault();
    setOtp(digits.concat(Array(6 - digits.length).fill("")));
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  // Verify OTP
  async function handleVerifyMobileOtp() {
    const num = phone.replace(/\D/g, "");
    const code = otp.join("");
    if (code.length < 6) {
      setOtpError("Please enter all 6 digits of the OTP code.");
      return;
    }

    setOtpVerifying(true);
    setOtpError("");
    try {
      await apiPost("/auth/verify-otp-register", {
        phone: num,
        code,
      });
      setIsPhoneVerified(true);
      setOtpSent(false);
      setOtpSuccess("Mobile verified successfully! ✓");
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : "Invalid or expired OTP code.");
    } finally {
      setOtpVerifying(false);
    }
  }

  // ── Step 2b: Register new user ────────────────────────────────────────
  const handleAdminRegister = useCallback(async () => {
    if (!adminSchoolName.trim()) { setErr("School name is required"); return; }
    if (!adminContactName.trim()) { setErr("Contact name is required"); return; }
    if (!adminLandline.trim()) { setErr("Landline number is required"); return; }
    if (!adminEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) { setErr("Enter a valid school email"); return; }
    if (!adminName.trim()) { setErr("Your name is required"); return; }
    if (!adminPosition.trim()) { setErr("Position/designation is required"); return; }
    if (!adminMobile.trim() || adminMobile.length < 10) { setErr("Enter your 10-digit mobile number"); return; }
    setErr(""); setAdminFieldErrors({}); setLoading(true);
    try {
      await apiPost("/auth/register-admin", {
        schoolName: adminSchoolName.trim(),
        contactName: adminContactName.trim(),
        landline: adminLandline.trim(),
        email: adminEmail.trim(),
        adminName: adminName.trim(),
        position: adminPosition.trim(),
        mobile: adminMobile.trim(),
      });
      setStep("admin_pending");
    } catch (e: unknown) {
      if (e instanceof ApiError && e.details && e.details.length > 0) {
        setAdminFieldErrors(
          Object.fromEntries(e.details.map((d) => [d.field, d.message]))
        );
        setErr(e.message);
      } else {
        setErr(e instanceof Error ? e.message : "Registration failed");
      }
    } finally { setLoading(false); }
  }, [adminSchoolName, adminContactName, adminLandline, adminEmail, adminName, adminPosition, adminMobile]);

  const handleRegister = useCallback(async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setErr("Enter your 10-digit mobile number.");
      return;
    }
    if (!isPhoneVerified) {
      setErr("Please verify your mobile number with OTP first.");
      return;
    }
    if (!name.trim()) { setErr("Name is required"); return; }
    if (role !== "admin" && !regSchoolCode.trim()) { setErr("School Code is required"); return; }
    if (role === "staff" && !designation) { setErr("Please select your Designation"); return; }
    if (role === "staff" && designation === "Others" && !customDesignation.trim()) { setErr("Please enter your custom designation"); return; }
    if (role === "staff" && isClassTeacher) {
      if (!className) { setErr("Please select your assigned Class"); return; }
      if (!section.trim()) { setErr("Please enter your assigned Section"); return; }
    }
    if (password && password.length < 6) { setErr("Password must be at least 6 characters"); return; }
    if (password && password !== confirmPassword) { setErr("Passwords do not match"); return; }
    setErr(""); setLoading(true);
    try {
      const effectiveClass = className === "Others" ? "Others" : className;
      const effectiveDesignation = designation === "Others" ? customDesignation.trim() : designation;
      const user = await apiPost("/auth/register", {
        phone: cleanPhone,
        name: name.trim(),
        role,
        gender: (role === "driver" || role === "staff") ? gender : undefined,
        designation: role === "staff" ? effectiveDesignation || undefined : undefined,
        schoolCode: regSchoolCode.trim() || undefined,
        password: password || undefined,
        isClassTeacher: role === "staff" ? isClassTeacher : false,
        ...((role === "student" || (role === "staff" && isClassTeacher)) ? {
          className: effectiveClass || undefined,
          customClass: className === "Others" ? customClass.trim() || undefined : undefined,
          section: section.trim() || undefined,
          rollNumber: role === "student" ? (rollNumber.trim() || undefined) : undefined,
          faculty: (role === "student" && FACULTY_CLASSES.has(className))
            ? (faculty === "Others" ? customFaculty.trim() || "Others" : faculty || undefined)
            : undefined,
        } : {}),
      });
      login({ ...user, tenant: user.tenant ?? null });
      navigate("/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      if (msg.toLowerCase().includes("already registered")) {
        setErr("This number already has an account. Use Sign In instead.");
      } else {
        setErr(msg);
      }
    } finally { setLoading(false); }
  }, [phone, isPhoneVerified, name, role, gender, designation, customDesignation, regSchoolCode, password, confirmPassword, className, customClass, section, rollNumber, faculty, customFaculty, isClassTeacher, login, navigate]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0F172A] px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-slate-800 border border-slate-700 p-6 shadow-2xl">

        {/* Navigation Back */}
        <div className="mb-4">
          <button
            onClick={() => step === "admin_form" ? setStep("new") : navigate("/auth")}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>{step === "admin_form" ? "Back to Roles" : "Back to Sign In"}</span>
          </button>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="text-5xl bus-float">🚌</span>
          <h1 className="text-2xl font-black text-white">
            Orbit<span className="text-[#ffd000]">Track</span>
          </h1>
          <p className="text-xs text-slate-400">
            {step === "admin_form" ? "Register School Organization" : "Create your account & get started"}
          </p>
        </div>

        {/* ── STEP: New account form ── */}
        {step === "new" && (
          <>
            {/* Role picker — always visible */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Choose Your Role <span className="text-amber-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["student", "staff", "driver", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setRole(r); setErr(""); }}
                    className={`rounded-xl border py-2.5 px-2 text-xs font-bold capitalize transition-all cursor-pointer ${
                      role === r
                        ? "border-amber-500 bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                        : "border-slate-600 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                    }`}
                  >
                    {r === "student" && "🎒 "}
                    {r === "staff" && "👩‍🏫 "}
                    {r === "driver" && "🚍 "}
                    {r === "admin" && "🏫 "}
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* Admin role: show special CTA */}
            {role === "admin" ? (
              <>
                <div className="mb-4 rounded-xl border border-amber-700/40 bg-amber-900/10 px-4 py-3.5">
                  <p className="text-sm font-bold text-amber-300 mb-1">🏫 Register Your School</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    School Admin registration requires SuperAdmin verification. Fill in your school's details and a verification code will be sent to your school email within 5–10 minutes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminMobile(phone);
                    setStep("admin_form");
                    setErr("");
                  }}
                  className="w-full rounded-xl bg-amber-500 py-3 font-bold text-slate-900 hover:bg-amber-400 transition-colors shadow-lg cursor-pointer"
                >
                  Register as School Admin →
                </button>
              </>
            ) : (
              <>
                {/* Full Name */}
                <div className="mb-3">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    Full Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Priya Sharma"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setErr(""); }}
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {/* Mobile Number with Verify Button on Right Side */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                      Mobile Number <span className="text-amber-400">*</span>
                    </label>
                    {isPhoneVerified && (
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 focus-within:border-amber-500 transition-colors">
                    <span className="text-sm text-slate-400 select-none">🇳🇵 +977</span>
                    <input
                      type="tel"
                      placeholder="98XXXXXXXX"
                      value={phone}
                      disabled={isPhoneVerified}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                        setErr("");
                        setOtpError("");
                        if (isPhoneVerified) setIsPhoneVerified(false);
                      }}
                      className="flex-1 bg-transparent text-sm text-white font-semibold placeholder:text-slate-600 outline-none disabled:text-slate-300"
                    />

                    {/* Right side verification badge or Verify button */}
                    {isPhoneVerified ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPhoneVerified(false);
                          setOtpSent(false);
                        }}
                        className="text-[11px] font-bold text-slate-400 hover:text-white underline cursor-pointer shrink-0"
                      >
                        Change
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendMobileOtp()}
                        disabled={phone.length < 10 || otpSending}
                        className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 px-2.5 py-1 text-xs font-black transition-all cursor-pointer shadow-sm"
                      >
                        {otpSending ? (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
                        ) : (
                          <>
                            <ShieldCheck size={13} />
                            <span>{otpSent ? "Resend" : "Verify"}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Inline OTP Verification Box */}
                  {otpSent && !isPhoneVerified && (
                    <div className="mt-2.5 rounded-xl border border-amber-500/40 bg-slate-900/90 p-3 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-300 font-bold flex items-center gap-1">
                          <span>💬</span> Enter 6-digit SMS OTP:
                        </span>
                        {countdown > 0 ? (
                          <span className="text-[11px] text-slate-400 font-mono">Resend in {countdown}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendMobileOtp()}
                            className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
                          >
                            Resend Code
                          </button>
                        )}
                      </div>

                      <div className="flex justify-center gap-1.5" onPaste={handleOtpPaste}>
                        {otp.map((d, i) => (
                          <input
                            key={i}
                            ref={(el) => { otpRefs.current[i] = el; }}
                            type="tel"
                            maxLength={1}
                            value={d}
                            onChange={(e) => handleOtpKey(i, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !d && i > 0) {
                                otpRefs.current[i - 1]?.focus();
                              }
                            }}
                            className="h-10 w-9 rounded-lg border border-slate-700 bg-slate-800 text-center text-base font-bold text-white focus:border-amber-500 outline-none"
                          />
                        ))}
                      </div>

                      {otpError && (
                        <p className="text-[11px] text-red-400 font-medium leading-tight">{otpError}</p>
                      )}
                      {otpSuccess && (
                        <p className="text-[11px] text-emerald-400 font-medium leading-tight">{otpSuccess}</p>
                      )}

                      <button
                        type="button"
                        onClick={handleVerifyMobileOtp}
                        disabled={otp.join("").length < 6 || otpVerifying}
                        className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 py-2 text-xs font-black disabled:opacity-40 transition-colors cursor-pointer shadow-md"
                      >
                        {otpVerifying ? "Verifying OTP…" : "Confirm OTP Code ✓"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Gender picker — for Driver & Staff */}
                {(role === "driver" || role === "staff") && (
                  <div className="mb-3">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                      Gender
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["male", "female", "other"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => { setGender(g); setErr(""); }}
                          className={`rounded-xl border py-2 text-xs font-semibold capitalize transition-all cursor-pointer ${
                            gender === g
                              ? "border-amber-500 bg-amber-500/15 text-amber-300"
                              : "border-slate-600 bg-slate-900 text-slate-400 hover:border-slate-500"
                          }`}
                        >
                          {g === "male" ? "👨 Male" : g === "female" ? "👩 Female" : "⚧ Other"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Designation picker — for Staff */}
                {role === "staff" && (
                  <div className="mb-3">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                      Designation / Position <span className="text-amber-400">*</span>
                    </label>
                    <select
                      value={designation}
                      onChange={(e) => { setDesignation(e.target.value); setCustomDesignation(""); setErr(""); }}
                      className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors appearance-none"
                    >
                      <option value="">Select Designation… (e.g. Teacher, Accountant)</option>
                      <option value="Teacher">Teacher / Faculty</option>
                      <option value="Accountant">Accountant / Finance</option>
                      <option value="Principal">Principal</option>
                      <option value="Vice Principal">Vice Principal</option>
                      <option value="Co-ordinator">Co-ordinator / HOD</option>
                      <option value="Admin Staff">Admin / Office Staff</option>
                      <option value="Librarian">Librarian</option>
                      <option value="IT Staff">IT Staff / System Admin</option>
                      <option value="Lab Assistant">Lab Assistant</option>
                      <option value="Receptionist">Receptionist / Front Desk</option>
                      <option value="Cleaner/Helper">Cleaner / Support Staff</option>
                      <option value="Others">Others…</option>
                    </select>
                    {designation === "Others" && (
                      <input
                        type="text"
                        placeholder="Enter custom designation (e.g. Sports Coach)"
                        value={customDesignation}
                        onChange={(e) => { setCustomDesignation(e.target.value); setErr(""); }}
                        className="mt-2 w-full rounded-xl border border-amber-600/60 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors"
                        autoFocus
                      />
                    )}
                  </div>
                )}

                {/* Staff Role Type — Class Teacher vs General Staff */}
                {role === "staff" && (
                  <div className="mb-3">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                      Staff Role Type <span className="text-amber-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setIsClassTeacher(true); setErr(""); }}
                        className={`rounded-xl border py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                          isClassTeacher
                            ? "border-amber-500 bg-amber-500/15 text-amber-300"
                            : "border-slate-600 bg-slate-900 text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        👨‍🏫 Class Teacher
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsClassTeacher(false); setClassName(""); setSection(""); setCustomClass(""); setErr(""); }}
                        className={`rounded-xl border py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                          !isClassTeacher
                            ? "border-amber-500 bg-amber-500/15 text-amber-300"
                            : "border-slate-600 bg-slate-900 text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        📚 General Staff
                      </button>
                    </div>
                  </div>
                )}

                {/* Conditional Class & Section for Class Teacher */}
                {role === "staff" && isClassTeacher && (
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">Assigned Class <span className="text-amber-400">*</span></label>
                      <select
                        value={className}
                        onChange={(e) => { setClassName(e.target.value); setCustomClass(""); setErr(""); }}
                        className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors appearance-none"
                      >
                        <option value="">Select Class…</option>
                        {CLASS_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">Assigned Section <span className="text-amber-400">*</span></label>
                      <input
                        type="text"
                        placeholder="e.g. A"
                        value={section}
                        maxLength={5}
                        onChange={(e) => { setSection(e.target.value.toUpperCase()); setErr(""); }}
                        className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Conditional custom class text input for Class Teacher */}
                {role === "staff" && isClassTeacher && className === "Others" && (
                  <div className="mb-3">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                      Custom Class Name <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BBA, MBA"
                      value={customClass}
                      onChange={(e) => { setCustomClass(e.target.value); setErr(""); }}
                      className="w-full rounded-xl border border-amber-600/60 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors"
                      autoFocus
                    />
                  </div>
                )}

                {/* Student-specific fields */}
                {role === "student" && (
                  <>
                    {/* Row 2: Class | Section */}
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">Class</label>
                        <select
                          value={className}
                          onChange={(e) => { setClassName(e.target.value); setCustomClass(""); setFaculty(""); setErr(""); }}
                          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors appearance-none"
                        >
                          <option value="">Select…</option>
                          {CLASS_OPTIONS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">Section</label>
                        <input
                          type="text"
                          placeholder="e.g. A"
                          value={section}
                          maxLength={5}
                          onChange={(e) => { setSection(e.target.value.toUpperCase()); setErr(""); }}
                          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Conditional: Others → custom class text input */}
                    {className === "Others" && (
                      <div className="mb-3">
                        <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                          Custom Class <span className="text-amber-400">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. BBA, B.Ed, MBA"
                          value={customClass}
                          onChange={(e) => { setCustomClass(e.target.value); setErr(""); }}
                          className="w-full rounded-xl border border-amber-600/60 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors"
                          autoFocus
                        />
                      </div>
                    )}

                    {/* Conditional: Faculty for class 11, 12, Others */}
                    {FACULTY_CLASSES.has(className) && (
                      <div className="mb-3">
                        <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">Faculty</label>
                        <select
                          value={faculty}
                          onChange={(e) => { setFaculty(e.target.value); setCustomFaculty(""); setErr(""); }}
                          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors appearance-none"
                        >
                          <option value="">Select Faculty…</option>
                          {FACULTY_OPTIONS.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                        {faculty === "Others" && (
                          <input
                            type="text"
                            placeholder="e.g. Agriculture, Fine Arts"
                            value={customFaculty}
                            onChange={(e) => { setCustomFaculty(e.target.value); setErr(""); }}
                            className="mt-2 w-full rounded-xl border border-amber-600/60 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors"
                            autoFocus
                          />
                        )}
                      </div>
                    )}

                    {/* Row 3: Roll Number */}
                    <div className="mb-3">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">Roll No.</label>
                      <input
                        type="number"
                        placeholder="e.g. 23"
                        value={rollNumber}
                        onChange={(e) => { setRollNumber(e.target.value); setErr(""); }}
                        className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </>
                )}

                {/* School Code — unified full-width layout for Student, Staff, and Driver */}
                {role !== "admin" && (
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                      School Code <span className="text-amber-400">*</span>
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 focus-within:border-amber-500 transition-colors">
                      <span className="text-slate-400 text-sm">🏫</span>
                      <input
                        type="text"
                        placeholder="e.g. GOLDEN202647"
                        value={regSchoolCode}
                        onChange={(e) => { setRegSchoolCode(e.target.value.toUpperCase()); setErr(""); }}
                        className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none font-mono tracking-wider uppercase"
                        autoCapitalize="characters"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Provided by your school administrator</p>
                  </div>
                )}

                {/* Password | Confirm Password */}
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                      Password <span className="text-slate-500 normal-case font-normal text-[10px]">(opt.)</span>
                    </label>
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 focus-within:border-amber-500 transition-colors">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Min. 6 chars"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setErr(""); }}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowPassword((v) => !v)}
                        className="shrink-0 text-slate-500 hover:text-slate-300 text-[10px] transition-colors cursor-pointer">
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300 uppercase tracking-wide">Confirm</label>
                    <div className={`flex items-center gap-1.5 rounded-xl border bg-slate-900 px-3 py-2.5 transition-colors ${!password ? "border-slate-600 opacity-40 pointer-events-none" : confirmPassword && confirmPassword !== password ? "border-red-600" : confirmPassword === password && confirmPassword ? "border-green-600" : "border-slate-600"}`}>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Re-enter"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setErr(""); }}
                        disabled={!password}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none disabled:cursor-not-allowed"
                        autoComplete="new-password"
                      />
                      {confirmPassword && password && (
                        <span className="text-xs shrink-0">{confirmPassword === password ? "✓" : "✗"}</span>
                      )}
                    </div>
                  </div>
                </div>

                {!password && (
                  <p className="mb-3 text-[11px] text-slate-500">
                    Skip password to use mobile OTP-only login.
                  </p>
                )}

                {err && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-800/50 bg-red-900/20 px-3.5 py-3">
                    <AlertTriangle className="text-red-400 mt-0.5 shrink-0" size={16} />
                    <p className="text-xs text-red-300 leading-relaxed">{err}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={!name.trim() || !isPhoneVerified || (!!password && password !== confirmPassword) || loading}
                  className="w-full rounded-xl bg-amber-500 py-3.5 font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors shadow-lg cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-slate-900/30 border-t-slate-900 animate-spin" />
                      Creating account…
                    </span>
                  ) : !isPhoneVerified ? (
                    "Verify Mobile to Continue →"
                  ) : (
                    "Create Account →"
                  )}
                </button>
              </>
            )}

            <p className="mt-4 text-center text-xs text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline"
              >
                Sign In
              </button>
            </p>
          </>
        )}

        {/* ── STEP: Admin registration form ── */}
        {step === "admin_form" && (
          <>
            <div className="mb-5">
              <h2 className="text-base font-bold text-slate-100 mb-0.5">School Admin Registration</h2>
              <p className="text-xs text-slate-400">Fill in your school details. A SuperAdmin will review within 5–10 minutes.</p>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300 uppercase tracking-wide">School Name</label>
                <input type="text" placeholder="e.g. Golden Gate International School"
                  value={adminSchoolName}
                  onChange={(e) => { setAdminSchoolName(e.target.value); setErr(""); setAdminFieldErrors((p) => ({ ...p, schoolName: "" })); }}
                  className={`w-full rounded-xl border bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-colors ${adminFieldErrors.schoolName ? "border-red-600 focus:border-red-500" : "border-slate-600 focus:border-amber-500"}`} />
                {adminFieldErrors.schoolName && <p className="mt-1 text-xs text-red-400">{adminFieldErrors.schoolName}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300 uppercase tracking-wide">School Contact Person</label>
                <input type="text" placeholder="e.g. Ram Prasad Sharma"
                  value={adminContactName}
                  onChange={(e) => { setAdminContactName(e.target.value); setErr(""); setAdminFieldErrors((p) => ({ ...p, contactName: "" })); }}
                  className={`w-full rounded-xl border bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-colors ${adminFieldErrors.contactName ? "border-red-600 focus:border-red-500" : "border-slate-600 focus:border-amber-500"}`} />
                {adminFieldErrors.contactName && <p className="mt-1 text-xs text-red-400">{adminFieldErrors.contactName}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300 uppercase tracking-wide">School Landline</label>
                <input type="tel" placeholder="e.g. 01-4XXXXXX"
                  value={adminLandline}
                  onChange={(e) => { setAdminLandline(e.target.value); setErr(""); setAdminFieldErrors((p) => ({ ...p, landline: "" })); }}
                  className={`w-full rounded-xl border bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-colors ${adminFieldErrors.landline ? "border-red-600 focus:border-red-500" : "border-slate-600 focus:border-amber-500"}`} />
                {adminFieldErrors.landline && <p className="mt-1 text-xs text-red-400">{adminFieldErrors.landline}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300 uppercase tracking-wide">School Email</label>
                <input type="email" placeholder="admin@yourschool.edu.np"
                  value={adminEmail}
                  onChange={(e) => { setAdminEmail(e.target.value); setErr(""); setAdminFieldErrors((p) => ({ ...p, email: "" })); }}
                  className={`w-full rounded-xl border bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-colors ${adminFieldErrors.email ? "border-red-600 focus:border-red-500" : "border-slate-600 focus:border-amber-500"}`} />
                {adminFieldErrors.email ? (
                  <p className="mt-1 text-xs text-red-400">{adminFieldErrors.email}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">Verification code will be sent here</p>
                )}
              </div>
              <div className="border-t border-slate-700 pt-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Your Details (Person Registering)</p>
                <div className="space-y-3">
                  <div>
                    <input type="text" placeholder="Your full name"
                      value={adminName}
                      onChange={(e) => { setAdminName(e.target.value); setErr(""); setAdminFieldErrors((p) => ({ ...p, adminName: "" })); }}
                      className={`w-full rounded-xl border bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-colors ${adminFieldErrors.adminName ? "border-red-600 focus:border-red-500" : "border-slate-600 focus:border-amber-500"}`} />
                    {adminFieldErrors.adminName && <p className="mt-1 text-xs text-red-400">{adminFieldErrors.adminName}</p>}
                  </div>
                  <div>
                    <input type="text" placeholder="Position / Designation (e.g. Principal)"
                      value={adminPosition}
                      onChange={(e) => { setAdminPosition(e.target.value); setErr(""); setAdminFieldErrors((p) => ({ ...p, position: "" })); }}
                      className={`w-full rounded-xl border bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-colors ${adminFieldErrors.position ? "border-red-600 focus:border-red-500" : "border-slate-600 focus:border-amber-500"}`} />
                    {adminFieldErrors.position && <p className="mt-1 text-xs text-red-400">{adminFieldErrors.position}</p>}
                  </div>
                  <div>
                    <div className={`flex items-center gap-2 rounded-xl border bg-slate-900 px-3 py-2.5 transition-colors ${adminFieldErrors.mobile ? "border-red-600 focus-within:border-red-500" : "border-slate-600 focus-within:border-amber-500"}`}>
                      <span className="text-sm text-slate-400 select-none">🇳🇵 +977</span>
                      <input type="tel" placeholder="Your 10-digit mobile"
                        value={adminMobile}
                        onChange={(e) => { setAdminMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setErr(""); setAdminFieldErrors((p) => ({ ...p, mobile: "" })); }}
                        className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none" />
                    </div>
                    {adminFieldErrors.mobile && <p className="mt-1 text-xs text-red-400">{adminFieldErrors.mobile}</p>}
                  </div>
                </div>
              </div>
            </div>

            {err && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-800/50 bg-red-900/20 px-3.5 py-3">
                <span className="text-red-400 mt-0.5 shrink-0">⚠️</span>
                <p className="text-xs text-red-300 leading-relaxed">{err}</p>
              </div>
            )}

            <button
              onClick={handleAdminRegister}
              disabled={loading}
              className="w-full rounded-xl bg-amber-500 py-3 font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-slate-900/30 border-t-slate-900 animate-spin" />
                  Submitting…
                </span>
              ) : "Submit for Verification →"}
            </button>
          </>
        )}

        {/* ── STEP: Admin pending approval — geo-aware, no nav shortcuts ── */}
        {step === "admin_pending" && (
          <div className="py-2 text-center">
            {isNepal === null ? (
              /* Detecting region */
              <div className="py-10 flex flex-col items-center gap-3">
                <span className="h-7 w-7 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
                <p className="text-xs text-slate-400">Detecting your region…</p>
              </div>
            ) : isNepal ? (
              /* ── Nepal locale (Nepali) ── */
              <>
                <div className="text-5xl mb-4">🕐</div>
                <h2 className="text-lg font-black text-amber-400 mb-4">दर्ता सफल भयो!</h2>
                <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 px-4 py-5 text-left">
                  <p className="text-sm text-amber-200 leading-relaxed font-medium">
                    कृपया धैर्य गर्नुस् तपाइँको दर्ता प्रमाणीकरणमा गएको छ ५–१० मिनेटमा तपाइँको स्कूलको इमेलमा भेरिफिकेसन कोड आउनेछ।
                  </p>
                </div>
              </>
            ) : (
              /* ── International locale (English) ── */
              <>
                <div className="text-5xl mb-4">🕐</div>
                <h2 className="text-lg font-black text-amber-400 mb-4">Registration Submitted!</h2>
                <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 px-4 py-5 text-left">
                  <p className="text-sm text-amber-200 leading-relaxed font-medium">
                    Please wait. Your registration is undergoing verification. A verification code will be sent to your school's email address within 5–10 minutes.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Security notice */}
      <div className="mt-4 w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-center">
        <p className="text-xs text-slate-400">
          <span className="font-semibold text-[#ffd000]">OrbitTrack</span> — Nepal's Smart School Bus Platform
        </p>
      </div>
    </div>
  );
}
