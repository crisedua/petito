"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { shareLink } from "@/lib/share";
import { Camera, Loader2, Sparkles, Share2, Crown, RotateCcw, ArrowRight } from "lucide-react";
import { useNavigate } from "@/lib/router";
import { useAuth } from "@/lib/auth";
import { tryPortrait, getPortrait, mediaUrl, rememberClaim, claimPortrait } from "@/lib/api";

const C = { ink: "#3A2A20", muted: "#8A7868", accent: "#C2683F", line: "#EEE3D2", soft: "#FBF6EE" };
const STEPS = ["Mirando su carita...", "Encuadrando su mejor pose...", "Eligiendo un fondo que le quede...", "Poniendo la luz de estudio...", "Grabando su placa con nombre..."];

/**
 * "Pruébalo gratis": upload one photo, watch it turn into a painted portrait, no account needed.
 * The result is the hook; saving, other styles and HD come after, behind sign-in.
 */
export default function TryPortrait({ title = "Mira a tu mascota como obra de arte", subtitle = "Sube una foto. Gratis, sin cuenta, en menos de un minuto.", sample = "/portrait-styles/renacentista.jpg", testid = "try-portrait" }) {
  const nav = useNavigate();
  const { user, login } = useAuth();
  const inputRef = useRef();
  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | working | ready | failed
  const [job, setJob] = useState(null); // { id, slug }
  const [result, setResult] = useState(null);
  const [stepText, setStepText] = useState(STEPS[0]);
  const [pct, setPct] = useState(5);
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = (files) => {
    const f = Array.from(files || []).find((x) => x.type.startsWith("image/") || /\.hei[cf]$/i.test(x.name));
    if (!f) return;
    setPhoto({ file: f, url: URL.createObjectURL(f) });
    start(f);
  };

  const start = async (file) => {
    setPhase("working"); setPct(5); setStepText(STEPS[0]);
    try {
      const j = await tryPortrait(file, name.trim());
      setJob(j);
    } catch (e) {
      const status = e?.response?.status;
      toast.error(e?.response?.data?.detail || (status >= 500 ? "Estamos con alta demanda. Intenta en un momento 🐾" : "No pudimos usar esa foto. Prueba con otra."), { duration: 8000 });
      setPhase("idle"); setPhoto(null);
    }
  };

  // Rotate the step text while the server paints; follow the real progress when it reports it.
  useEffect(() => {
    if (phase !== "working" || !job) return;
    let i = 0;
    const words = setInterval(() => { i = (i + 1) % STEPS.length; setStepText(STEPS[i]); }, 3200);
    const poll = setInterval(async () => {
      try {
        const p = await getPortrait(job.id);
        if (p.progress_pct) setPct(Math.max(5, p.progress_pct));
        if (p.status === "preview_ready" || p.status === "paid") { setResult(p); setPhase("ready"); }
        else if (p.status === "failed") setPhase("failed");
      } catch { /* keep polling */ }
    }, 2500);
    return () => { clearInterval(words); clearInterval(poll); };
  }, [phase, job]);

  const reset = () => { setPhase("idle"); setPhoto(null); setJob(null); setResult(null); };

  // Keep it: signed in → already theirs (or claim it now); anonymous → sign in, then auth.jsx claims it.
  const keep = async (then = "/universo") => {
    if (!job) return;
    if (user) {
      setBusy(true);
      try { await claimPortrait(job.id); } catch { /* it is already theirs */ }
      setBusy(false);
      nav(then);
      return;
    }
    rememberClaim(job.id);
    login(then);
  };

  const share = async () => {
    const url = `${window.location.origin}/r/${job.slug}`;
    const text = `¡Mira cómo quedó ${name.trim() || "mi mascota"} en Petipop! 👑🐾`;
    await shareLink({ text, url });
  };

  const resultUrl = result ? mediaUrl(result.paid ? result.clean_url : result.preview_url) : null;

  return (
    <div className="rounded-3xl bg-white border p-4 shadow-xl" style={{ borderColor: C.line, boxShadow: "0 14px 30px -14px rgba(194,104,63,0.45)" }} data-testid={testid}>
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
        onChange={(e) => { pick(e.target.files); e.target.value = ""; }} data-testid={`${testid}-input`} />

      {phase === "idle" && (
        <>
          <div className="font-display font-bold text-base leading-tight" style={{ color: C.ink }}>{title}</div>
          {subtitle && <div className="text-xs mt-0.5" style={{ color: C.muted }}>{subtitle}</div>}
          <div className="mt-3 flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Su nombre"
              className="flex-1 min-w-0 h-12 px-3 rounded-xl border text-base outline-none" style={{ borderColor: C.line, background: C.soft }}
              data-testid={`${testid}-name`} />
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => inputRef.current?.click()} data-testid={`${testid}-photo`}
              className="shrink-0 px-4 h-12 rounded-xl text-white font-display font-bold text-sm flex items-center justify-center gap-1.5"
              style={{ background: C.accent, boxShadow: "0 10px 22px -10px rgba(194,104,63,0.6)" }}>
              <Camera className="w-4 h-4" /> Subir su foto
            </motion.button>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "#A7937F" }}>Gratis y sin cuenta. Tu foto es privada y se borra sola.</p>
        </>
      )}

      {(phase === "working" || phase === "failed") && photo && (
        <div data-testid={`${testid}-working`}>
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-white shadow bg-stone-200">
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
              {phase === "working" && (
                <motion.div className="absolute inset-y-0 w-1/2 pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)" }}
                  animate={{ x: ["-120%", "320%"] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {phase === "working" ? (
                <>
                  <div className="font-display font-bold" style={{ color: C.ink }}>Haciendo su foto de estudio</div>
                  <motion.div key={stepText} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="mt-0.5 text-sm flex items-center gap-1.5" style={{ color: C.muted }}>
                    <Sparkles className="w-4 h-4 shrink-0" style={{ color: C.accent }} /> {stepText}
                  </motion.div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: C.line }}>
                    <motion.div className="h-full" style={{ background: C.accent }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                  </div>
                  <div className="mt-1.5 text-[11px]" style={{ color: "#A7937F" }}>Entre 20 y 60 segundos. No cierres esta página.</div>
                </>
              ) : (
                <>
                  <div className="font-display font-bold" style={{ color: C.ink }}>No pudimos usar esa foto</div>
                  <div className="mt-0.5 text-sm" style={{ color: C.muted }}>Prueba con otra, de frente y con buena luz.</div>
                  <button onClick={reset} className="mt-2 text-sm font-bold flex items-center gap-1" style={{ color: C.accent }}><RotateCcw className="w-4 h-4" /> Probar con otra foto</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === "ready" && result && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} data-testid={`${testid}-ready`}>
          <div className="font-display font-bold text-lg text-center" style={{ color: C.ink }}>¡Así quedó {name.trim() || "tu mascota"}! 👑</div>
          <div className="relative w-full max-w-[300px] mx-auto mt-3 rounded-2xl overflow-hidden bg-stone-900 border-4 border-white shadow-xl" style={{ aspectRatio: "3 / 4" }}>
            <img src={showOriginal && photo ? photo.url : resultUrl} alt="Tu mascota como retrato" className="w-full h-full object-cover" />
          </div>
          {!result.paid && <p className="mt-2 text-center text-[11px]" style={{ color: "#A7937F" }}>Esta es la versión para compartir. En alta resolución, lista para imprimir, con Petipop Plus.</p>}

          <motion.button whileTap={{ scale: 0.97 }} onClick={() => keep("/universo")} disabled={busy} data-testid={`${testid}-keep`}
            className="mt-4 w-full h-14 rounded-2xl text-white font-display font-bold text-base flex items-center justify-center gap-2"
            style={{ background: C.accent, boxShadow: "0 14px 30px -10px rgba(194,104,63,0.6)" }}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Crown className="w-5 h-5" /> {user ? "Guardarlo en su universo" : "Guárdalo gratis en tu cuenta"}</>}
          </motion.button>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button onClick={() => keep("/retrato")} disabled={busy} data-testid={`${testid}-more`}
              className="h-12 rounded-2xl font-display font-semibold text-sm flex items-center justify-center gap-1.5 bg-white border-2" style={{ color: C.accent, borderColor: "#E7C9B5" }}>
              <Sparkles className="w-4 h-4" /> Otro estilo
            </button>
            <button onClick={share} data-testid={`${testid}-share`}
              className="h-12 rounded-2xl font-display font-semibold text-sm flex items-center justify-center gap-1.5 text-white" style={{ background: "#25D366" }}>
              <Share2 className="w-4 h-4" /> Compartir
            </button>
          </div>
          {!user && <p className="mt-3 text-center text-xs flex items-center justify-center gap-1" style={{ color: C.muted }}>Entrar con Google toma 5 segundos <ArrowRight className="w-3 h-3" /></p>}
        </motion.div>
      )}
    </div>
  );
}
