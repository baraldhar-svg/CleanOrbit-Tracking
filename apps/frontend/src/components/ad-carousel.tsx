import { useState, useEffect, useRef, useCallback } from "react";
import { Globe } from "lucide-react";

export type Ad = {
  id: number;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  targetUrl?: string | null;
};

export default function AdCarousel({
  ads,
  onAdClick,
}: {
  ads: Ad[];
  onAdClick?: (ad: Ad) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Auto 360 rotate every 3.5 seconds
  useEffect(() => {
    if (ads.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % ads.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [ads.length, isPaused]);

  const handlePrev = useCallback(() => {
    setIdx((i) => (i - 1 + ads.length) % ads.length);
  }, [ads.length]);

  const handleNext = useCallback(() => {
    setIdx((i) => (i + 1) % ads.length);
  }, [ads.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diffX) > 40) {
      if (diffX < 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
  };

  if (!ads || ads.length === 0) return null;

  const currentAd = ads[idx] ?? ads[0];

  const handleClick = (ad: Ad) => {
    if (onAdClick) {
      onAdClick(ad);
    } else if (ad.targetUrl) {
      if (ad.targetUrl.startsWith("http://") || ad.targetUrl.startsWith("https://")) {
        window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div
      className="relative w-full select-none py-2 px-2 sm:px-4 overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl shadow-md"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header title & controls */}
      <div className="flex items-center justify-between px-1 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest">
            Featured School Spotlight
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 font-mono">
            {idx + 1} / {ads.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-300 transition-all active:scale-95 text-[10px] shadow-md"
              title="Previous Ad"
            >
              ◀
            </button>
            <button
              onClick={handleNext}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-300 transition-all active:scale-95 text-[10px] shadow-md"
              title="Next Ad"
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* 360 Rotating Full Banner Container — Reduced 25% vertical height (h-32 sm:h-36 md:h-44) */}
      <div className="relative w-full [perspective:1200px]">
        <div
          key={currentAd.id}
          onClick={() => handleClick(currentAd)}
          className="relative w-full h-32 sm:h-36 md:h-44 rounded-xl overflow-hidden cursor-pointer transition-all duration-700 ease-out shadow-lg border border-amber-400/80 shadow-amber-500/20 group animate-in fade-in zoom-in-95 duration-500"
          style={{
            transformStyle: "preserve-3d",
          }}
        >
          {/* Full Banner Image */}
          <img
            src={currentAd.imageUrl}
            alt={currentAd.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent" />

          {/* SPONSORED Badge */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-amber-500/90 backdrop-blur-md px-2.5 py-0.5 text-[9px] font-black text-slate-950 shadow-lg">
            <span>SPONSORED</span>
          </div>

          {/* Banner Content */}
          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-left flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div className="max-w-xl">
              <h3 className="font-black text-white text-sm sm:text-base md:text-lg leading-tight drop-shadow-md">
                {currentAd.title}
              </h3>
              {currentAd.subtitle && (
                <p className="text-[11px] sm:text-xs text-slate-200 mt-0.5 drop-shadow line-clamp-1">
                  {currentAd.subtitle}
                </p>
              )}
            </div>

            {currentAd.targetUrl && (
              <div className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1.5 text-[11px] font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-300 transition-all shadow-md group-hover:scale-105">
                <Globe size={12} />
                <span>Visit School →</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 360 Rotation Dots & Indicators */}
      <div className="flex justify-center items-center gap-1.5 pt-1.5">
        {ads.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === idx
                ? "w-6 bg-amber-400 shadow-md shadow-amber-400/50"
                : "w-1.5 bg-slate-700 hover:bg-slate-500"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
