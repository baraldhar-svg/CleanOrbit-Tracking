import React, { useRef, useState, useEffect } from "react";
import { Check, X, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LiquidStatusToggleProps {
  title?: string;
  isMarkLiveActive: boolean;
  isTakeLeaveActive: boolean;
  onMarkLive: () => void;
  onTakeLeave: () => void;
  disabled?: boolean;
  isLocked?: boolean;
  isFreezeActive?: boolean;
  lockMessage?: string;
  markLiveText?: string;
  takeLeaveText?: string;
  statusMessage?: string;
  className?: string;
}

export function LiquidStatusToggle({
  title = "Today's Status",
  isMarkLiveActive,
  isTakeLeaveActive,
  onMarkLive,
  onTakeLeave,
  disabled = false,
  isLocked = false,
  isFreezeActive = false,
  lockMessage,
  markLiveText = "Mark Live",
  takeLeaveText = "Take Leave",
  statusMessage,
  className,
}: LiquidStatusToggleProps) {
  // Coordinates for liquid origin expansion and sheen tracking
  const liveBtnRef = useRef<HTMLButtonElement>(null);
  const leaveBtnRef = useRef<HTMLButtonElement>(null);

  // Sheen position with lerp animation
  const [liveSheen, setLiveSheen] = useState({ x: 50, y: 50, targetX: 50, targetY: 50, isHovered: false });
  const [leaveSheen, setLeaveSheen] = useState({ x: 50, y: 50, targetX: 50, targetY: 50, isHovered: false });

  // Click ripples
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; target: "live" | "leave" }[]>([]);

  // Smooth lerp cursor tracking with requestAnimationFrame
  useEffect(() => {
    let animId: number;
    const updateLerp = () => {
      setLiveSheen((prev) => {
        if (!prev.isHovered) return prev;
        const lerpFactor = 0.18;
        return {
          ...prev,
          x: prev.x + (prev.targetX - prev.x) * lerpFactor,
          y: prev.y + (prev.targetY - prev.y) * lerpFactor,
        };
      });

      setLeaveSheen((prev) => {
        if (!prev.isHovered) return prev;
        const lerpFactor = 0.18;
        return {
          ...prev,
          x: prev.x + (prev.targetX - prev.x) * lerpFactor,
          y: prev.y + (prev.targetY - prev.y) * lerpFactor,
        };
      });

      animId = requestAnimationFrame(updateLerp);
    };

    animId = requestAnimationFrame(updateLerp);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>, target: "live" | "leave") => {
    const btn = target === "live" ? liveBtnRef.current : leaveBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (target === "live") {
      setLiveSheen((prev) => ({ ...prev, targetX: x, targetY: y, isHovered: true }));
    } else {
      setLeaveSheen((prev) => ({ ...prev, targetX: x, targetY: y, isHovered: true }));
    }
  };

  const handlePointerLeave = (target: "live" | "leave") => {
    if (target === "live") {
      setLiveSheen((prev) => ({ ...prev, isHovered: false }));
    } else {
      setLeaveSheen((prev) => ({ ...prev, isHovered: false }));
    }
  };

  const handleButtonClick = (e: React.PointerEvent<HTMLButtonElement>, target: "live" | "leave") => {
    if (disabled || isLocked || isFreezeActive) return;

    const btn = target === "live" ? liveBtnRef.current : leaveBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rippleId = Date.now();
      setRipples((prev) => [...prev, { id: rippleId, x, y, target }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== rippleId));
      }, 600);
    }

    if (target === "live") {
      onMarkLive();
    } else {
      onTakeLeave();
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-3xl p-5 sm:p-6 overflow-hidden shadow-2xl transition-all duration-300",
        "border border-white/60 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
        className
      )}
      style={{
        WebkitUserSelect: "none",
        userSelect: "none",
        touchAction: "manipulation",
      }}
      onDoubleClick={(e) => e.preventDefault()}
    >
      {/* ── Floating Blurred Background Blobs ────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit] -z-10">
        {/* Emerald Blob on Left */}
        <div
          className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-500/20 dark:bg-emerald-500/15 blur-2xl animate-pulse"
          style={{ animationDuration: "7s" }}
        />
        {/* Rose Blob on Right */}
        <div
          className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-rose-500/20 dark:bg-rose-500/15 blur-2xl animate-pulse"
          style={{ animationDuration: "8s", animationDelay: "2s" }}
        />
        {/* Amber / Cyan Blob in Center */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-cyan-400/15 dark:bg-blue-500/10 blur-3xl"
        />
      </div>

      {/* ── Card Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white tracking-tight">
            {title}
          </h3>
        </div>

        {isFreezeActive && (
          <span className="flex items-center gap-1 rounded-full bg-sky-950/50 border border-sky-400/40 px-3 py-0.5 text-[10px] font-bold text-sky-300 shadow-xs">
            <Lock size={10} /> 4h Freeze Active
          </span>
        )}
        {isLocked && !isFreezeActive && (
          <span className="flex items-center gap-1 rounded-full bg-slate-900/40 border border-slate-400/30 px-3 py-0.5 text-[10px] font-bold text-slate-300 shadow-xs">
            <Lock size={10} /> Locked
          </span>
        )}
      </div>

      {/* ── Two-Button Toggle Row (Mutually Exclusive) ─────────── */}
      <div
        className={cn(
          "flex flex-col min-[460px]:flex-row gap-3 relative z-10",
          (disabled || isLocked || isFreezeActive) && "opacity-60 pointer-events-none"
        )}
      >
        {/* ── 1. Mark Live Button (Green Gradient with Subtle Underline) ── */}
        <div className="flex-1 flex flex-col items-center">
          <button
            ref={liveBtnRef}
            type="button"
            disabled={disabled || isLocked || isFreezeActive}
            onPointerDown={(e) => handleButtonClick(e, "live")}
            onPointerMove={(e) => handlePointerMove(e, "live")}
            onPointerLeave={() => handlePointerLeave("live")}
            className={cn(
              "relative w-full py-4 px-5 rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 select-none overflow-hidden",
              "flex items-center justify-center gap-2 border active:scale-98 shadow-md outline-none cursor-pointer",
              isMarkLiveActive
                ? "liquid-btn-green-active text-white border-emerald-300/80 shadow-emerald-500/40"
                : "liquid-btn-glass text-slate-700 dark:text-slate-200 border-white/60 dark:border-white/10 hover:border-emerald-500/40"
            )}
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* Smooth Cursor Sheen Tracking */}
            {liveSheen.isHovered && !isMarkLiveActive && (
              <span
                className="absolute pointer-events-none rounded-full blur-md opacity-80"
                style={{
                  width: "100px",
                  height: "100px",
                  background: "radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(255,255,255,0.2) 50%, transparent 80%)",
                  left: `${liveSheen.x - 50}px`,
                  top: `${liveSheen.y - 50}px`,
                  transform: "scale(1.2)",
                  transition: "opacity 0.2s ease",
                }}
              />
            )}

            {/* Click Ripple */}
            {ripples
              .filter((r) => r.target === "live")
              .map((r) => (
                <span
                  key={r.id}
                  className="absolute pointer-events-none rounded-full bg-white/60 animate-ping"
                  style={{
                    left: r.x,
                    top: r.y,
                    width: "45px",
                    height: "45px",
                    transform: "translate(-50%, -50%)",
                    animationDuration: "600ms",
                  }}
                />
              ))}

            {/* Icon & Label */}
            <span className="relative z-10 flex items-center justify-center gap-2 font-extrabold tracking-wide">
              <Check size={18} className={cn("stroke-[3]", isMarkLiveActive ? "text-white" : "text-emerald-500")} />
              {markLiveText}
            </span>

            {/* Top Glass Specular Cap */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none rounded-t-2xl" />
          </button>

          {/* Subtle Green Accent Bar Underneath */}
          <div
            className={cn(
              "h-1 w-3/4 rounded-full mt-1.5 transition-all duration-300",
              isMarkLiveActive
                ? "bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 shadow-[0_0_10px_#10b981]"
                : "bg-emerald-500/30 dark:bg-emerald-500/20"
            )}
          />
        </div>

        {/* ── 2. Take Leave Button (Red Gradient with Subtle Underline) ── */}
        <div className="flex-1 flex flex-col items-center">
          <button
            ref={leaveBtnRef}
            type="button"
            disabled={disabled || isLocked || isFreezeActive}
            onPointerDown={(e) => handleButtonClick(e, "leave")}
            onPointerMove={(e) => handlePointerMove(e, "leave")}
            onPointerLeave={() => handlePointerLeave("leave")}
            className={cn(
              "relative w-full py-4 px-5 rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 select-none overflow-hidden",
              "flex items-center justify-center gap-2 border active:scale-98 shadow-md outline-none cursor-pointer",
              isTakeLeaveActive
                ? "liquid-btn-rose-active text-white border-rose-300/80 shadow-rose-500/40"
                : "liquid-btn-glass text-slate-700 dark:text-slate-200 border-white/60 dark:border-white/10 hover:border-rose-500/40"
            )}
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* Smooth Cursor Sheen Tracking */}
            {leaveSheen.isHovered && !isTakeLeaveActive && (
              <span
                className="absolute pointer-events-none rounded-full blur-md opacity-80"
                style={{
                  width: "100px",
                  height: "100px",
                  background: "radial-gradient(circle, rgba(244,63,94,0.35) 0%, rgba(255,255,255,0.2) 50%, transparent 80%)",
                  left: `${leaveSheen.x - 50}px`,
                  top: `${leaveSheen.y - 50}px`,
                  transform: "scale(1.2)",
                  transition: "opacity 0.2s ease",
                }}
              />
            )}

            {/* Click Ripple */}
            {ripples
              .filter((r) => r.target === "leave")
              .map((r) => (
                <span
                  key={r.id}
                  className="absolute pointer-events-none rounded-full bg-white/60 animate-ping"
                  style={{
                    left: r.x,
                    top: r.y,
                    width: "45px",
                    height: "45px",
                    transform: "translate(-50%, -50%)",
                    animationDuration: "600ms",
                  }}
                />
              ))}

            {/* Icon & Label */}
            <span className="relative z-10 flex items-center justify-center gap-2 font-extrabold tracking-wide">
              {isLocked ? (
                <Lock size={16} />
              ) : (
                <X size={18} className={cn("stroke-[3]", isTakeLeaveActive ? "text-white" : "text-rose-500")} />
              )}
              {takeLeaveText}
            </span>

            {/* Top Glass Specular Cap */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none rounded-t-2xl" />
          </button>

          {/* Subtle Red Accent Bar Underneath */}
          <div
            className={cn(
              "h-1 w-3/4 rounded-full mt-1.5 transition-all duration-300",
              isTakeLeaveActive
                ? "bg-gradient-to-r from-rose-400 via-red-500 to-rose-600 shadow-[0_0_10px_#f43f5e]"
                : "bg-rose-500/30 dark:bg-rose-500/20"
            )}
          />
        </div>
      </div>

      {/* ── Status Message Line Below Buttons ────────────────────── */}
      <div className="mt-3.5 pt-3 border-t border-white/40 dark:border-white/10 relative z-10">
        {lockMessage ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-300">
            <Lock size={13} className="shrink-0" />
            <span>{lockMessage}</span>
          </div>
        ) : isMarkLiveActive ? (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>Driver notified: Coming to School Today ✓</span>
          </div>
        ) : isTakeLeaveActive ? (
          <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
            <AlertCircle size={15} className="shrink-0" />
            <span>Driver notified: On Leave Today (Not Riding)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-400/60 inline-block" />
            <span>{statusMessage || "Tap an option above to inform your school driver."}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiquidStatusToggle;
