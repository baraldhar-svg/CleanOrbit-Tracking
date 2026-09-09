import React, { useState, useRef, useEffect, useCallback } from "react";
import { Lock, RefreshCw, RotateCcw, Smartphone, ArrowLeft } from "lucide-react";

// ==========================================
// ANIMATION TIMINGS & CONSTANTS (Easily Tunable)
// ==========================================
export const OTP_CONFIG = {
  DIGIT_COUNT: 6,
  SPIN_DURATION_MS: 650,    // 3D rotation duration
  STAGGER_DELAY_MS: 85,     // Stagger delay between box flips
  MIDPOINT_DELAY_MS: 325,   // When glow turns green during flip
  EXIT_FADE_DELAY_MS: 250,  // Boxes fade out after all flips complete
  SCREEN_SWAP_DELAY_MS: 400,// Screen cross-fade / slide handoff
  COUNTDOWN_SECONDS: 60,
};

export interface OtpVerificationScreenProps {
  phoneNumber?: string;
  maskedTarget?: string; // e.g. "is***@gmail.com" or "+977 9849278215"
  isEmailTarget?: boolean;
  userBadge?: {
    name: string;
    role: string;
  };
  onVerify?: (code: string) => Promise<boolean> | boolean | void;
  onResend?: () => void;
  onChangeNumber?: () => void;
  onSuccessComplete?: () => void;
  autoVerify?: boolean;
  showReplay?: boolean;
  className?: string;
}

export default function OtpVerificationScreen({
  phoneNumber = "+977 9849278215",
  maskedTarget,
  isEmailTarget = false,
  userBadge,
  onVerify,
  onResend,
  onChangeNumber,
  onSuccessComplete,
  autoVerify = true,
  showReplay = true,
  className = "",
}: OtpVerificationScreenProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_CONFIG.DIGIT_COUNT).fill(""));
  const [screenState, setScreenState] = useState<"input" | "verifying" | "success">("input");
  
  // Track per-box flip & resolve states for 3D stagger
  const [boxFlipping, setBoxFlipping] = useState<boolean[]>(Array(OTP_CONFIG.DIGIT_COUNT).fill(false));
  const [boxResolved, setBoxResolved] = useState<boolean[]>(Array(OTP_CONFIG.DIGIT_COUNT).fill(false));
  const [boxesFadingOut, setBoxesFadingOut] = useState(false);
  const [activeScreenVisible, setActiveScreenVisible] = useState<"input" | "success">("input");

  const [countdown, setCountdown] = useState(OTP_CONFIG.COUNTDOWN_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);

  // Clear timeouts helper
  const clearAllTimeouts = () => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];
  };

  useEffect(() => {
    return () => clearAllTimeouts();
  }, []);

  // Countdown timer for Resend
  useEffect(() => {
    if (screenState === "success") return;
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            setCanResend(true);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [countdown, screenState]);

  // Focus first input on mount / reset
  useEffect(() => {
    if (screenState === "input") {
      const firstEmpty = digits.findIndex((d) => !d);
      const targetIdx = firstEmpty === -1 ? 0 : firstEmpty;
      setTimeout(() => inputRefs.current[targetIdx]?.focus(), 100);
    }
  }, [screenState]);

  // Handle single digit input
  const handleDigitChange = (index: number, value: string) => {
    if (screenState !== "input") return;

    // Filter only numeric characters
    const cleanDigits = value.replace(/\D/g, "");

    // Handling paste of multi-digits
    if (cleanDigits.length > 1) {
      const newDigits = [...digits];
      const pastedChars = cleanDigits.slice(0, OTP_CONFIG.DIGIT_COUNT).split("");
      pastedChars.forEach((char, idx) => {
        if (index + idx < OTP_CONFIG.DIGIT_COUNT) {
          newDigits[index + idx] = char;
        }
      });
      setDigits(newDigits);

      const nextFocus = Math.min(index + pastedChars.length, OTP_CONFIG.DIGIT_COUNT - 1);
      inputRefs.current[nextFocus]?.focus();

      if (newDigits.every((d) => d !== "") && autoVerify) {
        triggerVerification(newDigits.join(""));
      }
      return;
    }

    const newDigit = cleanDigits.slice(-1);
    const updated = [...digits];
    updated[index] = newDigit;
    setDigits(updated);

    if (newDigit && index < OTP_CONFIG.DIGIT_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify once all filled
    if (updated.every((d) => d !== "") && autoVerify) {
      triggerVerification(updated.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (screenState !== "input") return;

    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        const updated = [...digits];
        updated[index - 1] = "";
        setDigits(updated);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_CONFIG.DIGIT_COUNT - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Trigger 3D Stagger Flip & Resolve
  const triggerVerification = useCallback((code: string) => {
    setScreenState("verifying");
    clearAllTimeouts();

    // Stagger 3D flip each box
    for (let i = 0; i < OTP_CONFIG.DIGIT_COUNT; i++) {
      const flipStart = i * OTP_CONFIG.STAGGER_DELAY_MS;
      const midpoint = flipStart + OTP_CONFIG.MIDPOINT_DELAY_MS;

      // Start flip
      const flipTimer = setTimeout(() => {
        setBoxFlipping((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, flipStart);

      // Midpoint: turn glowing border from orange/red to green
      const resolveTimer = setTimeout(() => {
        setBoxResolved((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, midpoint);

      timeoutIdsRef.current.push(flipTimer, resolveTimer);
    }

    // After all boxes finish flipping: fade out & shrink boxes
    const totalFlipTime = (OTP_CONFIG.DIGIT_COUNT - 1) * OTP_CONFIG.STAGGER_DELAY_MS + OTP_CONFIG.SPIN_DURATION_MS;
    
    const fadeTimer = setTimeout(() => {
      setBoxesFadingOut(true);
    }, totalFlipTime + 100);

    // Cross-fade to Success Screen
    const successTimer = setTimeout(async () => {
      if (onVerify) {
        try {
          await onVerify(code);
        } catch {
          // If error handling needed, can revert
        }
      }
      setActiveScreenVisible("success");
      setScreenState("success");
      if (onSuccessComplete) {
        onSuccessComplete();
      }
    }, totalFlipTime + OTP_CONFIG.EXIT_FADE_DELAY_MS + OTP_CONFIG.SCREEN_SWAP_DELAY_MS);

    timeoutIdsRef.current.push(fadeTimer, successTimer);
  }, [onVerify, onSuccessComplete]);

  // Reset to initial demo state
  const resetDemo = () => {
    clearAllTimeouts();
    setDigits(Array(OTP_CONFIG.DIGIT_COUNT).fill(""));
    setBoxFlipping(Array(OTP_CONFIG.DIGIT_COUNT).fill(false));
    setBoxResolved(Array(OTP_CONFIG.DIGIT_COUNT).fill(false));
    setBoxesFadingOut(false);
    setActiveScreenVisible("input");
    setScreenState("input");
    setCountdown(OTP_CONFIG.COUNTDOWN_SECONDS);
    setCanResend(false);
  };

  const handleResendClick = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    if (onResend) {
      await onResend();
    }
    setCountdown(OTP_CONFIG.COUNTDOWN_SECONDS);
    setCanResend(false);
    setIsResending(false);
  };

  const isSuccess = screenState === "success";

  return (
    <div className={`relative flex flex-col items-center justify-center p-4 select-none ${className}`}>
      {/* Background Soft Radial Glow (Transitions Orange -> Green) */}
      <div
        className={`pointer-events-none absolute -inset-10 rounded-full blur-[100px] transition-all duration-1000 ease-out ${
          isSuccess
            ? "bg-gradient-to-tr from-emerald-600/35 via-teal-500/25 to-green-400/20 scale-110 opacity-100"
            : screenState === "verifying"
            ? "bg-gradient-to-tr from-amber-600/30 via-orange-500/35 to-emerald-500/30 scale-105 opacity-90"
            : "bg-gradient-to-tr from-amber-600/20 via-orange-500/20 to-red-500/15 scale-100 opacity-70"
        }`}
      />

      {/* Phone-Frame Container */}
      <div className="relative w-full max-w-[375px] min-h-[580px] sm:min-h-[610px] rounded-[38px] border border-white/10 bg-[#121212] p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_30px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden backdrop-blur-2xl">
        
        {/* Top Phone Notch / Dynamic Pill */}
        <div className="mx-auto mb-3 flex h-5 w-24 items-center justify-center rounded-full bg-black/60 border border-white/5 shadow-inner">
          <div className="h-2 w-2 rounded-full bg-slate-800 mr-2 border border-slate-700" />
          <div className="h-1.5 w-8 rounded-full bg-slate-900" />
        </div>

        {/* Dynamic Top Bar: Navigation / Back */}
        <div className="flex items-center justify-between mb-4">
          {onChangeNumber && screenState === "input" ? (
            <button
              onClick={onChangeNumber}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} /> <span>Change Number</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Smartphone size={13} className="text-slate-500" />
              <span>OrbitTrack SMS/OTP</span>
            </div>
          )}
          <span className="text-[10px] font-extrabold tracking-widest text-slate-600 uppercase">
            {isSuccess ? "VERIFIED" : "2FA STEP"}
          </span>
        </div>

        {/* User Badge if provided */}
        {userBadge && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-slate-900/90 p-2.5 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-black text-xs border border-amber-500/30">
                {userBadge.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">{userBadge.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{userBadge.role}</p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 shrink-0">
              {phoneNumber}
            </span>
          </div>
        )}

        {/* ==========================================
            SCREEN 1: OTP INPUT SCREEN
        ========================================== */}
        {activeScreenVisible === "input" && (
          <div
            className={`flex-1 flex flex-col justify-between transition-all duration-400 ${
              screenState === "verifying" && boxesFadingOut
                ? "opacity-0 -translate-y-4 scale-95"
                : "opacity-100 translate-y-0 scale-100"
            }`}
          >
            {/* Header Content */}
            <div className="text-center mt-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Let's verify your number
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed px-1">
                We've sent a 6-digit code to{" "}
                {isEmailTarget ? (
                  <span className="text-amber-400 font-mono font-semibold">{maskedTarget || "your email"}</span>
                ) : (
                  <span className="text-amber-400 font-mono font-semibold">{phoneNumber}</span>
                )}
                . It'll auto-verify once entered.
              </p>
            </div>

            {/* 6 OTP Input Boxes */}
            <div
              className={`flex justify-center items-center gap-2 sm:gap-2.5 my-6 perspective-[1000px] transition-all duration-300 ${
                boxesFadingOut ? "opacity-0 scale-90" : "opacity-100 scale-100"
              }`}
            >
              {digits.map((digit, index) => {
                const isFlipping = boxFlipping[index];
                const isResolved = boxResolved[index];
                const hasValue = digit !== "";

                return (
                  <div
                    key={index}
                    style={{
                      transformStyle: "preserve-3d",
                      animation: isFlipping
                        ? `boxFlip ${OTP_CONFIG.SPIN_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`
                        : "none",
                    }}
                    className={`relative h-12 w-11 sm:h-14 sm:w-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                      isResolved
                        ? "border-2 border-emerald-500 bg-emerald-950/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.45)]"
                        : hasValue
                        ? "border-2 border-amber-500 bg-amber-500/15 text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.35)] scale-105"
                        : "border-2 border-white/10 bg-slate-900/80 text-white hover:border-white/20"
                    }`}
                  >
                    <input
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      disabled={screenState === "verifying"}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData("text");
                        handleDigitChange(index, pasted);
                      }}
                      className="w-full h-full bg-transparent text-center text-xl font-mono font-black outline-none cursor-pointer disabled:cursor-not-allowed select-none"
                    />
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions & Resend */}
            <div className="space-y-4 text-center mt-auto pb-2">
              <div className="text-xs text-slate-400">
                <span>Didn't receive the code? </span>
                {canResend ? (
                  <button
                    onClick={handleResendClick}
                    disabled={isResending}
                    className="font-bold text-amber-400 hover:text-amber-300 underline underline-offset-4 transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={isResending ? "animate-spin" : ""} />
                    Resend
                  </button>
                ) : (
                  <span className="font-mono font-bold text-slate-500">
                    Resend in <span className="text-amber-500 font-semibold">{countdown}s</span>
                  </span>
                )}
              </div>

              {/* Status bar */}
              <div className="h-10 flex items-center justify-center">
                {screenState === "verifying" && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-400 animate-pulse">
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Verifying 6-digit code…</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            SCREEN 2: SUCCESS SCREEN
        ========================================== */}
        {activeScreenVisible === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-fadeInUp py-6">
            {/* Rounded-Square Badge with Drawing Checkmark */}
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-emerald-500 bg-emerald-950/50 shadow-[0_0_35px_rgba(16,185,129,0.4)]">
              {/* Inner ambient ring */}
              <div className="absolute inset-1 rounded-2xl border border-emerald-400/30" />
              
              {/* Self-Drawing Animated SVG Checkmark */}
              <svg
                className="h-10 w-10 text-emerald-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline
                  points="20 6 9 17 4 12"
                  className="animate-drawCheck"
                  style={{
                    strokeDasharray: 50,
                    strokeDashoffset: 50,
                  }}
                />
              </svg>
            </div>

            {/* Success Headers */}
            <h2 className="text-2xl font-black text-white tracking-tight">
              Verified successfully
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-[240px] leading-relaxed">
              Your phone number has been verified.
            </p>

            {/* Verified & Secured Line with Lock */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1.5 text-xs font-bold text-emerald-400 shadow-sm">
              <Lock size={13} className="text-emerald-400" />
              <span>Verified &amp; secured</span>
            </div>
          </div>
        )}

        {/* Bottom Home Indicator Line */}
        <div className="mx-auto mt-4 h-1 w-32 rounded-full bg-slate-800" />
      </div>

      {/* Replay Demo Button */}
      {showReplay && (
        <button
          onClick={resetDemo}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:border-amber-500/40 hover:bg-slate-800 transition-all shadow-lg active:scale-95 cursor-pointer"
        >
          <RotateCcw size={13} className="text-amber-400" />
          <span>Replay Demo</span>
        </button>
      )}

      {/* Keyframe Styles */}
      <style>{`
        @keyframes boxFlip {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(360deg);
          }
        }
        @keyframes drawCheck {
          0% {
            stroke-dashoffset: 50;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .animate-drawCheck {
          animation: drawCheck 0.65s cubic-bezier(0.65, 0, 0.45, 1) forwards 0.25s;
        }
        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(15px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
