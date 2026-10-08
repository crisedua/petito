import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Lock, Volume2, VolumeX, Play, Pause, Sparkles, Loader2, RotateCcw, Captions, CaptionsOff, Repeat } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import { createMusicPlayer } from "@/lib/music";

const SLIDE_MS = 5000;

export const StoryCarousel = ({ slides = [], paid = false, onUnlock, theme = "mi_ano", music = true, narration = true, bonusPending = false, petName = "" }) => {
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(() => localStorage.getItem("cp_music_muted") === "1");
  const [narrationMuted, setNarrationMuted] = useState(() => localStorage.getItem("cp_narration_muted") === "1");
  const [playing, setPlaying] = useState(true);
  const [slowHint, setSlowHint] = useState(false);
  const [started, setStarted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const touchX = useRef(null);
  const playerRef = useRef(null);
  const playingRef = useRef(playing);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  const startedRef = useRef(false);
  const justStartedRef = useRef(false);
  const nRef = useRef(0);
  const audioElRef = useRef(null);
  if (audioElRef.current === null && typeof window !== "undefined" && window.Audio) {
    audioElRef.current = new window.Audio();
    audioElRef.current.preload = "auto";
  }
  useEffect(() => () => {
    const a = audioElRef.current;
    if (a) { a.onended = null; a.pause(); }
    playerRef.current?.stop?.();
    playerRef.current = null;
  }, []);

  // after a while waiting for AI scenes, reassure the user it's still working
  useEffect(() => {
    if (!bonusPending) { setSlowHint(false); return; }
    const t = setTimeout(() => setSlowHint(true), 45000);
    return () => clearTimeout(t);
  }, [bonusPending]);

  // While AI scenes are still rendering, show a placeholder slide right before
  // the closing slide so the story doesn't look "finished" prematurely.
  const display = (() => {
    if (!bonusPending) return slides;
    const ph = { placeholder: true, kind: "pending" };
    const ci = slides.findIndex((s) => s.kind === "closing");
    return ci >= 0
      ? [...slides.slice(0, ci), ph, ...slides.slice(ci)]
      : [...slides, ph];
  })();

  const n = display.length;
  nRef.current = n;
  const slide = display[Math.min(idx, n - 1)] || {};
  const blocked = !!(slide?.locked && !paid);

  useEffect(() => {
    if (idx > n - 1) setIdx(Math.max(0, n - 1));
  }, [n, idx]);

  const narrateOn = narration && !narrationMuted;
  const audioOf = (s) => (s && !s.placeholder && s.audio_url && narrateOn) ? s.audio_url : null;
  const slideAudio = audioOf(slide);

  const narrationEnded = () => {
    playerRef.current?.setVolume?.(1);
    if (playingRef.current) setIdx((i) => (i + 1 < nRef.current ? i + 1 : (setPlaying(false), i)));
  };

  const ensureMusic = () => {
    if (!music || muted) return;
    if (!playerRef.current) {
      const p = createMusicPlayer(theme);
      playerRef.current = p;
      p?.start(1);
    }
    playerRef.current?.resume?.();
  };

  const playAudioEl = (url) => {
    const a = audioElRef.current;
    if (!a || !url) return;
    a.pause();
    a.src = mediaUrl(url);
    a.currentTime = 0;
    playerRef.current?.setVolume?.(0.28);
    a.onended = narrationEnded;
    a.onerror = narrationEnded;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  };

  const checkSound = () => {
    const musicOn = music && !muted;
    const musicRunning = !musicOn || !!playerRef.current?.running;
    const narrFirst = audioOf(display[0]);
    const narrPlaying = !narrFirst || (audioElRef.current && !audioElRef.current.paused);
    setSoundBlocked(!(musicRunning && narrPlaying));
  };

  // start everything on the first explicit tap (satisfies browser autoplay policy)
  const startPlayback = (e) => {
    e && e.stopPropagation();
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    setIdx(0);
    setPlaying(true);
    ensureMusic();
    const first = audioOf(display[0]);
    if (first) { justStartedRef.current = true; playAudioEl(first); }
    setTimeout(checkSound, 700);
  };

  const activateSound = (e) => {
    e && e.stopPropagation();
    ensureMusic();
    const a = audioElRef.current;
    if (a && a.paused && slideAudio) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
    setTimeout(checkSound, 500);
  };

  // narration: read the current slide's phrase aloud; music ducks while it speaks
  useEffect(() => {
    const a = audioElRef.current;
    if (!a || !slideAudio || !started) return;
    if (justStartedRef.current) {
      justStartedRef.current = false;  // slide 0 audio was already launched in the tap gesture
      const safety = setTimeout(() => { if (playingRef.current) narrationEnded(); }, 16000);
      return () => clearTimeout(safety);
    }
    playAudioEl(slideAudio);
    const safety = setTimeout(() => { if (playingRef.current) narrationEnded(); }, 16000);
    return () => {
      clearTimeout(safety);
      a.onended = null; a.onerror = null; a.pause();
      playerRef.current?.setVolume?.(1);
    };
  }, [idx, slideAudio, started]);

  // advance: narration drives it when present; otherwise a timer. Also syncs pause/play.
  useEffect(() => {
    if (!started || n <= 1 || blocked) return;
    const a = audioElRef.current;
    if (slideAudio) {
      if (playing) { const p = a?.play(); if (p && p.catch) p.catch(() => {}); }
      else { a?.pause(); }
      return;
    }
    if (!playing) return;
    const t = setTimeout(() => setIdx((i) => (i + 1 < n ? i + 1 : (setPlaying(false), i))), SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, playing, n, blocked, slideAudio, started]);

  if (!n) return null;

  const atEnd = idx >= n - 1;
  const finished = atEnd && !playing && !blocked && started;

  const go = (dir) => setIdx((i) => Math.min(n - 1, Math.max(0, i + dir)));

  const replay = () => { setIdx(0); setPlaying(true); };

  const togglePlay = () => {
    if (!playing && atEnd) { replay(); return; }
    setPlaying((p) => !p);
  };

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  const handleTap = (e) => {
    if (!started) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (blocked) { onUnlock && onUnlock(); return; }
    go(x < rect.width / 2 ? -1 : 1);
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("cp_music_muted", next ? "1" : "0");
      if (next) { playerRef.current?.stop?.(); playerRef.current = null; }
      else if (startedRef.current) { ensureMusic(); setTimeout(checkSound, 400); }
      return next;
    });
  };

  const toggleNarration = () => {
    setNarrationMuted((m) => {
      localStorage.setItem("cp_narration_muted", m ? "0" : "1");
      return !m;
    });
  };

  const repeatPhrase = (e) => {
    e && e.stopPropagation();
    const a = audioElRef.current;
    if (a && slideAudio) {
      a.currentTime = 0;
      playerRef.current?.setVolume?.(0.28);
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    }
  };

  return (
    <div className="w-full flex flex-col items-center" data-testid="story-carousel-container">
      <div
        className="relative h-[58vh] max-h-[600px] w-auto max-w-full aspect-[9/16] rounded-[1.75rem] overflow-hidden shadow-2xl bg-stone-900 select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={handleTap}
      >
        {/* progress segments */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5">
          {display.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full bg-white/35 overflow-hidden">
              <div className={`h-full rounded-full bg-white transition-all duration-300 ${i <= idx ? "w-full" : "w-0"}`} />
            </div>
          ))}
        </div>

        {slide.placeholder ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-8 bg-gradient-to-br from-primary to-accent" data-testid="story-slide-pending">
            <div className="relative mb-5">
              <Sparkles className="w-12 h-12 text-white/90" />
              <Loader2 className="w-6 h-6 text-white absolute -right-2 -bottom-1 animate-spin" />
            </div>
            <p className="font-display font-bold text-xl text-white leading-snug">
              Pintando escenas mágicas{petName ? ` de ${petName}` : ""}...
            </p>
            <p className="text-sm text-white/85 mt-2">Aparecerán aquí solitas en unos segundos ✨</p>
            {slowHint && (
              <p className="text-xs text-white/75 mt-4 max-w-[240px]">La magia IA a veces tarda un par de minutos... ¡ya casi! 🐾</p>
            )}
          </div>
        ) : (
          <img
            src={mediaUrl(slide.image_url)}
            alt={`Diapositiva ${idx + 1}`}
            className="w-full h-full object-cover animate-pop"
            draggable={false}
            key={slide.image_url}
            data-testid={`story-slide-${idx}`}
          />
        )}

        {finished && (
          <div className="absolute inset-x-0 bottom-16 z-20 flex justify-center animate-pop">
            <button
              onClick={(e) => { e.stopPropagation(); replay(); }}
              className="bg-white text-primary font-display font-semibold text-sm px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2"
              data-testid="story-replay-button"
            >
              <RotateCcw className="w-4 h-4" /> Ver de nuevo
            </button>
          </div>
        )}

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

        {/* tap-to-play gate (browser autoplay policy needs a user gesture) */}
        {!started && (
          <button
            onClick={startPlayback}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/45 backdrop-blur-[2px]"
            data-testid="story-start-button"
            aria-label="Tocar para reproducir con sonido"
          >
            <span className="w-20 h-20 rounded-full bg-white grid place-items-center shadow-xl animate-pop">
              <Play className="w-9 h-9 text-primary ml-1" />
            </span>
            <span className="bg-white text-primary font-display font-semibold text-sm px-5 py-2.5 rounded-full shadow-lg">
              Tocar para reproducir con sonido
            </span>
          </button>
        )}

        {/* fallback if the browser silenced the audio after start */}
        {started && soundBlocked && (
          <button
            onClick={activateSound}
            className="absolute top-9 left-1/2 -translate-x-1/2 z-30 bg-white text-primary font-display font-semibold text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 animate-pop"
            data-testid="story-activate-sound"
          >
            <Volume2 className="w-4 h-4" /> Activar sonido
          </button>
        )}

        {/* playback controls */}
        <div className="absolute bottom-3 right-3 z-20 flex gap-2">
          {narration && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleNarration(); }}
              className="w-9 h-9 rounded-full bg-black/35 backdrop-blur text-white grid place-items-center active:scale-90 transition-transform"
              data-testid="story-narration-toggle"
              aria-label={narrationMuted ? "Activar narración" : "Silenciar narración"}
              title={narrationMuted ? "Activar narración" : "Silenciar narración"}
            >
              {narrationMuted ? <CaptionsOff className="w-4 h-4" /> : <Captions className="w-4 h-4" />}
            </button>
          )}
          {slideAudio && (
            <button
              onClick={repeatPhrase}
              className="w-9 h-9 rounded-full bg-black/35 backdrop-blur text-white grid place-items-center active:scale-90 transition-transform"
              data-testid="story-repeat-phrase"
              aria-label="Repetir la frase"
              title="Repetir la frase"
            >
              <Repeat className="w-4 h-4" />
            </button>
          )}
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
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-9 h-9 rounded-full bg-black/35 backdrop-blur text-white grid place-items-center active:scale-90 transition-transform"
            data-testid="story-autoplay-toggle"
            aria-label={playing ? "Pausar" : (atEnd ? "Ver de nuevo" : "Reproducir")}
          >
            {playing ? <Pause className="w-4 h-4" /> : (atEnd ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />)}
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
        {!started
          ? "Toca para reproducir con sonido 🔊"
          : `${idx + 1} / ${n} · ${narrateOn ? "con voz 🎙️" : (muted ? "música apagada" : "con música 🎵")}`}
      </p>
    </div>
  );
};
