import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  PawPrint, ArrowRight, ArrowLeft, X, Check, ImagePlus, Loader2, Mic, Volume2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getConfig, createTalk, uploadTalkPhoto, generateTalk, getTalk,
} from "@/lib/api";
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
  const [file, setFile] = useState(null);
  const [voiceId, setVoiceId] = useState("");
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
      const t = await createTalk({ pet_name: petName, voice_id: voiceId });
      setTalkId(t.id); setSlug(t.slug);
      await uploadTalkPhoto(t.id, file.file);
      await generateTalk(t.id);
      setStep("progress");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo iniciar");
    } finally { setBusy(false); }
  };

  return (
    <AnimatePresence mode="wait">
      {step === "photo" && (
        <StepPhoto key="photo" nav={nav} cfg={cfg} petName={petName} setPetName={setPetName} file={file} setFile={setFile}
          onNext={() => (file ? setStep("voice") : toast.error("Sube una foto 🐾"))} />
      )}
      {step === "voice" && (
        <StepVoice key="voice" cfg={cfg} voiceId={voiceId} setVoiceId={setVoiceId}
          onBack={() => setStep("photo")} onNext={start} busy={busy} />
      )}
      {step === "progress" && (
        <StepProgress key="progress" talkId={talkId}
          onReady={() => nav(`/v/${slug}`)}
          onFail={() => { toast.error("No pudimos crear el video. Intenta con otra foto."); setStep("voice"); }} />
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
  return <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 pb-6 bg-gradient-to-t from-[#FAF6F0] via-[#FAF6F0] to-transparent">{children}</div>;
}

function StepPhoto({ nav, cfg, petName, setPetName, file, setFile, onNext }) {
  const inputRef = useRef();
  const pick = (list) => {
    const f = Array.from(list).find((x) => x.type.startsWith("image/"));
    if (f) setFile({ file: f, url: URL.createObjectURL(f) });
  };
  return (
    <Screen>
      <Header stepText="Paso 1 de 2 · La foto" onBack={() => nav("/")} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <h2 className="font-display font-bold text-2xl text-neutral-900">Haz que tu mascota hable 🗣️</h2>
        <p className="text-sm text-muted-foreground mt-1">Sube una foto de frente y con buena luz. La IA le inventa una frase chistosa.</p>

        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }} data-testid="talk-photo-input" />

        {file ? (
          <div className="mt-5 relative w-full rounded-3xl overflow-hidden bg-stone-200 border-4 border-white shadow-lg" style={{ aspectRatio: "9 / 16", maxHeight: 420 }} data-testid="talk-photo-preview">
            <img src={file.url} alt="" className="w-full h-full object-cover" />
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
          Elegir la voz <ArrowRight className="w-5 h-5 ml-1" />
        </Button>
      </BottomBar>
    </Screen>
  );
}

function StepVoice({ cfg, voiceId, setVoiceId, onBack, onNext, busy }) {
  return (
    <Screen>
      <Header stepText="Paso 2 de 2 · La voz" onBack={onBack} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <h2 className="font-display font-bold text-2xl text-neutral-900">¿Con qué voz habla? 🎙️</h2>
        <p className="text-sm text-muted-foreground mt-1">Elige el tono que más le pega a tu regalón.</p>
        <div className="mt-5 space-y-3">
          {(cfg.voices || []).map((v) => (
            <button key={v.id} onClick={() => setVoiceId(v.id)} data-testid={`talk-voice-${v.id}`}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${voiceId === v.id ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-white"}`}>
              <div className={`w-10 h-10 rounded-full grid place-items-center ${voiceId === v.id ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}><Volume2 className="w-5 h-5" /></div>
              <span className="flex-1 font-display font-semibold text-neutral-900">{v.label}</span>
              {voiceId === v.id && <Check className="w-5 h-5 text-primary" />}
            </button>
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

function StepProgress({ talkId, onReady, onFail }) {
  const [step, setStep] = useState("Preparando...");
  const [pct, setPct] = useState(5);
  const [quote, setQuote] = useState(0);

  useEffect(() => {
    const q = setInterval(() => setQuote((x) => (x + 1) % QUOTES.length), 2200);
    const poll = setInterval(async () => {
      try {
        const t = await getTalk(talkId);
        setStep(t.progress_step || "Creando..."); setPct(t.progress_pct || 5);
        if (t.status === "preview_ready") { clearInterval(poll); clearInterval(q); onReady(); }
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
        <p className="text-white/70 text-xs mt-8">Crear un video toma un poco más que una foto. ¡Vale la pena!</p>
      </div>
    </motion.div>
  );
}
