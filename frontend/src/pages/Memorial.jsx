import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight, ArrowLeft, X, Check, ImagePlus, Loader2, Heart, Download, Share2, Copy, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getConfig, createPortrait, uploadPortraitPhoto, generatePortrait, getPortrait,
  portraitCheckout, mediaUrl,
} from "@/lib/api";
import { InviteButton } from "@/components/InviteButton";

const STYLE_IMG = {
  acuarela: "https://images.unsplash.com/photo-1507149833265-60c372daea22?crop=entropy&cs=srgb&fm=jpg&q=80&w=400",
  oleo_realista: "https://images.unsplash.com/photo-1452570053594-1b985d6ea890?crop=entropy&cs=srgb&fm=jpg&q=80&w=400",
};
const CAPTIONS = ["Siempre conmigo", "Siempre en mi corazón", "Hasta que nos volvamos a ver", "Gracias por tanto amor"];
const QUOTES = [
  "Pintando con mucho cariño...",
  "Cuidando cada detalle de su mirada...",
  "Preparando un homenaje a su altura...",
];

export default function Memorial() {
  const nav = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [step, setStep] = useState("photo");
  const [petName, setPetName] = useState("");
  const [dates, setDates] = useState("");
  const [file, setFile] = useState(null);
  const [style, setStyle] = useState("");
  const [caption, setCaption] = useState(CAPTIONS[0]);
  const [portraitId, setPortraitId] = useState(null);
  const [slug, setSlug] = useState(null);
  const [portrait, setPortrait] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getConfig().then(setCfg).catch(() => toast.error("No se pudo cargar")); }, []);

  if (!cfg) return <Screen><div className="flex-1 grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div></Screen>;

  const price = new Intl.NumberFormat("es-CL").format(cfg.portrait_price_clp || 2990);

  const start = async () => {
    if (!style) return toast.error("Elige un estilo");
    if (!file) return toast.error("Sube una foto");
    setBusy(true);
    try {
      const p = await createPortrait({
        pet_name: petName, style, category: "memorial",
        memorial_dates: dates, memorial_caption: caption,
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
        <StepPhoto key="photo" nav={nav} petName={petName} setPetName={setPetName} dates={dates} setDates={setDates}
          file={file} setFile={setFile} onNext={() => (file ? setStep("style") : toast.error("Sube una foto"))} />
      )}
      {step === "style" && (
        <StepStyle key="style" cfg={cfg} style={style} setStyle={setStyle} caption={caption} setCaption={setCaption}
          onBack={() => setStep("photo")} onNext={start} busy={busy} />
      )}
      {step === "progress" && (
        <StepProgress key="progress" portraitId={portraitId} petName={petName}
          onReady={(p) => { setPortrait(p); setStep("result"); }}
          onFail={() => { toast.error("No pudimos crear el retrato. Intenta con otra foto."); setStep("style"); }} />
      )}
      {step === "result" && (
        <StepResult key="result" portrait={portrait} setPortrait={setPortrait} portraitId={portraitId} slug={slug}
          cfg={cfg} price={price} caption={caption} dates={dates} nav={nav} />
      )}
    </AnimatePresence>
  );
}

function Screen({ children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mobile-frame bg-[#F4F2EF]">
      {children}
    </motion.div>
  );
}

function Header({ onBack, stepText }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-5">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-white border border-border grid place-items-center" data-testid="memorial-back-button">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <div className="flex-1 text-center text-xs font-semibold tracking-wide text-slate-400 uppercase">{stepText}</div>
      <InviteButton />
    </div>
  );
}

function BottomBar({ children }) {
  return <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 pb-6 bg-gradient-to-t from-[#F4F2EF] via-[#F4F2EF] to-transparent">{children}</div>;
}

function StepPhoto({ nav, petName, setPetName, dates, setDates, file, setFile, onNext }) {
  const inputRef = useRef();
  const pick = (list) => {
    const f = Array.from(list).find((x) => x.type.startsWith("image/"));
    if (f) setFile({ file: f, url: URL.createObjectURL(f) });
  };
  return (
    <Screen>
      <Header stepText="Paso 1 de 2 · La foto" onBack={() => nav("/")} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-2 text-slate-400"><Heart className="w-5 h-5" /><span className="text-xs font-semibold uppercase tracking-wide">Retrato recuerdo</span></div>
        <h2 className="font-display font-bold text-2xl text-slate-800 mt-1">Un homenaje para recordarle</h2>
        <p className="text-sm text-slate-500 mt-1">Sube tu foto favorita. Crearemos un retrato sereno que conserva su esencia.</p>

        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }} data-testid="memorial-photo-input" />

        {file ? (
          <div className="mt-5 relative w-full rounded-3xl overflow-hidden bg-stone-200 border-4 border-white shadow-md" style={{ aspectRatio: "3 / 4" }} data-testid="memorial-photo-preview">
            <img src={file.url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => setFile(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white grid place-items-center" data-testid="memorial-photo-remove">
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        ) : (
          <button onClick={() => inputRef.current?.click()} data-testid="memorial-photo-trigger"
            className="mt-5 w-full py-12 rounded-3xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center gap-2 text-slate-500">
            <ImagePlus className="w-9 h-9" />
            <span className="font-display font-semibold">Abrir mi galería</span>
            <span className="text-xs text-slate-400">Toca para elegir una foto</span>
          </button>
        )}

        <label className="block mt-7 text-sm font-semibold text-slate-700 mb-2">Su nombre</label>
        <Input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Ej: Luna, Simón..."
          maxLength={40} className="h-14 rounded-2xl bg-white text-base" data-testid="memorial-name-input" />

        <label className="block mt-5 text-sm font-semibold text-slate-700 mb-2">Fechas <span className="text-slate-400 font-normal">(opcional)</span></label>
        <Input value={dates} onChange={(e) => setDates(e.target.value)} placeholder="Ej: 2010 – 2024"
          maxLength={40} className="h-14 rounded-2xl bg-white text-base" data-testid="memorial-dates-input" />
      </div>
      <BottomBar>
        <Button onClick={onNext} className="w-full h-14 text-base font-display font-semibold rounded-2xl bg-slate-700 hover:bg-slate-800" data-testid="memorial-photo-next">
          Elegir el estilo <ArrowRight className="w-5 h-5 ml-1" />
        </Button>
      </BottomBar>
    </Screen>
  );
}

function StepStyle({ cfg, style, setStyle, caption, setCaption, onBack, onNext, busy }) {
  const [custom, setCustom] = useState(false);
  return (
    <Screen>
      <Header stepText="Paso 2 de 2 · El estilo" onBack={onBack} />
      <div className="flex-1 px-5 pt-5 pb-40 overflow-y-auto no-scrollbar">
        <h2 className="font-display font-bold text-2xl text-slate-800">¿Cómo quieres el retrato?</h2>
        <div className="mt-5 grid grid-cols-1 gap-3">
          {(cfg.memorial_styles || []).map((s) => (
            <button key={s.key} onClick={() => setStyle(s.key)} data-testid={`memorial-style-${s.key}`}
              className={`relative w-full flex items-center gap-4 p-3 rounded-2xl border-2 text-left transition-all ${style === s.key ? "border-slate-600 bg-white ring-2 ring-slate-200" : "border-border bg-white"}`}>
              <div className="w-16 h-20 rounded-xl overflow-hidden bg-stone-200 shrink-0">
                {STYLE_IMG[s.key] && <img src={STYLE_IMG[s.key]} alt={s.label} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1">
                <div className="font-display font-semibold text-slate-800">{s.emoji} {s.label}</div>
                <div className="text-xs text-slate-500">{s.desc}</div>
              </div>
              {style === s.key && <div className="w-6 h-6 rounded-full bg-slate-600 grid place-items-center shrink-0"><Check className="w-4 h-4 text-white" /></div>}
            </button>
          ))}
        </div>

        <label className="block mt-7 text-sm font-semibold text-slate-700 mb-2">Una frase para acompañarlo</label>
        <div className="flex flex-wrap gap-2">
          {CAPTIONS.map((c) => (
            <button key={c} onClick={() => { setCaption(c); setCustom(false); }} data-testid={`memorial-caption-${c}`}
              className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${caption === c && !custom ? "bg-slate-700 text-white" : "bg-white border border-border text-slate-600"}`}>
              {c}
            </button>
          ))}
          <button onClick={() => { setCustom(true); setCaption(""); }} data-testid="memorial-caption-custom"
            className={`px-3.5 py-2 rounded-full text-sm font-medium ${custom ? "bg-slate-700 text-white" : "bg-white border border-border text-slate-600"}`}>
            Escribir la mía
          </button>
        </div>
        {custom && (
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Tu frase..."
            maxLength={80} className="mt-3 h-12 rounded-2xl bg-white" data-testid="memorial-caption-input" />
        )}
      </div>
      <BottomBar>
        <Button onClick={onNext} disabled={busy || !style} className="w-full h-14 text-base font-display font-semibold rounded-2xl bg-slate-700 hover:bg-slate-800" data-testid="memorial-create-button">
          {busy ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Preparando...</> : <><Heart className="w-5 h-5 mr-2" /> Crear el retrato</>}
        </Button>
      </BottomBar>
    </Screen>
  );
}

function StepProgress({ portraitId, petName, onReady, onFail }) {
  const [step, setStep] = useState("Preparando...");
  const [pct, setPct] = useState(5);
  const [quote, setQuote] = useState(0);

  useEffect(() => {
    const q = setInterval(() => setQuote((x) => (x + 1) % QUOTES.length), 2600);
    const poll = setInterval(async () => {
      try {
        const p = await getPortrait(portraitId);
        setStep(p.progress_step || "Pintando..."); setPct(p.progress_pct || 5);
        if (p.status === "preview_ready") { clearInterval(poll); clearInterval(q); onReady(p); }
        else if (p.status === "failed") { clearInterval(poll); clearInterval(q); onFail(p); }
      } catch { /* keep polling */ }
    }, 2500);
    return () => { clearInterval(poll); clearInterval(q); };
  }, [portraitId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mobile-frame bg-slate-700 overflow-hidden" data-testid="memorial-progress-screen">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-white/20" />
          <motion.div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent"
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }} />
          <div className="absolute inset-0 grid place-items-center"><Heart className="w-8 h-8 text-white" /></div>
        </div>
        <motion.h2 key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="font-display font-semibold text-2xl text-white leading-snug" data-testid="memorial-progress-text">{step}</motion.h2>
        <motion.p key={quote} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-script text-2xl text-white/80 mt-10">
          “{QUOTES[quote].replace("su altura", petName ? petName : "su altura")}”
        </motion.p>
        <p className="text-white/50 text-xs mt-8">{pct}%</p>
      </div>
    </motion.div>
  );
}

function StepResult({ portrait, setPortrait, portraitId, slug, cfg, price, caption, dates, nav }) {
  const [busy, setBusy] = useState(false);
  const paid = portrait?.paid;
  const shareUrl = `${window.location.origin}/r/${slug}`;
  const imgUrl = paid ? mediaUrl(portrait?.clean_url) : mediaUrl(portrait?.preview_url);

  const refresh = async () => setPortrait(await getPortrait(portraitId));

  const unlock = async () => {
    setBusy(true);
    try {
      const res = await portraitCheckout(portraitId);
      if (res.checkout_url) window.location.assign(res.checkout_url);
      else if (res.already_paid) { await refresh(); }
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo procesar el pago"); }
    finally { setBusy(false); }
  };

  const downloadImage = async () => {
    try {
      const res = await fetch(imgUrl); const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `petito-recuerdo-${portrait?.pet_name || "mascota"}.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { toast.error("No se pudo descargar"); }
  };

  const share = async () => {
    const text = `Un recuerdo de ${portrait?.pet_name || "mi mascota"} 🤍`;
    if (navigator.share) { try { await navigator.share({ title: "Petito", text, url: shareUrl }); } catch { /**/ } }
    else window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`, "_blank");
  };

  return (
    <Screen>
      <Header stepText={paid ? "Tu retrato" : "Vista previa"} onBack={() => nav("/")} />
      <div className="flex-1 px-5 pt-3 pb-44 overflow-y-auto no-scrollbar">
        {portrait?.pet_name && <p className="text-center font-script text-3xl text-slate-700" data-testid="memorial-name">{portrait.pet_name}</p>}
        {dates && <p className="text-center text-sm text-slate-400 -mt-1">{dates}</p>}
        <div className="relative w-full rounded-3xl overflow-hidden bg-stone-900 border-4 border-white shadow-xl mx-auto mt-2" style={{ aspectRatio: "3 / 4", maxWidth: 360 }} data-testid="memorial-result-image">
          {imgUrl && <img src={imgUrl} alt="Retrato recuerdo" className="w-full h-full object-cover" />}
        </div>
        {caption && <p className="mt-3 text-center font-script text-2xl text-slate-600" data-testid="memorial-caption-display">“{caption}”</p>}

        {paid ? (
          <div className="mt-6 grid gap-3" data-testid="memorial-paid-hub">
            <Button onClick={downloadImage} className="h-14 rounded-2xl font-semibold bg-slate-700 hover:bg-slate-800" data-testid="memorial-download-hd"><Download className="w-5 h-5 mr-2" /> Descargar en HD</Button>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={share} className="h-14 rounded-2xl font-semibold bg-white border border-border text-slate-700" data-testid="memorial-share"><Share2 className="w-5 h-5 mr-2" /> Compartir</Button>
              <Button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Enlace copiado"); }} className="h-14 rounded-2xl font-semibold bg-white border border-border text-slate-700" data-testid="memorial-copy"><Copy className="w-5 h-5 mr-2" /> Enlace</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 text-center">
              <p className="text-sm text-slate-500">Descárgalo en alta calidad, sin marca de agua, por ${price}.</p>
            </div>
            <div className="mt-4 bg-white rounded-3xl border border-border p-5" data-testid="memorial-paywall-card">
              <div className="text-center">
                <div className="font-display font-bold text-3xl text-slate-800">${price} <span className="text-base text-slate-400 font-sans font-medium">CLP</span></div>
                <div className="text-xs text-slate-400">Pago único · para guardar o imprimir</div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {["Retrato en alta resolución", "Sin marca de agua", "Listo para imprimir y enmarcar"].map((b) => (
                  <li key={b} className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-600 shrink-0" /> {b}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
      {!paid && (
        <BottomBar>
          <Button onClick={unlock} disabled={busy} className="w-full h-14 text-base font-display font-semibold rounded-2xl bg-slate-700 hover:bg-slate-800" data-testid="memorial-pay-button">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" /> Descargar en HD · ${price}</>}
          </Button>
        </BottomBar>
      )}
    </Screen>
  );
}
