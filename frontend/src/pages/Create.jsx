import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  PawPrint, ArrowRight, ArrowLeft, X, Check, ImagePlus, Loader2, Lock,
  Download, Share2, Copy, Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getConfig, createStory, uploadPhotos, generateStory, getStory, payDemo, checkout, saveEmail, mediaUrl,
} from "@/lib/api";
import { StoryCarousel } from "@/components/StoryCarousel";

const SPECIES = [
  { key: "perro", label: "Perro", emoji: "🐶" },
  { key: "gato", label: "Gato", emoji: "🐱" },
  { key: "otro", label: "Otro", emoji: "🐹" },
];
const TRAIT_EMOJI = { regalón: "👑", glotón: "🦴", flojo: "💤", aventurero: "🌲", mañoso: "😼", guardián: "🛡️", payaso: "🤡" };
const THEME_DESC = {
  mi_ano: "Resumen de siestas y travesuras del año",
  mis_aventuras: "Expediciones al patio y la plaza",
  un_dia: "La rutina secreta de comer y dormir",
  dieciochero: "Tiki tiki ti: asados, empanadas y cueca",
  navidad: "Modo duende pascuero mañoso",
};
const QUOTES = [
  "¡No olviden la parte donde pido pancito!",
  "Pongan la foto donde salgo regio, porfa.",
  "Esta siesta se merece un capítulo entero.",
  "Yo soy el más choro del barrio, que se sepa.",
  "Guau guau (traducción: los amo un montón).",
];

export default function Create() {
  const nav = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [step, setStep] = useState("info");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("perro");
  const [traits, setTraits] = useState([]);
  const [theme, setTheme] = useState("");
  const [files, setFiles] = useState([]);
  const [storyId, setStoryId] = useState(null);
  const [slug, setSlug] = useState(null);
  const [story, setStory] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getConfig().then(setCfg).catch(() => toast.error("No se pudo cargar la configuración")); }, []);

  const toggleTrait = (t) =>
    setTraits((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length >= 3 ? (toast.info("Máximo 3 rasgos"), prev) : [...prev, t]));

  if (!cfg) return <Screen><div className="flex-1 grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Screen>;

  const price = new Intl.NumberFormat("es-CL").format(cfg.price_clp);

  return (
    <AnimatePresence mode="wait">
      {step === "info" && (
        <StepInfo key="info" nav={nav} petName={petName} setPetName={setPetName} species={species} setSpecies={setSpecies}
          traits={traits} toggleTrait={toggleTrait} onNext={() => (petName.trim() ? setStep("theme") : toast.error("Ponle nombre a tu mascota 🐾"))} />
      )}
      {step === "theme" && (
        <StepTheme key="theme" cfg={cfg} theme={theme} setTheme={setTheme} onBack={() => setStep("info")}
          onNext={() => (theme ? setStep("photos") : toast.error("Elige un tema"))} />
      )}
      {step === "photos" && (
        <StepPhotos key="photos" files={files} setFiles={setFiles} onBack={() => setStep("theme")} busy={busy}
          onGenerate={async () => {
            if (files.length < 1) return toast.error("Sube al menos 1 foto");
            setBusy(true);
            try {
              const s = await createStory({ pet_name: petName, species, traits, theme });
              setStoryId(s.id); setSlug(s.slug);
              await uploadPhotos(s.id, files.map((f) => f.file));
              await generateStory(s.id);
              setStep("progress");
            } catch (e) {
              toast.error(e?.response?.data?.detail || "No se pudo iniciar la generación");
            } finally { setBusy(false); }
          }} />
      )}
      {step === "progress" && (
        <StepProgress key="progress" storyId={storyId} onReady={(s) => { setStory(s); setStep("result"); }}
          onFail={(s) => { setStory(s); toast.error(s?.error ? "Ups, algo falló. Intenta de nuevo." : "Error"); setStep("photos"); }} />
      )}
      {step === "result" && (
        <StepResult key="result" story={story} setStory={setStory} storyId={storyId} slug={slug} cfg={cfg} price={price} nav={nav} />
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
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white border border-border grid place-items-center" data-testid="wizard-back-button">
          <ArrowLeft className="w-4 h-4" />
        </button>
      ) : <div className="w-9" />}
      <div className="flex-1 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">{stepText}</div>
      <div className="w-9" />
    </div>
  );
}

function BottomBar({ children }) {
  return <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 pb-6 bg-gradient-to-t from-[#FAF6F0] via-[#FAF6F0] to-transparent">{children}</div>;
}

/* ---------------- Step: pet info ---------------- */
function StepInfo({ nav, petName, setPetName, species, setSpecies, traits, toggleTrait, onNext }) {
  return (
    <Screen>
      <Header stepText="Paso 1 de 4 · Tu mascota" onBack={() => nav("/")} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <h2 className="font-display font-bold text-2xl text-neutral-900">¿Quién es la estrella? 🌟</h2>
        <label className="block mt-6 text-sm font-semibold text-neutral-700 mb-2">Nombre de tu mascota</label>
        <div className="relative">
          <PawPrint className="w-5 h-5 text-primary absolute left-4 top-1/2 -translate-y-1/2" />
          <Input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Ej: Charly, Michi, Tomás..."
            maxLength={40} className="h-14 pl-12 rounded-2xl bg-white text-base" data-testid="pet-name-input" />
        </div>

        <label className="block mt-7 text-sm font-semibold text-neutral-700 mb-2">Especie</label>
        <div className="grid grid-cols-3 gap-2.5">
          {SPECIES.map((s) => (
            <button key={s.key} onClick={() => setSpecies(s.key)} data-testid={`species-tab-${s.key}`}
              className={`py-4 rounded-2xl border-2 font-semibold text-sm transition-all ${species === s.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-neutral-600"}`}>
              <div className="text-2xl mb-1">{s.emoji}</div>{s.label}
            </button>
          ))}
        </div>

        <label className="block mt-7 text-sm font-semibold text-neutral-700 mb-1">Personalidad <span className="text-muted-foreground font-normal">(elige hasta 3)</span></label>
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.keys(TRAIT_EMOJI).map((t) => (
            <button key={t} onClick={() => toggleTrait(t)} data-testid={`trait-chip-${t.replace(/[áéíóú]/g,(m)=>({á:"a",é:"e",í:"i",ó:"o",ú:"u"}[m]))}`}
              className={`px-4 py-2.5 rounded-full border-2 text-sm font-semibold capitalize transition-all ${traits.includes(t) ? "border-primary bg-primary text-white" : "border-border bg-white text-neutral-700"}`}>
              {TRAIT_EMOJI[t]} {t}
            </button>
          ))}
        </div>
      </div>
      <BottomBar>
        <Button onClick={onNext} className="w-full h-14 text-base font-display font-semibold rounded-2xl" data-testid="info-next-button">
          Continuar a elegir tema <ArrowRight className="w-5 h-5 ml-1" />
        </Button>
      </BottomBar>
    </Screen>
  );
}

/* ---------------- Step: theme ---------------- */
function StepTheme({ cfg, theme, setTheme, onBack, onNext }) {
  return (
    <Screen>
      <Header stepText="Paso 2 de 4 · El tema" onBack={onBack} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <h2 className="font-display font-bold text-2xl text-neutral-900">¿De qué va la historia? 🎬</h2>
        <div className="mt-5 space-y-3">
          {cfg.themes.map((t) => (
            <button key={t.key} onClick={() => setTheme(t.key)} data-testid={`theme-card-${t.key.replace("_","-")}`}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${theme === t.key ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-white"}`}>
              <div className="text-3xl">{t.emoji}</div>
              <div className="flex-1">
                <div className="font-display font-semibold text-neutral-900">{t.label}</div>
                <div className="text-xs text-muted-foreground">{THEME_DESC[t.key]}</div>
              </div>
              {theme === t.key && <div className="w-6 h-6 rounded-full bg-primary grid place-items-center"><Check className="w-4 h-4 text-white" /></div>}
            </button>
          ))}
        </div>
      </div>
      <BottomBar>
        <Button onClick={onNext} className="w-full h-14 text-base font-display font-semibold rounded-2xl" data-testid="theme-next-button">
          Continuar a las fotos <ArrowRight className="w-5 h-5 ml-1" />
        </Button>
      </BottomBar>
    </Screen>
  );
}

/* ---------------- Step: photos ---------------- */
function StepPhotos({ files, setFiles, onBack, onGenerate, busy }) {
  const inputRef = useRef();
  const addFiles = (list) => {
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => {
      const merged = [...prev];
      for (const f of incoming) {
        if (merged.length >= 20) break;
        merged.push({ id: `${f.name}-${f.size}-${Math.random()}`, file: f, url: URL.createObjectURL(f) });
      }
      if (prev.length + incoming.length > 20) toast.info("Máximo 20 fotos");
      return merged;
    });
  };
  const remove = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));

  return (
    <Screen>
      <Header stepText="Paso 3 de 4 · Las fotos" onBack={onBack} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <h2 className="font-display font-bold text-2xl text-neutral-900">Sube las mejores fotos 📸</h2>
        <p className="text-sm text-muted-foreground mt-1">Elige entre 3 y 20 fotos para un mejor resultado.</p>

        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} data-testid="photo-upload-input" />

        <button onClick={() => inputRef.current?.click()} data-testid="photo-upload-trigger"
          className="mt-5 w-full py-8 rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center gap-2 text-primary">
          <ImagePlus className="w-8 h-8" />
          <span className="font-display font-semibold">Abrir mi galería</span>
          <span className="text-xs text-muted-foreground">Toca para seleccionar fotos</span>
        </button>

        {files.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-6 mb-3">
              <span className="text-sm font-semibold text-neutral-700" data-testid="photo-count">{files.length} / 20 fotos</span>
              <button onClick={() => setFiles([])} className="text-xs text-primary font-semibold">Quitar todas</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {files.map((f, i) => (
                <div key={f.id} className="relative aspect-square rounded-xl overflow-hidden bg-stone-200" data-testid={`photo-thumb-${i}`}>
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => remove(f.id)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center" data-testid={`photo-remove-${i}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="mt-6 text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Tus fotos son privadas y se borran en 7 días.
        </p>
      </div>
      <BottomBar>
        <Button onClick={onGenerate} disabled={busy || files.length < 1} className="w-full h-14 text-base font-display font-semibold rounded-2xl shadow-lg shadow-primary/30" data-testid="generate-story-button">
          {busy ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Preparando...</> : <>¡Generar mi historia! ✨</>}
        </Button>
      </BottomBar>
    </Screen>
  );
}

/* ---------------- Step: progress ---------------- */
function StepProgress({ storyId, onReady, onFail }) {
  const [step, setStep] = useState("Preparando...");
  const [pct, setPct] = useState(5);
  const [quote, setQuote] = useState(0);

  useEffect(() => {
    const q = setInterval(() => setQuote((x) => (x + 1) % QUOTES.length), 2200);
    const poll = setInterval(async () => {
      try {
        const s = await getStory(storyId);
        setStep(s.progress_step || "Trabajando...");
        setPct(s.progress_pct || 5);
        if (s.status === "preview_ready") { clearInterval(poll); clearInterval(q); onReady(s); }
        else if (s.status === "failed") { clearInterval(poll); clearInterval(q); onFail(s); }
      } catch { /* keep polling */ }
    }, 2500);
    return () => { clearInterval(poll); clearInterval(q); };
  }, [storyId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mobile-frame paw-pattern overflow-hidden" data-testid="progress-screen">
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
          className="font-display font-semibold text-2xl text-white leading-snug" data-testid="progress-step-text">
          {step}
        </motion.h2>
        <div className="w-full max-w-xs h-2 bg-white/25 rounded-full mt-6 overflow-hidden">
          <motion.div className="h-full bg-white rounded-full" animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
        </div>
        <motion.p key={quote} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-script text-2xl text-white/90 mt-10">
          “{QUOTES[quote]}”
        </motion.p>
      </div>
    </motion.div>
  );
}

/* ---------------- Step: result (preview + paywall + share) ---------------- */
function StepResult({ story, setStory, storyId, slug, cfg, price, nav }) {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const paid = story?.paid;
  const shareUrl = `${window.location.origin}/h/${slug}`;

  const refresh = async () => setStory(await getStory(storyId));

  const unlock = async () => {
    setBusy(true);
    try {
      if (cfg.payment_mode === "demo") {
        await payDemo(storyId);
        if (email.trim()) await saveEmail(storyId, email.trim());
        await refresh();
        toast.success("¡Historia desbloqueada! 🎉");
      } else {
        const res = await checkout(storyId);
        if (res.checkout_url) window.location.assign(res.checkout_url);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo procesar el pago");
    } finally { setBusy(false); }
  };

  const downloadAll = async () => {
    const slides = (story?.slides || []).filter((s) => !s.locked && s.image_url);
    toast.info("Descargando diapositivas...");
    for (let i = 0; i < slides.length; i++) {
      try {
        const res = await fetch(mediaUrl(slides[i].image_url));
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cuentapatas-${story.pet_name}-${i + 1}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
        await new Promise((r) => setTimeout(r, 250));
      } catch { /* skip */ }
    }
  };

  const shareNative = async () => {
    const text = `¡Mira la historia de ${story.pet_name} en Cuentapatas! 🐾`;
    if (navigator.share) {
      try { await navigator.share({ title: "Cuentapatas", text, url: shareUrl }); } catch { /* cancelled */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`, "_blank");
    }
  };

  return (
    <Screen>
      <Header stepText={paid ? "¡Tu historia está lista!" : "Paso 4 de 4 · Tu historia"} onBack={() => nav("/")} />
      <div className="flex-1 px-5 pt-4 pb-44 overflow-y-auto no-scrollbar">
        <h2 className="font-display font-bold text-xl text-neutral-900 text-center mb-1" data-testid="result-title">{story?.title}</h2>
        <p className="text-center text-sm text-muted-foreground mb-4">{story?.theme_label} · {story?.pet_name}</p>

        <StoryCarousel slides={story?.slides || []} paid={paid} theme={story?.theme} onUnlock={() => document.getElementById("paywall")?.scrollIntoView({ behavior: "smooth" })} />

        {paid ? (
          <div className="mt-6 grid grid-cols-2 gap-3" data-testid="share-hub">
            <Button onClick={downloadAll} variant="secondary" className="h-14 rounded-2xl font-semibold col-span-2 bg-white border border-border" data-testid="download-slides-button">
              <Download className="w-5 h-5 mr-2" /> Descargar todas las diapositivas
            </Button>
            <Button onClick={shareNative} className="h-14 rounded-2xl font-semibold bg-[#25D366] hover:bg-[#1da851]" data-testid="share-whatsapp-button">
              <Share2 className="w-5 h-5 mr-2" /> Compartir
            </Button>
            <Button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Enlace copiado"); }} variant="secondary" className="h-14 rounded-2xl font-semibold bg-white border border-border" data-testid="copy-link-button">
              <Copy className="w-5 h-5 mr-2" /> Copiar enlace
            </Button>
            <button onClick={() => nav("/crear")} className="col-span-2 mt-2 text-sm text-primary font-semibold flex items-center justify-center gap-1">
              <Heart className="w-4 h-4" /> Crear otra historia
            </button>
          </div>
        ) : (
          <div id="paywall" className="mt-6 bg-white rounded-3xl border border-border p-5 shadow-sm" data-testid="paywall-card">
            <div className="text-center">
              <div className="font-display font-bold text-3xl text-primary">${price} <span className="text-base text-muted-foreground font-sans font-medium">CLP</span></div>
              <div className="text-xs text-muted-foreground">Pago único · sin suscripciones</div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-neutral-700">
              {["Historia completa sin marcas de agua", "Descarga todo en HD 1080×1920", "Listo para Instagram Stories y Reels", "Enlace para enviar por WhatsApp"].map((b) => (
                <li key={b} className="flex items-center gap-2"><Check className="w-4 h-4 text-primary shrink-0" /> {b}</li>
              ))}
            </ul>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Tu email (opcional, para el link)"
              className="mt-4 h-12 rounded-xl bg-background" data-testid="email-input" />
          </div>
        )}
      </div>

      {!paid && (
        <BottomBar>
          <Button onClick={unlock} disabled={busy} className="w-full h-14 text-base font-display font-semibold rounded-2xl shadow-lg shadow-primary/30" data-testid="paywall-pay-button">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Lock className="w-5 h-5 mr-2" /> Desbloquear por ${price} CLP</>}
          </Button>
          {cfg.payment_mode === "demo" && <p className="text-center text-[11px] text-muted-foreground mt-2">Modo demo · desbloqueo instantáneo sin cobro real</p>}
        </BottomBar>
      )}
    </Screen>
  );
}
