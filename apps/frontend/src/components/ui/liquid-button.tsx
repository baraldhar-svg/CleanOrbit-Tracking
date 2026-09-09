import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "liquid" | "glass" | "primary" | "secondary" | "danger" | "ghost" | "amber" | "green" | "rose" | "blue" | "emerald";
  size?: "xs" | "sm" | "md" | "lg";
  icon?: React.ReactNode;
  badge?: string | number;
  glow?: boolean;
  shape?: "pill" | "curved" | "square";
  children?: React.ReactNode;
}

export function LiquidButton({
  active = false,
  variant = "glass",
  size = "md",
  icon,
  badge,
  glow = true,
  shape = "pill",
  className,
  children,
  onClick,
  ...props
}: LiquidButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  // Mouse move effect for dynamic liquid/cursor tracking inside button
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Click ripple effect
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setRipples((prev) => [...prev, { x, y, id: Date.now() }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => Date.now() - r.id < 600));
      }, 600);
    }
    onClick?.(e);
  };

  const shapeStyles = {
    pill: "rounded-full",
    curved: "rounded-2xl",
    square: "rounded-xl",
  };

  const sizeStyles = {
    xs: "px-2.5 py-1 text-[11px] gap-1",
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-xs sm:text-sm gap-2",
    lg: "px-6 py-2.5 text-sm sm:text-base gap-2.5",
  };

  // Color-specific gradient blobs for hover effect
  const blobGradients: Record<string, string> = {
    amber: "linear-gradient(135deg, #f59e0b 0%, #eab308 50%, #f97316 100%)",
    blue: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #06b6d4 100%)",
    green: "linear-gradient(135deg, #10b981 0%, #059669 50%, #14b8a6 100%)",
    emerald: "linear-gradient(135deg, #10b981 0%, #059669 50%, #14b8a6 100%)",
    rose: "linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #db2777 100%)",
    danger: "linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #db2777 100%)",
    glass: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
    liquid: "linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #6366f1 100%)",
    primary: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
    secondary: "linear-gradient(135deg, #64748b 0%, #475569 50%, #334155 100%)",
    ghost: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)",
  };

  let variantClass = "liquid-btn-glass text-slate-700 dark:text-slate-200";

  if (active) {
    if (variant === "green" || variant === "emerald") {
      variantClass = "liquid-btn-green-active shadow-emerald-500/30";
    } else if (variant === "rose" || variant === "danger") {
      variantClass = "liquid-btn-rose-active shadow-rose-500/30";
    } else if (variant === "amber") {
      variantClass = "liquid-btn-amber-msg-active shadow-amber-500/30";
    } else if (variant === "blue") {
      variantClass = "liquid-btn-blue-admin shadow-blue-500/30";
    } else {
      variantClass = "liquid-btn-active text-white font-bold";
    }
  } else if (variant === "amber") {
    variantClass = "liquid-btn-amber-msg";
  } else if (variant === "blue") {
    variantClass = "liquid-btn-blue-admin";
  } else if (variant === "green" || variant === "emerald") {
    variantClass = "liquid-btn-green-active";
  } else if (variant === "rose" || variant === "danger") {
    variantClass = "liquid-btn-rose-active";
  }

  return (
    <button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      className={cn(
        "relative select-none font-medium flex items-center justify-center transition-all duration-300 outline-none focus:outline-none overflow-hidden group shadow-md",
        "active:scale-95",
        shapeStyles[shape],
        sizeStyles[size],
        variantClass,
        className
      )}
      {...props}
    >
      {/* Background Morphing Liquid Gradient Blob on Hover */}
      {isHovered && !active && (
        <span
          className="absolute transition-all duration-500 ease-out pointer-events-none rounded-full blur-xl opacity-70 group-hover:opacity-100"
          style={{
            width: "120px",
            height: "120px",
            background: blobGradients[variant] || blobGradients.glass,
            left: `${coords.x - 60}px`,
            top: `${coords.y - 60}px`,
            transform: isHovered ? "scale(1.4)" : "scale(0.8)",
          }}
        />
      )}

      {/* Mouse Follow Liquid Glow Light */}
      {isHovered && !active && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 70px at ${coords.x}px ${coords.y}px, rgba(255, 255, 255, 0.4), transparent 70%)`,
          }}
        />
      )}

      {/* Click Ripple Expanding Elements */}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute pointer-events-none rounded-full bg-white/50 animate-ping"
          style={{
            left: r.x,
            top: r.y,
            width: "40px",
            height: "40px",
            transform: "translate(-50%, -50%)",
            animationDuration: "600ms",
          }}
        />
      ))}

      {/* Icon */}
      {icon && <span className="relative z-10 shrink-0 flex items-center justify-center">{icon}</span>}

      {/* Text Label */}
      {children && <span className="relative z-10 whitespace-nowrap">{children}</span>}

      {/* Badge */}
      {badge !== undefined && (
        <span
          className={cn(
            "relative z-10 ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full",
            active
              ? "bg-white/30 text-white"
              : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
          )}
        >
          {badge}
        </span>
      )}

      {/* Inner Glossy Border Highlight */}
      <div className="absolute inset-0 rounded-[inherit] border border-white/20 pointer-events-none" />
    </button>
  );
}

export default LiquidButton;

