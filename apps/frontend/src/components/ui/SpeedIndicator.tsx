import React from "react";

interface SpeedIndicatorProps {
  speed: number | null | undefined;
  isLive?: boolean;
}

export function SpeedIndicator({ speed, isLive = true }: SpeedIndicatorProps) {
  if (!isLive) return null;

  const currentSpeed = speed != null && speed > 0 ? Math.round(speed) : 0;
  
  let status = "safe";
  let orbClass = "";
  let glowClass = "";
  let animationClass = "";

  if (currentSpeed >= 55) {
    status = "danger";
    orbClass = "bg-gradient-to-br from-red-400 to-red-600 border-red-300";
    glowClass = "shadow-[0_0_15px_rgba(239,68,68,0.8),inset_0_0_8px_rgba(255,255,255,0.6)]";
    animationClass = "animate-ping"; // Faster flashing for SOS effect
  } else if (currentSpeed >= 45) {
    status = "warning";
    orbClass = "bg-gradient-to-br from-yellow-300 to-yellow-500 border-yellow-200";
    glowClass = "shadow-[0_0_15px_rgba(250,204,21,0.8),inset_0_0_8px_rgba(255,255,255,0.6)]";
  } else {
    status = "safe";
    orbClass = "bg-gradient-to-br from-green-400 to-green-600 border-green-300";
    glowClass = "shadow-[0_0_15px_rgba(34,197,94,0.8),inset_0_0_8px_rgba(255,255,255,0.6)]";
  }

  return (
    <div className="flex flex-col items-center justify-center mx-2 shrink-0" title={`${currentSpeed} km/h`}>
      <div className="relative flex items-center justify-center">
        {/* The SOS Ping Animation Layer */}
        {currentSpeed >= 55 && (
          <div className={`absolute w-8 h-8 rounded-full bg-red-500/50 ${animationClass}`}></div>
        )}
        
        {/* Crystal Orb */}
        <div 
          className={`relative z-10 w-7 h-7 rounded-full border border-white/40 ${orbClass} ${glowClass}`}
        >
          {/* Glass reflection highlight */}
          <div className="absolute top-[3px] right-[4px] w-2.5 h-2 rounded-full bg-white/70 rotate-[-45deg]"></div>
          <div className="absolute bottom-[3px] left-[4px] w-1.5 h-1.5 rounded-full bg-white/40"></div>
        </div>
      </div>
      
      {/* Speed Label */}
      <span className="text-xs font-bold mt-1 text-foreground whitespace-nowrap leading-none tracking-tight">
        {currentSpeed} <span className="text-muted-foreground text-[9px] font-medium">km/h</span>
      </span>
    </div>
  );
}
