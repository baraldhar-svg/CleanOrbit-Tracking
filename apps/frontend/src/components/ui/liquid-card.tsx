import React from "react";
import { cn } from "@/lib/utils";

export interface LiquidGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  glowColor?: "blue" | "cyan" | "purple" | "amber" | "emerald" | "none";
  children: React.ReactNode;
}

export function LiquidGlassCard({
  hoverEffect = true,
  glowColor = "none",
  className,
  children,
  ...props
}: LiquidGlassCardProps) {
  const glowStyles = {
    none: "",
    blue: "hover:shadow-[0_12px_30px_-5px_rgba(37,99,235,0.25)]",
    cyan: "hover:shadow-[0_12px_30px_-5px_rgba(6,182,212,0.25)]",
    purple: "hover:shadow-[0_12px_30px_-5px_rgba(139,92,246,0.25)]",
    amber: "hover:shadow-[0_12px_30px_-5px_rgba(245,158,11,0.25)]",
    emerald: "hover:shadow-[0_12px_30px_-5px_rgba(16,185,129,0.25)]",
  };

  return (
    <div
      className={cn(
        "liquid-glass-card p-5 sm:p-6",
        hoverEffect && "liquid-glass-card-hover cursor-pointer",
        glowStyles[glowColor],
        className
      )}
      {...props}
    >
      {/* Top subtle gloss highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />
      {children}
    </div>
  );
}

export interface LiquidStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: "blue" | "emerald" | "amber" | "purple" | "cyan";
  badgeText?: string;
  onClick?: () => void;
  className?: string;
}

export function LiquidStatCard({
  title,
  value,
  subtitle,
  icon,
  variant = "blue",
  badgeText,
  onClick,
  className,
}: LiquidStatCardProps) {
  const variantStyles = {
    blue: {
      iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      accentBg: "from-blue-500/5 to-cyan-500/10",
      badgeColor: "text-blue-600 bg-blue-500/10 border-blue-500/20",
    },
    emerald: {
      iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      accentBg: "from-emerald-500/5 to-teal-500/10",
      badgeColor: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    },
    amber: {
      iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      accentBg: "from-amber-500/5 to-orange-500/10",
      badgeColor: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    },
    purple: {
      iconBg: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      accentBg: "from-purple-500/5 to-indigo-500/10",
      badgeColor: "text-purple-600 bg-purple-500/10 border-purple-500/20",
    },
    cyan: {
      iconBg: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
      accentBg: "from-cyan-500/5 to-blue-500/10",
      badgeColor: "text-cyan-600 bg-cyan-500/10 border-cyan-500/20",
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={cn(
        "liquid-glass-card p-4 sm:p-5 flex items-center justify-between relative overflow-hidden group cursor-pointer",
        "hover:translate-y-[-2px] hover:shadow-lg transition-all duration-300",
        className
      )}
    >
      {/* Background Soft Liquid Wave Tint */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none transition-opacity duration-300 group-hover:opacity-100",
          style.accentBg
        )}
      />

      {/* Decorative Jelly Droplet Light */}
      <div className="liquid-stat-bubble opacity-40 group-hover:opacity-70 transition-opacity duration-500" />

      <div className="flex items-center gap-3.5 relative z-10">
        {/* Rounded 3D Icon Circle */}
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0",
            style.iconBg
          )}
        >
          {icon}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {value}
          </p>
          {badgeText && (
            <p className="text-[11px] font-semibold flex items-center gap-1 mt-0.5">
              <span className={cn("px-1.5 py-0.5 rounded-full border text-[10px]", style.badgeColor)}>
                {badgeText}
              </span>
            </p>
          )}
        </div>
      </div>

      {subtitle && (
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium relative z-10">
          {subtitle}
        </span>
      )}
    </div>
  );
}

export default LiquidGlassCard;
