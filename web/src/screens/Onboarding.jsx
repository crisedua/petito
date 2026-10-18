"use client";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@/lib/router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Check, Sparkles, PawPrint } from "lucide-react";
import { createPet, uploadPetPhoto, revealPet, setActivePetId, getPetsMeta } from "@/lib/api";

const SPECIES = [
  { key: "perro", label: "Perro", emoji: "🐶" },
  { key: "gato", label: "Gato", emoji: "🐱" },
  { key: "otro", label: "Otro", emoji: "🐾" },
];

export default function Onboarding() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const inputRef = useRef();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("perro");
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [personality, setPersonality] = useState([]);
  const [customText, setCustomText] = useState("");
  const [memory, setMemory] = useState("");
  const [options, setOptions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [intro, setIntro] = useState("");
  const [petId, setPetId] = useState("");

  useEffect(() => {
    getPetsMeta().then((m) => setOptions(m.personality_options || [])).catch(() => {});
  }, []);

  const onPhoto = (list) => {
    const arr = Array.from(list);
    const f = arr.find((x) => x.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(x.name)) || arr[0];
    if (!f) return;
    setPhoto(f);
    setPhotoUrl(URL.createObjectURL(f));
  };

  const togglePersonality = (key) =>
    setPersonality((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const canStep1 = name.trim() && photo;
  const canStep2 = personality.length > 0 || customText.trim();

  const submit = async () => {
    setBusy(true);
    try {
      const pet = await createPet({
        name: name.trim(), species,
        personality, personality_text: customText.trim() || undefined,
        favorite_memory: memory.trim() || undefined,
      });
      setPetId(pet.id);
      await uploadPetPhoto(pet.id, photo);
      setStep(4);
      const res = await revealPet(pet.id);
      setIntro(res.intro_text || "");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Algo salió mal. Intenta de nuevo.";
      toast.error(msg);
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const enterUniverse = () => {
    setActivePetId(petId);
    nav("/universo");
  };

  const slide = reduce
    ? {}
    : { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.35 } };

  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="onboarding-screen">
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
        onChange={(e) => { onPhoto(e.target.files); e.target.value = ""; }} data-testid="onboarding-photo-input" />

      <div className="flex items-center gap-3 px-5 pt-5">
        {step > 1 && step < 4 && (
          <button onClick={() => setStep((s) => s - 1)} data-testid="onboarding-back"
            className="w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: "#EADFCF" }}>
            <ArrowLeft className="w-4 h-4" style={{ color: "#8A6D4B" }} />
          </button>
        )}
        {step < 4 && (
          <div className="flex-1 flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-1.5 flex-1 rounded-full" style={{ background: n <= step ? "#C2683F" : "#EADFCF" }} />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 px-6 pt-6 pb-8 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" {...slide} data-testid="onboarding-step-1">
              <h1 className="font-display font-bold text-2xl" style={{ color: "#3A2A20" }}>Conozcamos a tu mascota</h1>
              <p className="mt-1.5 text-sm" style={{ color: "#8A7868" }}>Empecemos por lo esencial: su nombre y una linda foto.</p>

              <button onClick={() => inputRef.current?.click()} data-testid="onboarding-photo-button"
                className="mt-6 w-full rounded-3xl overflow-hidden border-4 border-white shadow-lg grid place-items-center"
                style={{ aspectRatio: "1 / 1", maxHeight: 240, background: "#F3E9DA" }}>
                {photoUrl
                  ? <img src={photoUrl} alt="Tu mascota" className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-2" style={{ color: "#B85C3C" }}>
                      <ImagePlus className="w-10 h-10" /><span className="font-display font-semibold text-sm">Sube una foto</span>
                    </div>}
              </button>

              <label className="block mt-6 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>¿Cómo se llama?</label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ej: Rocco"
                data-testid="onboarding-name-input"
                className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-white border outline-none font-display"
                style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />

              <label className="block mt-5 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>¿Qué es?</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {SPECIES.map((s) => (
                  <button key={s.key} onClick={() => setSpecies(s.key)} data-testid={`onboarding-species-${s.key}`}
                    className="h-14 rounded-2xl border-2 font-display font-semibold text-sm flex flex-col items-center justify-center gap-0.5"
                    style={species === s.key
                      ? { background: "#C2683F", color: "#fff", borderColor: "#C2683F" }
                      : { background: "#fff", color: "#6E5B3E", borderColor: "#EADFCF" }}>
                    <span className="text-lg">{s.emoji}</span>{s.label}
                  </button>
                ))}
              </div>

              <button disabled={!canStep1} onClick={() => setStep(2)} data-testid="onboarding-next-1"
                className="mt-8 w-full h-14 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: "#C2683F" }}>
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" {...slide} data-testid="onboarding-step-2">
              <h1 className="font-display font-bold text-2xl" style={{ color: "#3A2A20" }}>¿Cómo es su personalidad?</h1>
              <p className="mt-1.5 text-sm" style={{ color: "#8A7868" }}>Elige las que más lo describan. Puedes marcar varias.</p>

              <div className="mt-6 space-y-2.5">
                {options.map((o) => {
                  const on = personality.includes(o.key);
                  return (
                    <button key={o.key} onClick={() => togglePersonality(o.key)} data-testid={`onboarding-trait-${o.key}`}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left font-display font-semibold"
                      style={on ? { background: "#FBEEE4", borderColor: "#C2683F", color: "#B85C3C" }
                                : { background: "#fff", borderColor: "#EADFCF", color: "#6E5B3E" }}>
                      <span className="text-xl">{o.emoji}</span>
                      <span className="flex-1 text-sm">{o.label}</span>
                      {on && <Check className="w-5 h-5" style={{ color: "#C2683F" }} />}
                    </button>
                  );
                })}
              </div>

              <label className="block mt-5 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>O descríbelo tú (opcional)</label>
              <input value={customText} onChange={(e) => setCustomText(e.target.value)} maxLength={200}
                placeholder="Ej: le encanta robar calcetines" data-testid="onboarding-custom-input"
                className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-white border outline-none font-display text-sm"
                style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />

              <button disabled={!canStep2} onClick={() => setStep(3)} data-testid="onboarding-next-2"
                className="mt-8 w-full h-14 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: "#C2683F" }}>
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" {...slide} data-testid="onboarding-step-3">
              <h1 className="font-display font-bold text-2xl" style={{ color: "#3A2A20" }}>Un recuerdo favorito</h1>
              <p className="mt-1.5 text-sm" style={{ color: "#8A7868" }}>¿Hay un momento con {name || "tu mascota"} que atesoras? Es opcional.</p>

              <textarea value={memory} onChange={(e) => setMemory(e.target.value)} maxLength={400} rows={5}
                placeholder="Ej: el día que llegó a casa y se escondió bajo el sillón toda la tarde..."
                data-testid="onboarding-memory-input"
                className="mt-6 w-full p-4 rounded-2xl bg-white border outline-none font-display text-sm resize-none"
                style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />

              <button onClick={submit} disabled={busy} data-testid="onboarding-finish"
                className="mt-8 w-full h-14 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "#C2683F" }}>
                {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Creando su universo...</>
                      : <><Sparkles className="w-5 h-5" /> Crear el universo de {name || "mi mascota"}</>}
              </button>
              <button onClick={() => { setMemory(""); submit(); }} disabled={busy} data-testid="onboarding-skip-memory"
                className="mt-3 w-full h-11 rounded-2xl font-display font-semibold text-sm" style={{ color: "#8A6D4B" }}>
                Saltar este paso
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} data-testid="onboarding-step-4"
              className="flex flex-col items-center text-center">
              <motion.div initial={reduce ? false : { scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="mt-4 rounded-full overflow-hidden border-4 border-white shadow-xl" style={{ width: 150, height: 150 }}>
                {photoUrl && <img src={photoUrl} alt={name} className="w-full h-full object-cover" />}
              </motion.div>
              <motion.h1 initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="mt-6 font-script text-4xl" style={{ color: "#B85C3C" }}>
                {name}
              </motion.h1>

              {intro ? (
                <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}
                  className="mt-4 text-base leading-relaxed font-display" style={{ color: "#4A3B30" }} data-testid="onboarding-reveal-text">
                  {intro}
                </motion.p>
              ) : (
                <div className="mt-6 flex flex-col items-center gap-2" style={{ color: "#B85C3C" }}>
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span className="text-sm" style={{ color: "#8A7868" }}>Escribiendo su bienvenida...</span>
                </div>
              )}

              {intro && (
                <>
                  <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                    className="mt-5 font-script text-2xl" style={{ color: "#8A6D4B" }}>
                    Esta es apenas la primera página de su historia.
                  </motion.p>
                  <motion.button initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}
                    whileTap={reduce ? undefined : { scale: 0.97 }} onClick={enterUniverse} data-testid="onboarding-enter-universe"
                    className="mt-8 w-full h-14 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2"
                    style={{ background: "#C2683F" }}>
                    <PawPrint className="w-5 h-5" /> Entrar al universo de {name}
                  </motion.button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
