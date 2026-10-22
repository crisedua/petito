"use client";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@/lib/router";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  PawPrint, ArrowRight, ArrowLeft, X, Check, ImagePlus, Loader2, Mic, Volume2, Sparkles, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getConfig, createTalk, uploadTalkPhoto, generateTalk, getTalk, voiceSample, activePetName } from "@/lib/api";
import { mediaUrl } from "@/lib/api";
import { InviteButton } from "@/components/InviteButton";

const QUOTES = [
  "Estoy afinando la garganta, humano...",
  "¿Qué voy a decir? Algo muy choro, obvio.",
  "Dame un segundo, me estoy peinando.",
  "Esto va a quedar pa'l WhatsApp familiar.",
];

export default function Talk() {
  const nav = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [step, setStep] = useState("photo");
  const [petName, setPetName] = useState("");
  // Already know the pet from its universe: fill its name in (still editable).
  useEffect(() => { activePetName().then((n) => n && setPetName((cur) => cur || n)); }, []);
  const [file, setFile] = useState(null);
  const [voiceId, setVoiceId] = useState("");
  const [scenario, setScenario] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("scenario") || "chistoso"; } catch { return "chistoso"; }
  });
  const [message, setMessage] = useState("");
  const [toName, setToName] = useState("");
  const [kind, setKind] = useState(() => {
    try { const k = new URLSearchParams(window.location.search).get("kind"); return ["talk", "song", "motion"].includes(k) ? k : "talk"; } catch { return "talk"; }
  }); // "talk" | "song" | "motion"
  const [songStyle, setSongStyle] = useState("cumbia");
  const [scene, setScene] = useState("viral");
  const [talkId, setTalkId] = useState(null);
  const [slug, setSlug] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getConfig().then((c) => { setCfg(c); setVoiceId(c.narration_default_voice); }).catch(() => toast.error("No se pudo cargar"));
  }, []);

  if (!cfg) return <Screen><div className="flex-1 grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Screen>;

  const start = async () => {
    if (!file) return toast.error("Sube una foto");
    setBusy(true);
    try {
      const t = await createTalk({ pet_name: petName, voice_id: voiceId, scenario, message: message.trim() || undefined, to_name: toName.trim() || undefined, kind, song_style: songStyle, scene });
      setTalkId(t.id); setSlug(t.slug);
      await uploadTalkPhoto(t.id, file.file);
      await generateTalk(t.id);
      setStep("progress");
    } catch (e) {
      if (e?.response?.status === 402) { toast.info(e.response.data?.detail || "Esta función es parte de Petito Plus+"); nav("/plus?from=video&tier=pro"); return; }
      toast.error(e?.response?.data?.detail || "No se pudo iniciar");
    } finally { setBusy(false); }
  };

  return (
    <AnimatePresence mode="wait">
      {step === "photo" && (
        <StepPhoto key="photo" nav={nav} cfg={cfg} petName={petName} setPetName={setPetName} file={file} setFile={setFile}
          onNext={() => (file ? setStep("mensaje") : toast.error("Sube una foto 🐾"))} />
      )}
      {step === "mensaje" && (
        <StepMessage key="mensaje" cfg={cfg} scenario={scenario} setScenario={setScenario} message={message} setMessage={setMessage} toName={toName} setToName={setToName}
          kind={kind} setKind={setKind} songStyle={songStyle} setSongStyle={setSongStyle} scene={scene} setScene={setScene} busy={busy}
          onBack={() => setStep("photo")} onNext={() => (kind === "talk" ? setStep("voice") : start())} />
      )}
      {step === "voice" && (
        <StepVoice key="voice" cfg={cfg} voiceId={voiceId} setVoiceId={setVoiceId}
          onBack={() => setStep("mensaje")} onNext={start} busy={busy} />
      )}
      {step === "progress" && (
        <StepProgress key="progress" talkId={talkId} kind={kind} nav={nav}
          onReady={() => nav(`/v/${slug}`)}
          onFail={() => { toast.error("No pudimos crear el video. Intenta con otra foto."); setStep(kind === "talk" ? "voice" : "mensaje"); }} />
      )}
    </AnimatePresence>
  );
}

function Screen({ children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mobile-frame">
      {children}
    </motion.div>
  );
}

function Header({ onBack, stepText }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-5">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-white border border-border grid place-items-center" data-testid="talk-back-button">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <div className="flex-1 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">{stepText}</div>
      <InviteButton />
    </div>
  );
}

function BottomBar({ children }) {
  return <div className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-[44rem] lg:max-w-[48rem] mx-auto p-4 pb-6 bg-gradient-to-t from-[#FAF6F0] via-[#FAF6F0] to-transparent">{children}</div>;
}

function StepPhoto({ nav, cfg, petName, setPetName, file, setFile, onNext }) {
  const inputRef = useRef();
  const pick = (list) => {
    const f = Array.from(list).find((x) => x.type.startsWith("image/"));
    if (f) setFile({ file: f, url: URL.createObjectURL(f) });
  };
  return (
    <Screen>
      <Header stepText="Paso 1 de 3 · La foto" onBack={() => nav("/")} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <h2 className="font-display font-bold text-2xl text-neutral-900">Haz que tu mascota hable 🗣️</h2>
        <p className="text-sm text-muted-foreground mt-1">Sube una foto de frente y con buena luz. Luego eliges qué dice y con qué voz.</p>

        <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }} data-testid="talk-photo-input" />

        {file ? (
          <div className="mt-5 relative w-full max-w-[236px] mx-auto rounded-3xl overflow-hidden bg-stone-200 border-4 border-white shadow-lg" style={{ aspectRatio: "9 / 16" }} data-testid="talk-photo-preview">
            <img src={file.url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-60" />
            <img src={file.url} alt="" className="relative w-full h-full object-contain" />
            <button onClick={() => setFile(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white grid place-items-center" data-testid="talk-photo-remove">
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        ) : (
          <button onClick={() => inputRef.current?.click()} data-testid="talk-photo-trigger"
            className="mt-5 w-full py-12 rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center gap-2 text-primary">
            <ImagePlus className="w-9 h-9" />
            <span className="font-display font-semibold">Abrir mi galería</span>
            <span className="text-xs text-muted-foreground">Toca para elegir una foto</span>
          </button>
        )}

        <label className="block mt-7 text-sm font-semibold text-neutral-700 mb-2">Nombre de tu mascota <span className="text-muted-foreground font-normal">(opcional)</span></label>
        <div className="relative">
          <PawPrint className="w-5 h-5 text-primary absolute left-4 top-1/2 -translate-y-1/2" />
          <Input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Ej: Charly, Michi..."
            maxLength={40} className="h-14 pl-12 rounded-2xl bg-white text-base" data-testid="talk-name-input" />
        </div>
      </div>
      <BottomBar>
        <Button onClick={onNext} className="w-full h-14 text-base font-display font-semibold rounded-2xl" data-testid="talk-photo-next">
          Siguiente <ArrowRight className="w-5 h-5 ml-1" />
        </Button>
      </BottomBar>
    </Screen>
  );
}

function StepMessage({ cfg, scenario, setScenario, message, setMessage, toName, setToName, kind, setKind, songStyle, setSongStyle, scene, setScene, busy, onBack, onNext }) {
  const max = cfg.talk_message_max || 160;
  const scenarios = cfg.talk_scenarios || [];
  const song = kind === "song", motion = kind === "motion";
  return (
    <Screen>
      <Header stepText={song ? "Paso 2 de 2 · La canción" : motion ? "Paso 2 de 2 · La escena" : "Paso 2 de 3 · El mensaje"} onBack={onBack} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-white border border-border" data-testid="talk-kind">
          {[["talk", "🗣️ Habla"], ["song", "🎤 Canta"], ["motion", "🎬 Se mueve"]].map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} data-testid={`talk-kind-${k}`}
              className={`relative h-11 rounded-xl font-display font-semibold text-sm transition-all ${kind === k ? "bg-primary text-white shadow" : "text-neutral-700"}`}>
              {l}
              {k !== "talk" && <span className="absolute -top-2 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-stone-900" style={{ background: "#F5C355" }}>Plus+</span>}
            </button>
          ))}
        </div>
        {motion ? (
          <>
            <h2 className="mt-5 font-display font-bold text-2xl text-neutral-900">Tu mascota en acción 🎬</h2>
            <p className="text-sm text-muted-foreground mt-1">Un video corto de tu mascota real, con su misma cara y pelaje, haciendo algo que nunca hizo. Solo Petito Plus+.</p>
            {[["Bailes", "Una coreografía real, bailada por tu mascota", true], ["Escenas", "Tu mascota en un lugar o situación", false]].map(([title, sub, dance]) => (
              <div key={title}>
                <label className="block mt-5 text-sm font-semibold text-neutral-700">{title}</label>
                <p className="text-xs text-muted-foreground mb-2">{sub}</p>
                <div className="flex flex-wrap gap-2" data-testid={dance ? "talk-dances" : "talk-scenes"}>
                  {(cfg.motion_scenes || []).filter((s) => Boolean(s.dance) === dance).map((s) => (
                    <button key={s.key} onClick={() => setScene(s.key)} data-testid={`talk-scene-${s.key}`}
                      className={`px-4 py-2.5 rounded-full border-2 font-display font-semibold text-sm transition-all ${scene === s.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-neutral-700"}`}>
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : song ? (
          <>
            <h2 className="mt-5 font-display font-bold text-2xl text-neutral-900">Su propia canción 🎶</h2>
            <p className="text-sm text-muted-foreground mt-1">Escribimos una canción original sobre tu mascota, con su nombre, su personalidad y un recuerdo de ustedes, y la canta en video. Solo Petito Plus+.</p>
            <label className="block mt-5 text-sm font-semibold text-neutral-700 mb-2">Estilo musical</label>
            <div className="flex flex-wrap gap-2" data-testid="talk-song-styles">
              {(cfg.song_styles || []).map((s) => (
                <button key={s.key} onClick={() => setSongStyle(s.key)} data-testid={`talk-song-style-${s.key}`}
                  className={`px-4 py-2.5 rounded-full border-2 font-display font-semibold text-sm transition-all ${songStyle === s.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-neutral-700"}`}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </>
        ) : (<>
        <h2 className="mt-5 font-display font-bold text-2xl text-neutral-900">¿Qué va a decir? 💬</h2>
        <p className="text-sm text-muted-foreground mt-1">Elige una ocasión y, si quieres, escríbele tú el mensaje.</p>

        {(cfg.talk_scenario_groups || [{ key: "dedicar", label: "" }]).map((g) => (
          <div key={g.key} className="mt-4" data-testid={`talk-scenarios-${g.key}`}>
            {g.label && <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-2">{g.label}</div>}
            <div className="flex flex-wrap gap-2" data-testid="talk-scenarios">
              {scenarios.filter((s) => (s.group || "dedicar") === g.key).map((s) => (
                <button key={s.key} onClick={() => setScenario(s.key)} data-testid={`talk-scenario-${s.key}`}
                  className={`px-4 py-2.5 rounded-full border-2 font-display font-semibold text-sm transition-all ${scenario === s.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-neutral-700"}`}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        </>)}

        {!motion && (<>
        <label className="block mt-7 text-sm font-semibold text-neutral-700 mb-1">
          ¿Para quién es? <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <p className="text-xs text-muted-foreground mb-2">{song ? "Escribe su nombre y la canción será para esa persona." : "Escribe su nombre y tu mascota le hablará directamente, con su personalidad y hasta un recuerdo de ustedes."}</p>
        <Input value={toName} onChange={(e) => setToName(e.target.value.slice(0, 40))} placeholder="Ej: mamá, Abuela Rosa, Tomás…" data-testid="talk-to-name"
          className="h-12 rounded-2xl bg-white" />
        </>)}

        {!song && !motion && (<>
        <label className="block mt-6 text-sm font-semibold text-neutral-700 mb-2">
          Escríbele tú el mensaje <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, max))} rows={3}
          placeholder="Ej: ¡Feliz cumpleaños, mamá! Te quiero un montón 🐾" data-testid="talk-message-input"
          className="w-full p-4 rounded-2xl bg-white border border-border outline-none font-display text-base resize-none" />
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>{message.trim() ? "Diremos exactamente esto" : "Si lo dejas vacío, la IA lo inventa según la ocasión"}</span>
          <span data-testid="talk-message-counter">{message.length}/{max}</span>
        </div>
        </>)}
      </div>
      <BottomBar>
        <Button onClick={onNext} disabled={busy} className="w-full h-14 text-base font-display font-semibold rounded-2xl" data-testid="talk-message-next">
          {busy ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Preparando...</> : song ? <>🎤 Crear su canción</> : motion ? <>🎬 Crear el video</> : <>Elegir la voz <ArrowRight className="w-5 h-5 ml-1" /></>}
        </Button>
      </BottomBar>
    </Screen>
  );
}

function VoicePreview({ voiceId }) {
  const [loading, setLoading] = useState(false);
  const play = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const { url } = await voiceSample(voiceId);
      const audio = new Audio(mediaUrl(url));
      audio.play().catch(() => {});
    } catch {
      toast.error("No se pudo reproducir la muestra");
    } finally {
      setLoading(false);
    }
  };
  return (
    <button onClick={play} data-testid={`talk-voice-play-${voiceId}`}
      className="w-9 h-9 rounded-full bg-white border border-border grid place-items-center shrink-0 active:scale-95 transition-transform">
      {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Play className="w-4 h-4 text-primary" fill="currentColor" />}
    </button>
  );
}

function StepVoice({ cfg, voiceId, setVoiceId, onBack, onNext, busy }) {
  return (
    <Screen>
      <Header stepText="Paso 3 de 3 · La voz" onBack={onBack} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <h2 className="font-display font-bold text-2xl text-neutral-900">¿Con qué voz habla? 🎙️</h2>
        <p className="text-sm text-muted-foreground mt-1">Elige el tono que más le pega a tu regalón.</p>
        <div className="mt-5 space-y-3">
          {(cfg.voices || []).map((v) => (
            <div key={v.id} onClick={() => setVoiceId(v.id)} data-testid={`talk-voice-${v.id}`}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${voiceId === v.id ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-white"}`}>
              <div className={`w-10 h-10 rounded-full grid place-items-center ${voiceId === v.id ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}><Volume2 className="w-5 h-5" /></div>
              <span className="flex-1 font-display font-semibold text-neutral-900">{v.label}</span>
              <VoicePreview voiceId={v.id} />
              {voiceId === v.id && <Check className="w-5 h-5 text-primary" />}
            </div>
          ))}
        </div>
      </div>
      <BottomBar>
        <Button onClick={onNext} disabled={busy} className="w-full h-14 text-base font-display font-semibold rounded-2xl shadow-lg shadow-primary/30" data-testid="talk-create-button">
          {busy ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Preparando...</> : <><Mic className="w-5 h-5 mr-2" /> Crear mi video</>}
        </Button>
      </BottomBar>
    </Screen>
  );
}

function StepProgress({ talkId, onReady, onFail, kind, nav }) {
  const [step, setStep] = useState("Preparando...");
  const [pct, setPct] = useState(5);
  const [quote, setQuote] = useState(0);

  useEffect(() => {
    const q = setInterval(() => setQuote((x) => (x + 1) % QUOTES.length), 2200);
    const poll = setInterval(async () => {
      try {
        const t = await getTalk(talkId);
        setStep(t.progress_step || "Creando..."); setPct(t.progress_pct || 5);
        if (t.status === "preview_ready" || t.status === "paid") { clearInterval(poll); clearInterval(q); onReady(); }
        else if (t.status === "failed") { clearInterval(poll); clearInterval(q); onFail(); }
      } catch { /* keep polling */ }
    }, 3000);
    return () => { clearInterval(poll); clearInterval(q); };
  }, [talkId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mobile-frame paw-pattern overflow-hidden" data-testid="talk-progress-screen">
      {[...Array(10)].map((_, i) => (
        <PawPrint key={i} className="floating-paw text-white/20"
          style={{ left: `${(i * 37) % 100}%`, width: 20 + (i % 3) * 14, height: 20 + (i % 3) * 14, animationDuration: `${6 + (i % 5)}s`, animationDelay: `${i * 0.7}s` }} />
      ))}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center relative z-10">
        <div className="relative w-28 h-28 mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-white/30" />
          <motion.div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent"
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
          <div className="absolute inset-0 grid place-items-center text-white font-display font-bold text-xl">{pct}%</div>
        </div>
        <motion.h2 key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="font-display font-semibold text-2xl text-white leading-snug" data-testid="talk-progress-text">
          {step}
        </motion.h2>
        <motion.p key={quote} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-script text-2xl text-white/90 mt-10">
          “{QUOTES[quote]}”
        </motion.p>
        {kind === "song" || kind === "motion" ? (
          <div className="mt-8 text-center" data-testid="talk-progress-leave">
            <p className="text-white/80 text-sm">{kind === "song" ? "Una canción toma alrededor de 1 minuto." : "Un video en movimiento toma de 1 a 3 minutos."}</p>
            <p className="text-white/70 text-xs mt-1">Puedes salir: seguimos trabajando y aparecerá en la colección de tu mascota cuando esté listo.</p>
            <button onClick={() => nav("/universo")} className="mt-4 px-5 h-11 rounded-2xl bg-white/15 text-white text-sm font-display font-semibold" data-testid="talk-progress-leave-button">Ir al universo mientras tanto</button>
          </div>
        ) : (
          <p className="text-white/70 text-xs mt-8">Crear un video toma un poco más que una foto. ¡Vale la pena!</p>
        )}
      </div>
    </motion.div>
  );
}
