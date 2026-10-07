import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Lock, Volume2, VolumeX, Play, Pause } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import { createMusicPlayer } from "@/lib/music";

const SLIDE_MS = 5000;

export const StoryCarousel = ({ slides = [], paid = false, onUnlock, theme = "mi_ano", music = true }) => {
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(() => localStorage.getItem("cp_music_muted") === "1");
  const [playing, setPlaying] = useState(true);
  const touchX = useRef(null);
  const playerRef = useRef(null);
  const n = slides.length;
  const slide = slides[idx];
  const blocked = !!(slide?.locked && !paid);

  // background music: starts muted-safe, resumes on first gesture (autoplay policy)
  useEffect(() => {
    if (!music || muted || !n) return;
    const p = createMusicPlayer(theme);
    if (!p) return;
    playerRef.current = p;
    p.start(1);
    const onGesture = () => p.resume();
    document.addEventListener("pointerdown", onGesture);
    return () => {
      document.removeEventListener("pointerdown", onGesture);
      p.stop();
      playerRef.current = null;
    };
  }, [music, muted, theme, n]);

  // auto-advance like Instagram stories
  useEffect(() => {
    if (!playing || n <= 1 || blocked) return;
    const t = setTimeout(() => {
      setIdx((i) => {
        if (i + 1 < n) return i + 1;
        setPlaying(false);
        return i;
      });
    }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, playing, n, blocked]);

  if (!n) return null;

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
    if (blocked) { onUnlock && onUnlock(); return; }
    go(x < rect.width / 2 ? -1 : 1);
  };

  const toggleMute = () => {
    setMuted((m) => {
      localStorage.setItem("cp_music_muted", m ? "0" : "1");
      return !m;
    });
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

        {blocked && (
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

        {/* playback controls */}
        <div className="absolute bottom-3 right-3 z-20 flex gap-2">
          {music && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className="w-9 h-9 rounded-full bg-black/35 backdrop-blur text-white grid place-items-center active:scale-90 transition-transform"
              data-testid="story-music-toggle"
              aria-label={muted ? "Activar música" : "Silenciar música"}
              title={muted ? "Activar música" : "Silenciar música"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setPlaying((p) => !p); }}
            className="w-9 h-9 rounded-full bg-black/35 backdrop-blur text-white grid place-items-center active:scale-90 transition-transform"
            data-testid="story-autoplay-toggle"
            aria-label={playing ? "Pausar" : "Reproducir"}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>

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
        {idx + 1} / {n} · {muted ? "música apagada" : "con música 🎵"}
      </p>
    </div>
  );
};
