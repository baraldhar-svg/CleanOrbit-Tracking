import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "liquid" | "glass" | "primary" | "secondary" | "danger" | "ghost" | "amber" | "green" | "rose" | "blue";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  badge?: string | number;
  glow?: boolean;
  children: React.ReactNode;
}

export function LiquidButton({
  active = false,
  variant = "glass",
  size = "md",
  icon,
  badge,
  glow = true,
  className,
  children,
  onClick,
  ...props
}: LiquidButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setRipple({ x, y, id: Date.now() });
      setTimeout(() => setRipple(null), 600);
    }
    onClick?.(e);
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs gap-1.5 rounded-full",
    md: "px-4 py-2 text-xs sm:text-sm gap-2 rounded-full",
    lg: "px-6 py-2.5 text-sm sm:text-base gap-2.5 rounded-full",
  };

  let variantClass = "liquid-btn-glass text-slate-700 dark:text-slate-200";

  if (active) {
    if (variant === "green") {
      variantClass = "liquid-btn-green-active";
    } else if (variant === "rose" || variant === "danger") {
      variantClass = "liquid-btn-rose-active";
    } else if (variant === "amber") {
      variantClass = "liquid-btn-amber-msg-active";
    } else if (variant === "blue") {
      variantClass = "liquid-btn-blue-admin";
    } else {
      variantClass = "liquid-btn-active text-white font-bold";
    }
  } else if (variant === "amber") {
    variantClass = "liquid-btn-amber-msg";
  } else if (variant === "green") {
    variantClass = "liquid-btn-glass text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40";
  } else if (variant === "rose") {
    variantClass = "liquid-btn-glass text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-950/40";
  }

  return (
    <button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMousePos({ x: 50, y: 50 });
      }}
      onClick={handleClick}
      className={cn(
        "relative select-none font-medium flex items-center justify-center transition-all duration-300 outline-none focus:outline-none",
        "active:scale-95",
        sizeStyles[size],
        variantClass,
        className
      )}
      style={{
        transform: isHovered && !active ? "translateY(-2px) scale(1.02)" : undefined,
      }}
      {...props}
    >
      {/* Specular 3D light reflection tracking mouse coordinates */}
      {isHovered && !active && (
        <span
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 70px at ${mousePos.x}% ${mousePos.y}%, rgba(255, 255, 255, 0.55), transparent 70%)`,
            borderRadius: "inherit",
          }}
        />
      )}

      {/* Ripple effect on click */}
      {ripple && (
        <span
          className="absolute pointer-events-none rounded-full animate-ping bg-white/50"
          style={{
            left: ripple.x - 15,
            top: ripple.y - 15,
            width: 30,
            height: 30,
          }}
        />
      )}

      {/* Icon */}
      {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}

      {/* Text Label */}
      <span className="relative z-10 whitespace-nowrap">{children}</span>

      {/* Badge */}
      {badge !== undefined && (
        <span
          className={cn(
            "ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full",
            active
              ? "bg-white/30 text-white"
              : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export default LiquidButton;
