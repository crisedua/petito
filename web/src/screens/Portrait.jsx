"use client";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@/lib/router";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  PawPrint, ArrowRight, ArrowLeft, X, Check, ImagePlus, Loader2, Crown,
  Download, Share2, Copy, Gift, Lock, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  getConfig, createPortrait, uploadPortraitPhoto, generatePortrait, getPortrait,
  portraitCheckout, mediaUrl, activePetName, portraitSamples } from "@/lib/api";
import { InviteButton } from "@/components/InviteButton";

// Styles that ship with a built-in sample at /portrait-styles/<style>.jpg (others show their emoji until an admin generates one in Muestras).
const BUILTIN_SAMPLES = ["polaroid", "revista", "antigua", "renacentista", "victoriano", "halloween", "vampiro", "bruja", "calabazas", "casa_embrujada"];
const STYLE_IMG = Object.fromEntries(BUILTIN_SAMPLES.map((k) => [k, `/portrait-styles/${k}.jpg`]));
// Little drawn previews of each frame (no image needed).
const FRAME_SWATCH = {
  dorado: { outer: "linear-gradient(135deg,#7a5418,#f3d27a 30%,#a9781f 55%,#f6dd8c 80%,#6e4a12)" },
  madera: { outer: "linear-gradient(135deg,#3b2414,#6d4527 35%,#4a2d18 60%,#7a5132 85%,#331e10)", lip: "#c9a24a" },
  negro_gotico: { outer: "linear-gradient(135deg,#0d0d10,#3a3a44 30%,#121216 55%,#5a5a66 80%,#0b0b0d)", lip: "#9aa0ab" },
  plata: { outer: "linear-gradient(135deg,#6f7378,#eef1f4 30%,#9da3aa 55%,#f4f6f8 80%,#6a6e73)" },
  sin_marco: { none: true },
};
function FrameSwatch({ k }) {
  const f = FRAME_SWATCH[k] || FRAME_SWATCH.dorado;
  if (f.none) return <div className="w-full h-full rounded-md border-2 border-dashed border-stone-300 bg-gradient-to-b from-stone-500 to-stone-800" />;
  return (
    <div className="w-full h-full rounded-md p-[5px]" style={{ background: f.outer }}>
      <div className="w-full h-full rounded-sm bg-gradient-to-b from-stone-600 to-stone-900" style={f.lip ? { boxShadow: `inset 0 0 0 1.5px ${f.lip}` } : undefined} />
    </div>
  );
}

const QUOTES = [
  "Me estoy poniendo la mejor pose, aguanta...",
  "Un poquito de óleo por aquí, otro por allá.",
  "Voy a quedar más elegante que nunca, humano.",
  "Esto merece colgarse en el living, créeme.",
];

export default function Portrait() {
  const nav = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [step, setStep] = useState("photo");
  const [petName, setPetName] = useState("");
  // Already know the pet from its universe: fill its name in (still editable).
  useEffect(() => { activePetName().then((n) => n && setPetName((cur) => cur || n)); }, []);
  const [file, setFile] = useState(null);
  const [style, setStyle] = useState("");
  const [frame, setFrame] = useState("");
  const [frameTouched, setFrameTouched] = useState(false);
  const [samples, setSamples] = useState({});
  useEffect(() => { portraitSamples().then(setSamples).catch(() => {}); }, []);
  // Picking a style picks its usual frame, unless the person already chose a frame.
  const pickStyle = (k) => {
    setStyle(k);
    if (!frameTouched) setFrame(cfg?.portrait_styles?.find((x) => x.key === k)?.default_frame || "dorado");
  };
  const pickFrame = (k) => { setFrame(k); setFrameTouched(true); };
  const [gift, setGift] = useState({ enabled: false, to: "", from: "", message: "" });
  const [caption, setCaption] = useState("");
  const [portraitId, setPortraitId] = useState(null);
  const [slug, setSlug] = useState(null);
  const [portrait, setPortrait] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getConfig().then((c) => {
      setCfg(c);
      // One tap less: the style comes preselected (from the link, or the house style).
      const wanted = new URLSearchParams(window.location.search).get("style");
      const keys = (c.portrait_styles || []).map((x) => x.key);
      const pick = keys.includes(wanted) ? wanted : keys.includes("renacentista") ? "renacentista" : keys[0];
      if (pick) { setStyle(pick); setFrame(c.portrait_styles.find((x) => x.key === pick)?.default_frame || "dorado"); }
    }).catch(() => toast.error("No se pudo cargar la configuración"));
  }, []);

  if (!cfg) return <Screen><div className="flex-1 grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Screen>;

  const price = new Intl.NumberFormat("es-CL").format(cfg.portrait_price_clp || 2990);

  const start = async () => {
    if (!style) return toast.error("Elige un estilo");
    if (!file) return toast.error("Sube una foto de tu mascota");
    setBusy(true);
    try {
      const p = await createPortrait({
        pet_name: petName, style, frame: frame || undefined, caption: caption.trim() || undefined,
        gift_enabled: gift.enabled, gift_to: gift.to, gift_from: gift.from, gift_message: gift.message,
      });
      setPortraitId(p.id); setSlug(p.slug);
      await uploadPortraitPhoto(p.id, file.file);
      await generatePortrait(p.id);
      setStep("progress");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo iniciar");
    } finally { setBusy(false); }
  };

  return (
    <AnimatePresence mode="wait">
      {step === "photo" && (
        <StepPhoto key="photo" nav={nav} cfg={cfg} petName={petName} setPetName={setPetName} file={file} setFile={setFile}
          onNext={() => (file ? setStep("style") : toast.error("Sube una foto de tu mascota 🐾"))} />
      )}
      {step === "style" && (
        <StepStyle key="style" cfg={cfg} style={style} setStyle={pickStyle} gift={gift} setGift={setGift}
          frame={frame} setFrame={pickFrame} samples={samples} caption={caption} setCaption={setCaption}
          onBack={() => setStep("photo")} onNext={start} busy={busy} />
      )}
      {step === "progress" && (
        <StepProgress key="progress" portraitId={portraitId}
          onReady={(p) => { setPortrait(p); setStep("result"); }}
          onFail={(p) => { toast.error("Ups, no pudimos pintar el retrato. Intenta con otra foto."); setStep("style"); }} />
      )}
      {step === "result" && (
        <StepResult key="result" portrait={portrait} setPortrait={setPortrait} portraitId={portraitId} slug={slug} cfg={cfg} price={price} nav={nav} />
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
      {onBack ? (
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white border border-border grid place-items-center" data-testid="portrait-back-button">
          <ArrowLeft className="w-4 h-4" />
        </button>
      ) : <div className="w-9" />}
      <div className="flex-1 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">{stepText}</div>
      <InviteButton />
    </div>
  );
}

function BottomBar({ children }) {
  return <div className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-[44rem] lg:max-w-[48rem] mx-auto p-4 pb-6 bg-gradient-to-t from-[#FAF6F0] via-[#FAF6F0] to-transparent">{children}</div>;
}

/* ---------------- Step: photo + name ---------------- */
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
        <h2 className="font-display font-bold text-2xl text-neutral-900">Sube una foto de tu mascota 👑</h2>
        <p className="text-sm text-muted-foreground mt-1">Una sola foto, de frente y con buena luz. La IA hará el resto.</p>

        <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }} data-testid="portrait-photo-input" />

        {file ? (
          <div className="mt-5 relative w-full rounded-3xl overflow-hidden bg-stone-200 border-4 border-white shadow-lg" style={{ aspectRatio: "3 / 4" }} data-testid="portrait-photo-preview">
            <img src={file.url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-60" />
            <img src={file.url} alt="" className="relative w-full h-full object-contain" />
            <button onClick={() => setFile(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white grid place-items-center" data-testid="portrait-photo-remove">
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        ) : (
          <button onClick={() => inputRef.current?.click()} data-testid="portrait-photo-trigger"
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
            maxLength={40} className="h-14 pl-12 rounded-2xl bg-white text-base" data-testid="portrait-name-input" />
        </div>

        <p className="mt-6 text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Tu foto es privada y se borra en {cfg?.retention_days || 7} días.
        </p>
      </div>
      <BottomBar>
        <Button onClick={onNext} className="w-full h-14 text-base font-display font-semibold rounded-2xl" data-testid="portrait-photo-next">
          Elegir el estilo <ArrowRight className="w-5 h-5 ml-1" />
        </Button>
      </BottomBar>
    </Screen>
  );
}

/* ---------------- Step: style + gift ---------------- */
function StepStyle({ cfg, style, setStyle, gift, setGift, onBack, onNext, busy, frame, setFrame, samples, caption, setCaption }) {
  const styleDef = (k) => (cfg.portrait_styles || []).find((s) => s.key === k);
  // Real sample for this style in this frame, if an admin generated one.
  const exactSample = (k, f) => samples?.[k]?.frames?.[f] || null;
  // Best picture for the style: its default-frame sample, its chosen sample, or the built-in one.
  const styleSample = (k) => exactSample(k, styleDef(k)?.has_frame === false ? "sin_marco" : styleDef(k)?.default_frame) || samples?.[k]?.default || STYLE_IMG[k] || null;
  const hasFrame = (k) => styleDef(k)?.has_frame !== false;
  const preview = style ? (hasFrame(style) ? exactSample(style, frame) : exactSample(style, "sin_marco")) || styleSample(style) : null;
  const previewIsExact = Boolean(style && exactSample(style, frame));
  const frameLabel = (cfg.portrait_frames || []).find((f) => f.key === frame)?.label;
  return (
    <Screen>
      <Header stepText="Paso 2 de 2 · El estilo" onBack={onBack} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <h2 className="font-display font-bold text-2xl text-neutral-900">¿Cómo quieres el retrato? 🎨</h2>
        {[["foto", "Tu foto, mejorada", "Sigue siendo su foto real: solo le agregamos algo."], ["ilustracion", "Ilustraciones", "Un dibujo de tu mascota en papel, con su nombre y una frase."], ["pintura", "Pinturas", "La IA la convierte en una pintura con marco."]].map(([g, title, sub]) => (
        <div key={g} className="mt-5" data-testid={`portrait-group-${g}`}>
          <div className="font-display font-bold text-neutral-900">{title}</div>
          <div className="text-xs text-muted-foreground mb-2">{sub}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(cfg.portrait_styles || []).filter((s) => (s.group || "pintura") === g).map((s) => (
            <button key={s.key} onClick={() => setStyle(s.key)} data-testid={`portrait-style-${s.key}`}
              className={`relative w-full flex items-center gap-4 p-3 rounded-2xl border-2 text-left transition-all ${style === s.key ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-white"}`}>
              <div className="w-16 h-20 rounded-xl overflow-hidden bg-stone-200 shrink-0">
                {styleSample(s.key) ? <img src={styleSample(s.key)} alt={s.label} className="w-full h-full object-cover" />
                  : <div className="w-full h-full grid place-items-center text-3xl bg-gradient-to-b from-stone-700 to-stone-900">{s.emoji}</div>}
              </div>
              <div className="flex-1">
                <div className="font-display font-semibold text-neutral-900">{s.emoji} {s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
              {style === s.key && <div className="w-6 h-6 rounded-full bg-primary grid place-items-center shrink-0"><Check className="w-4 h-4 text-white" /></div>}
            </button>
          ))}
        </div>
        </div>
        ))}

        {style && (cfg.portrait_frames || []).length > 0 && styleDef(style)?.has_frame !== false && (
          <div className="mt-6" data-testid="portrait-frames">
            <div className="font-display font-semibold text-neutral-900">Así se verá</div>
            <div className="mt-2 mx-auto w-full max-w-[260px] rounded-2xl overflow-hidden bg-stone-200 shadow-md" style={{ aspectRatio: "3 / 4" }} data-testid="portrait-preview">
              {preview ? <img key={preview} src={preview} alt={`${styleDef(style)?.label} · ${frameLabel}`} className="w-full h-full object-cover" />
                : <div className="w-full h-full grid place-items-center text-5xl">{styleDef(style)?.emoji}</div>}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground" data-testid="portrait-preview-caption">
              {styleDef(style)?.label} · {frameLabel}
              {!previewIsExact && " · ejemplo referencial: tu retrato saldrá con el marco elegido"}
            </p>

            <div className="mt-4 font-display font-semibold text-neutral-900">Marco</div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {cfg.portrait_frames.map((f) => (
                <button key={f.key} onClick={() => setFrame(f.key)} data-testid={`portrait-frame-${f.key}`} title={f.desc}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${frame === f.key ? "border-primary bg-primary/10" : "border-border bg-white"}`}>
                  <div className="w-full rounded-md overflow-hidden" style={{ aspectRatio: "3 / 4" }}>
                    {exactSample(style, f.key) ? <img src={exactSample(style, f.key)} alt={f.label} className="w-full h-full object-cover" /> : <FrameSwatch k={f.key} />}
                  </div>
                  <span className="text-[10px] leading-tight font-semibold text-neutral-700 text-center">{f.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{cfg.portrait_frames.find((f) => f.key === frame)?.desc}</p>
          </div>
        )}

        {style && ["foto", "ilustracion"].includes(styleDef(style)?.group) && (
          <div className="mt-6 bg-white rounded-2xl border border-border p-4" data-testid="portrait-caption-card">
            <div className="font-display font-semibold text-neutral-900">Texto en el retrato</div>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              {styleDef(style)?.group === "ilustracion" ? "Va bajo el dibujo, junto a su nombre. Ej: “el estirón de las 7”, “jefe de la casa”." : "Va en la placa con su nombre. Si lo dejas vacío, le inventamos un título chileno."}
            </p>
            <Input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 60))} placeholder={styleDef(style)?.group === "ilustracion" ? "Una frase corta (opcional)" : "Ej: Duquesa de Viña (opcional)"} className="h-12 rounded-xl bg-background" data-testid="portrait-caption" />
          </div>
        )}

        <div className="mt-6 bg-white rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <span className="font-display font-semibold text-neutral-900">Es un regalo</span>
            </div>
            <Switch checked={gift.enabled} onCheckedChange={(v) => setGift((g) => ({ ...g, enabled: v }))} data-testid="portrait-gift-toggle" />
          </div>
          <AnimatePresence>
            {gift.enabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <p className="text-xs text-muted-foreground mt-2 mb-3">Le aparecerá una dedicatoria al abrir el enlace de regalo.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={gift.to} onChange={(e) => setGift((g) => ({ ...g, to: e.target.value }))} placeholder="Para:" maxLength={60} className="h-12 rounded-xl bg-background" data-testid="portrait-gift-to" />
                  <Input value={gift.from} onChange={(e) => setGift((g) => ({ ...g, from: e.target.value }))} placeholder="De:" maxLength={60} className="h-12 rounded-xl bg-background" data-testid="portrait-gift-from" />
                </div>
                <Textarea value={gift.message} onChange={(e) => setGift((g) => ({ ...g, message: e.target.value }))} placeholder="Un mensaje cariñoso..." maxLength={280} className="mt-2 rounded-xl bg-background resize-none" rows={3} data-testid="portrait-gift-message" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <BottomBar>
        <Button onClick={onNext} disabled={busy || !style} className="w-full h-14 text-base font-display font-semibold rounded-2xl shadow-lg shadow-primary/30" data-testid="portrait-create-button">
          {busy ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Preparando...</> : <><Crown className="w-5 h-5 mr-2" /> Crear mi retrato</>}
        </Button>
      </BottomBar>
    </Screen>
  );
}

/* ---------------- Step: progress ---------------- */
function StepProgress({ portraitId, onReady, onFail }) {
  const [step, setStep] = useState("Preparando...");
  const [pct, setPct] = useState(5);
  const [quote, setQuote] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const q = setInterval(() => setQuote((x) => (x + 1) % QUOTES.length), 2200);
    const slowTimer = setTimeout(() => setSlow(true), 90000);
    const poll = setInterval(async () => {
      try {
        const p = await getPortrait(portraitId);
        setStep(p.progress_step || "Pintando...");
        setPct(p.progress_pct || 5);
        if (p.status === "preview_ready" || p.status === "paid") { clearInterval(poll); clearInterval(q); onReady(p); }
        else if (p.status === "failed") { clearInterval(poll); clearInterval(q); onFail(p); }
      } catch { /* keep polling */ }
    }, 2500);
    return () => { clearInterval(poll); clearInterval(q); clearTimeout(slowTimer); };
  }, [portraitId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mobile-frame paw-pattern overflow-hidden" data-testid="portrait-progress-screen">
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
          className="font-display font-semibold text-2xl text-white leading-snug" data-testid="portrait-progress-text">
          {step}
        </motion.h2>
        <motion.p key={quote} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-script text-2xl text-white/90 mt-10">
          “{QUOTES[quote]}”
        </motion.p>
        {slow && (
          <p className="text-white/80 text-sm mt-6" data-testid="portrait-slow-hint">
            Está tomando un poco más de lo normal, ya casi queda 🎨
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Shares the before-and-after image itself where the browser allows it (WhatsApp, Instagram); otherwise the link. */
export async function shareBeforeAfter(imgUrl, petName, link) {
  const text = `Mira el antes y después de ${petName || "mi mascota"} en Petito 👑🐾`;
  try {
    if (imgUrl && navigator.canShare) {
      const blob = await (await fetch(imgUrl)).blob();
      if (blob.size > 1000) {
        const file = new File([blob], `petito-${petName || "mascota"}-antes-despues.jpg`, { type: "image/jpeg" });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Petito", text: `${text} ${link}` }); return; }
      }
    }
    if (navigator.share) { await navigator.share({ title: "Petito", text, url: link }); return; }
  } catch { return; /* cancelled */ }
  window.open(imgUrl || `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, "_blank");
}

/** After a result, one concrete next thing to make (keeps the momentum going). */
function NextStep({ nav, name }) {
  const who = name || "tu mascota";
  return (
    <button onClick={() => nav("/hablar")} data-testid="portrait-next-step"
      className="mt-6 w-full flex items-center gap-3.5 p-4 rounded-2xl border text-left" style={{ background: "#FBEEE4", borderColor: "rgba(0,0,0,0.04)" }}>
      <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0 bg-white/70 text-primary"><Sparkles className="w-6 h-6" /></div>
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wide text-primary">Siguiente</div>
        <div className="font-display font-bold text-neutral-900">Ahora haz que {who} te hable</div>
        <div className="text-xs text-muted-foreground mt-0.5">Un videomensaje con su voz, en un minuto</div>
      </div>
      <ArrowRight className="w-5 h-5 text-primary" />
    </button>
  );
}

/* ---------------- Step: result (preview + paywall + gift) ---------------- */
function StepResult({ portrait, setPortrait, portraitId, slug, cfg, price, nav }) {
  const [busy, setBusy] = useState(false);
  const paid = portrait?.paid;
  const giftUrl = `${window.location.origin}/r/${slug}`;
  const resultUrl = paid ? mediaUrl(portrait?.clean_url) : mediaUrl(portrait?.preview_url);
  const [showOriginal, setShowOriginal] = useState(false);
  const imgUrl = showOriginal && portrait?.photo_url ? mediaUrl(portrait.photo_url) : resultUrl;

  const refresh = async () => setPortrait(await getPortrait(portraitId));

  const autoTried = useRef(false);
  useEffect(() => {
    if (!portraitId || paid || autoTried.current) return;
    autoTried.current = true;
    portraitCheckout(portraitId, true).then((r) => { if (r?.already_paid || r?.mode === "plus") refresh(); }).catch(() => {});
  }, [portraitId, paid]);

  const unlock = async () => {
    setBusy(true);
    try {
      const res = await portraitCheckout(portraitId);
      if (res.already_paid || res.mode === "plus") {
        await refresh();
        toast.success("¡Retrato desbloqueado en HD! 🎉");
      } else {
        nav("/plus?from=portrait");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo desbloquear");
    } finally { setBusy(false); }
  };

  const downloadImage = async (clean) => {
    const url = clean ? mediaUrl(portrait?.clean_url) : mediaUrl(portrait?.preview_url);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `petito-retrato-${portrait?.pet_name || "mascota"}${clean ? "-hd" : ""}.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { toast.error("No se pudo descargar"); }
  };

  const shareCompare = () => shareBeforeAfter(mediaUrl(portrait?.compare_url), portrait?.pet_name, giftUrl);
  const share = async () => {
    const text = portrait?.gift_enabled
      ? `Te tengo un regalo de Petito 🎁🐾`
      : `¡Mira el retrato de realeza de ${portrait?.pet_name || "mi mascota"} en Petito! 👑🐾`;
    if (navigator.share) {
      try { await navigator.share({ title: "Petito", text, url: giftUrl }); } catch { /* cancelled */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + giftUrl)}`, "_blank");
    }
  };

  return (
    <Screen>
      <Header stepText={paid ? "¡Tu retrato HD!" : "Tu retrato"} onBack={() => nav("/")} />
      <div className="flex-1 px-5 pt-3 pb-44 overflow-y-auto no-scrollbar">
        {portrait?.gift_enabled && portrait?.gift_to && (
          <p className="text-center font-script text-2xl text-primary mb-1" data-testid="portrait-dedication">
            Para {portrait.gift_to}{portrait.gift_from ? `, de ${portrait.gift_from}` : ""}
          </p>
        )}
        <div className="relative w-full rounded-3xl overflow-hidden bg-stone-900 border-4 border-white shadow-2xl mx-auto" style={{ aspectRatio: "3 / 4", maxWidth: 360 }} data-testid="portrait-result-image">
          {imgUrl && <img src={imgUrl} alt="Retrato" className="w-full h-full object-cover" />}
        </div>

        {portrait?.gift_enabled && portrait?.gift_message && (
          <p className="mt-3 text-center text-sm text-neutral-700 italic">“{portrait.gift_message}”</p>
        )}

        {paid ? (
          <div className="mt-6 grid grid-cols-1 gap-3" data-testid="portrait-share-hub">
            <Button onClick={() => downloadImage(true)} className="h-14 rounded-2xl font-semibold" data-testid="portrait-download-hd">
              <Download className="w-5 h-5 mr-2" /> Descargar en HD
            </Button>
            {portrait?.compare_url && (
              <Button onClick={shareCompare} variant="secondary" className="h-12 rounded-2xl font-semibold bg-white border border-border" data-testid="portrait-share-compare-hd">
                <Share2 className="w-4 h-4 mr-2" /> Compartir el antes y después
              </Button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={share} className="h-14 rounded-2xl font-semibold bg-[#25D366] hover:bg-[#1da851]" data-testid="portrait-share-button">
                <Share2 className="w-5 h-5 mr-2" /> Compartir
              </Button>
              <Button onClick={() => { navigator.clipboard.writeText(giftUrl); toast.success(portrait?.gift_enabled ? "Enlace de regalo copiado 🎁" : "Enlace copiado"); }} variant="secondary" className="h-14 rounded-2xl font-semibold bg-white border border-border" data-testid="portrait-copy-link">
                <Copy className="w-5 h-5 mr-2" /> {portrait?.gift_enabled ? "Enlace regalo" : "Copiar enlace"}
              </Button>
            </div>
            <button onClick={() => nav("/retrato")} className="mt-1 text-sm text-primary font-semibold flex items-center justify-center gap-1">
              <Crown className="w-4 h-4" /> Crear otro retrato
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 text-center">
              <p className="font-display font-semibold text-lg text-neutral-900">Así quedó tu mascota 👑</p>
              <p className="text-sm text-muted-foreground mt-1">Descárgala en alta resolución, lista para imprimir, con Petito Plus.</p>
            </div>
            <div className="mt-4 bg-white rounded-3xl border border-border p-5 shadow-sm" data-testid="portrait-paywall-card">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-bold text-stone-900 mb-2" style={{ background: "#F5C355" }}>👑 Petito Plus</div>
                <div className="font-display font-bold text-xl text-neutral-900">Desbloquéalo con Petito Plus</div>
                <div className="text-xs text-muted-foreground mt-1">Una sola membresía desbloquea todas tus creaciones</div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                {["Retrato en alta resolución, sin el sello de Petito", "Marco dorado incluido", "Historias y videos incluidos, sin pago por unidad", portrait?.gift_enabled ? "Enlace de regalo listo para enviar" : "Listo para imprimir o compartir"].map((b) => (
                  <li key={b} className="flex items-center gap-2"><Check className="w-4 h-4 text-primary shrink-0" /> {b}</li>
                ))}
              </ul>
            </div>
            {portrait?.compare_url && (
              <Button onClick={shareCompare} className="mt-4 w-full h-12 rounded-2xl font-semibold bg-[#25D366] hover:bg-[#1da851]" data-testid="portrait-share-compare">
                <Share2 className="w-4 h-4 mr-2" /> Compartir el antes y después
              </Button>
            )}
            <button onClick={share} className="mt-3 w-full text-sm text-primary font-semibold flex items-center justify-center gap-1.5" data-testid="portrait-share-free">
              <Share2 className="w-4 h-4" /> Compartir el enlace (gratis)
            </button>
          </>
        )}
        <NextStep nav={nav} name={portrait?.pet_name} />
      </div>

      {!paid && (
        <BottomBar>
          <Button onClick={unlock} disabled={busy} className="w-full h-14 text-base font-display font-semibold rounded-2xl shadow-lg shadow-primary/30" data-testid="portrait-pay-button">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Crown className="w-5 h-5 mr-2" /> Desbloquéalo con Petito Plus</>}
          </Button>
        </BottomBar>
      )}
    </Screen>
  );
}
