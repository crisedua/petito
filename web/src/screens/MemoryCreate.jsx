"use client";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@/lib/router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Heart, Sparkles, Check } from "lucide-react";
import { createMemory, uploadMemoryPhoto, reflectMemory, getEmotions, getActivePetId } from "@/lib/api";

const FEELING_HINTS = [
  "¿Qué sentiste ese día?",
  "¿Qué recuerdas de ese momento?",
  "¿Qué le dirías si pudiera leerte?",
  "¿Por qué este momento es especial?",
];

export default function MemoryCreate() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const inputRef = useRef();
  const [step, setStep] = useState(1);
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [happenedOn, setHappenedOn] = useState("");
  const [dateUnknown, setDateUnknown] = useState(false);
  const [feeling, setFeeling] = useState("");
  const [emotions, setEmotions] = useState([]);
  const [emotionOpts, setEmotionOpts] = useState([]);
  const [hintIdx, setHintIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [memId, setMemId] = useState("");
  const [reflection, setReflection] = useState("");
  const [reflecting, setReflecting] = useState(false);

  useEffect(() => { getEmotions().then(setEmotionOpts).catch(() => {}); }, []);
  useEffect(() => {
    const t = setInterval(() => setHintIdx((i) => (i + 1) % FEELING_HINTS.length), 3500);
    return () => clearInterval(t);
  }, []);

  const onPhoto = (list) => {
    const arr = Array.from(list);
    const f = arr.find((x) => x.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(x.name)) || arr[0];
    if (!f) return;
    setPhoto(f);
    setPhotoUrl(URL.createObjectURL(f));
  };

  const toggleEmotion = (k) => setEmotions((e) => (e.includes(k) ? e.filter((x) => x !== k) : [...e, k]));

  const save = async () => {
    const pid = getActivePetId();
    if (!pid) { nav("/universo"); return; }
    setBusy(true);
    try {
      const m = await createMemory(pid, {
        title: title.trim(), happened_on: dateUnknown ? undefined : (happenedOn.trim() || undefined),
        date_unknown: dateUnknown, feeling_text: feeling.trim() || undefined, emotions,
      });
      setMemId(m.id);
      if (photo) await uploadMemoryPhoto(m.id, photo);
      setSaved(true);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo guardar el recuerdo");
    } finally {
      setBusy(false);
    }
  };

  const askReflection = async () => {
    setReflecting(true);
    try {
      const r = await reflectMemory(memId);
      setReflection(r.ai_reflection);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo crear el pensamiento");
    } finally {
      setReflecting(false);
    }
  };

  const slide = reduce ? {} : { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.3 } };

  // ---- Saved reveal ----
  if (saved) {
    return (
      <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="memory-saved">
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <motion.div initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="w-24 h-24 rounded-full grid place-items-center" style={{ background: "#FBEEE4" }}>
            <Heart className="w-12 h-12" style={{ color: "#C2683F" }} fill="#C2683F" />
          </motion.div>
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="mt-6 font-script text-4xl" style={{ color: "#B85C3C" }}>Guardado para siempre</motion.h1>
          <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="mt-2 text-sm font-display" style={{ color: "#8A7868" }}>Este momento ya vive en su álbum 🤍</motion.p>

          {/* Petito reflection offer */}
          {!reflection ? (
            <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-8 w-full">
              <button onClick={askReflection} disabled={reflecting} data-testid="memory-ask-reflection"
                className="w-full h-13 py-3.5 rounded-2xl font-display font-semibold text-sm flex items-center justify-center gap-2 border"
                style={{ background: "#fff", color: "#8A6D4B", borderColor: "#EADFCF" }}>
                {reflecting ? <><Loader2 className="w-4 h-4 animate-spin" /> Pensando...</>
                  : <><Sparkles className="w-4 h-4" style={{ color: "#C2683F" }} /> ¿Quieres un pensamiento de Petito?</>}
              </button>
            </motion.div>
          ) : (
            <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-8 w-full p-4 rounded-2xl text-left border" style={{ background: "#F6EFE2", borderColor: "#EADFCF" }} data-testid="memory-reflection-text">
              <div className="flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: "#B07A4A" }}>
                💭 Un pensamiento de Petito
              </div>
              <p className="text-sm font-display leading-relaxed" style={{ color: "#4A3B30" }}>{reflection}</p>
              <div className="mt-1.5 text-[10px]" style={{ color: "#A7937F" }}>Escrito por IA · acompaña tu recuerdo, no es un hecho</div>
            </motion.div>
          )}

          <div className="mt-8 w-full space-y-2.5">
            <button onClick={() => nav(`/album/${memId}`)} data-testid="memory-view-saved"
              className="w-full h-13 py-3.5 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2" style={{ background: "#C2683F" }}>
              Ver el recuerdo <ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={() => nav("/album")} data-testid="memory-back-album"
              className="w-full h-11 rounded-2xl font-display font-semibold text-sm" style={{ color: "#8A6D4B" }}>
              Volver al álbum
            </button>
          </div>
        </div>
      </div>
    );
  }

  const canStep1 = title.trim();

  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="memory-create-screen">
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
        onChange={(e) => { onPhoto(e.target.files); e.target.value = ""; }} data-testid="memory-photo-input" />

      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => (step > 1 ? setStep((s) => s - 1) : nav("/album"))} data-testid="memory-create-back"
          className="w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: "#EADFCF" }}>
          <ArrowLeft className="w-4 h-4" style={{ color: "#8A6D4B" }} />
        </button>
        <div className="flex-1 flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-1.5 flex-1 rounded-full" style={{ background: n <= step ? "#C2683F" : "#EADFCF" }} />
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 pt-6 pb-8 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="m1" {...slide} data-testid="memory-step-1">
              <h1 className="font-display font-bold text-2xl" style={{ color: "#3A2A20" }}>El momento</h1>
              <p className="mt-1.5 text-sm" style={{ color: "#8A7868" }}>Una foto y un título para recordarlo siempre.</p>

              <button onClick={() => inputRef.current?.click()} data-testid="memory-photo-button"
                className="mt-6 w-full rounded-3xl overflow-hidden border-4 border-white shadow-lg grid place-items-center"
                style={{ aspectRatio: "16 / 11", background: "#F3E9DA" }}>
                {photoUrl ? <img src={photoUrl} alt="recuerdo" className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-2" style={{ color: "#B85C3C" }}>
                      <ImagePlus className="w-9 h-9" /><span className="font-display font-semibold text-sm">Sube una foto (opcional)</span>
                    </div>}
              </button>

              <label className="block mt-6 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>¿Cómo llamarías este momento?</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Ej: Su primer día en casa"
                data-testid="memory-title-input"
                className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-white border outline-none font-display" style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />

              <button disabled={!canStep1} onClick={() => setStep(2)} data-testid="memory-next-1"
                className="mt-8 w-full h-14 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: "#C2683F" }}>
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="m2" {...slide} data-testid="memory-step-2">
              <h1 className="font-display font-bold text-2xl" style={{ color: "#3A2A20" }}>¿Cuándo fue?</h1>
              <p className="mt-1.5 text-sm" style={{ color: "#8A7868" }}>Si no lo recuerdas exacto, no importa.</p>

              <input value={happenedOn} onChange={(e) => setHappenedOn(e.target.value)} maxLength={40} disabled={dateUnknown}
                placeholder="Ej: marzo 2023, verano pasado..." data-testid="memory-date-input"
                className="mt-6 w-full h-12 px-4 rounded-2xl bg-white border outline-none font-display disabled:opacity-50" style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />

              <button onClick={() => setDateUnknown((v) => !v)} data-testid="memory-date-unknown"
                className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-2xl border font-display font-semibold text-sm"
                style={dateUnknown ? { background: "#FBEEE4", borderColor: "#C2683F", color: "#B85C3C" } : { background: "#fff", borderColor: "#EADFCF", color: "#6E5B3E" }}>
                {dateUnknown && <Check className="w-4 h-4" />} No la sé, fue hace un tiempo
              </button>

              <button onClick={() => setStep(3)} data-testid="memory-next-2"
                className="mt-8 w-full h-14 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2" style={{ background: "#C2683F" }}>
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="m3" {...slide} data-testid="memory-step-3">
              <h1 className="font-display font-bold text-2xl" style={{ color: "#3A2A20" }}>Lo que sentiste</h1>
              <AnimatePresence mode="wait">
                <motion.p key={hintIdx} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="mt-1.5 text-sm font-script text-lg" style={{ color: "#B85C3C" }}>
                  {FEELING_HINTS[hintIdx]}
                </motion.p>
              </AnimatePresence>

              <textarea value={feeling} onChange={(e) => setFeeling(e.target.value)} maxLength={1500} rows={5}
                placeholder="Escribe desde el corazón..." data-testid="memory-feeling-input"
                className="mt-4 w-full p-4 rounded-2xl bg-white border outline-none font-display text-sm resize-none" style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />

              <label className="block mt-5 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>¿Cómo se sintió?</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {emotionOpts.map((o) => {
                  const on = emotions.includes(o.key);
                  return (
                    <button key={o.key} onClick={() => toggleEmotion(o.key)} data-testid={`memory-emotion-${o.key}`}
                      className="px-3.5 py-2 rounded-full border-2 font-display font-semibold text-sm"
                      style={on ? { background: "#FBEEE4", borderColor: "#C2683F", color: "#B85C3C" } : { background: "#fff", borderColor: "#EADFCF", color: "#6E5B3E" }}>
                      {o.emoji} {o.label}
                    </button>
                  );
                })}
              </div>

              <button onClick={save} disabled={busy} data-testid="memory-save"
                className="mt-8 w-full h-14 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "#C2683F" }}>
                {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</> : <><Heart className="w-5 h-5" /> Guardar para siempre</>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
