import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { mediaUrl } from "@/lib/api";

export const StoryCarousel = ({ slides = [], paid = false, onUnlock }) => {
  const [idx, setIdx] = useState(0);
  const touchX = useRef(null);
  const n = slides.length;
  if (!n) return null;
  const slide = slides[idx];

  const go = (dir) => setIdx((i) => Math.min(n - 1, Math.max(0, i + dir)));

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  const handleTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (slide.locked && !paid) { onUnlock && onUnlock(); return; }
    go(x < rect.width / 2 ? -1 : 1);
  };

  return (
    <div className="w-full flex flex-col items-center" data-testid="story-carousel-container">
      <div
        className="relative w-full max-w-[380px] rounded-[1.75rem] overflow-hidden shadow-2xl bg-stone-900 select-none"
        style={{ aspectRatio: "9 / 16" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={handleTap}
      >
        {/* progress segments */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5">
          {slides.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full bg-white/35 overflow-hidden">
              <div className={`h-full rounded-full bg-white transition-all duration-300 ${i <= idx ? "w-full" : "w-0"}`} />
            </div>
          ))}
        </div>

        <img
          src={mediaUrl(slide.image_url)}
          alt={`Diapositiva ${idx + 1}`}
          className="w-full h-full object-cover animate-pop"
          draggable={false}
          key={slide.image_url}
          data-testid={`story-slide-${idx}`}
        />

        {slide.locked && !paid && (
          <button
            className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-24 bg-black/10"
            onClick={(e) => { e.stopPropagation(); onUnlock && onUnlock(); }}
            data-testid="paywall-modal-trigger"
          >
            <div className="bg-white text-primary font-display font-semibold text-base px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-pop">
              <Lock className="w-4 h-4" /> Desbloquea tu historia
            </div>
          </button>
        )}

        {/* side controls */}
        <button
          onClick={(e) => { e.stopPropagation(); go(-1); }}
          disabled={idx === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/25 text-white grid place-items-center disabled:opacity-0"
          data-testid="story-slide-prev-button"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); go(1); }}
          disabled={idx === n - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/25 text-white grid place-items-center disabled:opacity-0"
          data-testid="story-slide-next-button"
          aria-label="Siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground font-medium" data-testid="story-slide-counter">
        {idx + 1} / {n}
      </p>
    </div>
  );
};
