"use client";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { PawPrint, ArrowRight, Sparkles, Heart, BookHeart, Mic, Camera, Loader2 } from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { useAuth } from "@/lib/auth";
import { createTalkPreview, getPets } from "@/lib/api";
import { openInstallSheet, useInstallOffer } from "@/components/app/InstallPrompt";
import { isMobile, isStandalone } from "@/lib/install";

const HERO_IMG = "https://images.unsplash.com/photo-1558788353-f76d92427f16?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";

const PREVIEW_LINES = [
  { key: "te_amo", label: "❤️ Te amo" },
  { key: "chistoso", label: "😄 Algo chistoso" },
];

const STEPS = [
  { icon: Sparkles, title: "Crea su universo", desc: "Cuéntanos quién es tu mascota y recibe una bienvenida hecha solo para ella." },
  { icon: Mic, title: "Dale vida", desc: "Imagina lo que te diría, vívelo en aventuras y retratos, todo con su esencia." },
  { icon: BookHeart, title: "Guarda lo que importa", desc: "Cada momento queda en su álbum, creciendo contigo con el tiempo." },
];

export default function Landing() {
  const nav = useNavigate();
  const { user } = useAuth();
  const reduce = useReducedMotion();
  const [hasPets, setHasPets] = useState(false);
  const installOffer = useInstallOffer();

  useEffect(() => {
    if (!user) { setHasPets(false); return; }
    getPets().then((p) => {
      setHasPets(p.length > 0);
      // Opened from the home-screen icon: skip the landing and go straight to their pet.
      if (p.length > 0 && (isStandalone() || new URLSearchParams(window.location.search).get("app") === "1")) nav("/universo", { replace: true });
    }).catch(() => setHasPets(false));
  }, [user]); // eslint-disable-line

  const startUniverse = () => {
    if (user) nav(hasPets ? "/universo" : "/bienvenida");
    else nav("/bienvenida"); // RequireAuth shows login, returns here after
  };

  const fade = (d = 0) => reduce
    ? {}
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: d } };

  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="landing-screen">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2 font-display font-semibold" style={{ color: "#B85C3C" }}>
          <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: "#B85C3C" }}>
            <PawPrint className="w-5 h-5 text-white" />
          </div>
          Petito
        </div>
        <ProfileMenu />
      </div>

      <div className="flex-1 px-6 pt-4 pb-10 overflow-y-auto no-scrollbar">
        {installOffer && (
          <button onClick={openInstallSheet} data-testid="landing-install"
            className="mb-4 w-full flex items-center gap-3 p-3 rounded-2xl border text-left shadow-sm" style={{ background: "#fff", borderColor: "#EEE3D2" }}>
            <img src="/apple-touch-icon.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm" style={{ color: "#3A2A20" }}>{isMobile() ? "Agrega Petito a tu teléfono" : "Instala Petito en tu computador"}</div>
              <div className="text-xs mt-0.5" style={{ color: "#8A7868" }}>{isMobile() ? "Un ícono en tu inicio, como una app." : "En su propia ventana, como una app."} Sin descargar nada.</div>
            </div>
            <span className="px-3 h-9 rounded-full text-xs font-display font-bold text-white grid place-items-center shrink-0" style={{ background: "#B85C3C" }}>Agregar</span>
          </button>
        )}

        <motion.div {...fade(0)}
          className="relative rounded-[2rem] overflow-hidden shadow-xl border-4 border-white"
          style={{ aspectRatio: "4 / 5", maxHeight: 200, margin: "0 auto" }}>
          <img src={HERO_IMG} alt="Mascota querida" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(58,32,20,0.55), transparent 55%)" }} />
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-white text-xs font-semibold">
            <Heart className="w-4 h-4" fill="currentColor" /> Su universo, para siempre
          </div>
        </motion.div>

        <motion.h1 {...fade(0.12)}
          className="mt-5 font-display font-bold text-[1.75rem] leading-[1.1] tracking-tight" style={{ color: "#3A2A20" }}
          data-testid="landing-headline">
          Su vida es parte de tu historia. <span style={{ color: "#B85C3C" }}>Hagamos que sea inolvidable.</span>
        </motion.h1>
        <motion.div {...fade(0.28)}>
          <VoicePreviewCard onDone={(slug) => nav(`/v/${slug}`)} />
        </motion.div>

        <motion.p {...fade(0.3)} className="mt-5 text-[0.95rem] leading-snug" style={{ color: "#7A6A5E" }}>
          Convierte los momentos con tu mascota en historias, recuerdos, aventuras y pequeñas sorpresas llenas de cariño.
        </motion.p>

        <motion.button {...fade(0.32)} whileTap={reduce ? undefined : { scale: 0.97 }}
          onClick={startUniverse} data-testid="landing-create-universe"
          className="mt-4 w-full h-14 rounded-2xl font-display font-bold text-base flex items-center justify-center gap-2 bg-white border-2"
          style={{ color: "#B85C3C", borderColor: "#E7C9B5" }}>
          <Sparkles className="w-5 h-5" /> Crea el universo de tu mascota
        </motion.button>

        <motion.button {...fade(0.36)}
          onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" })}
          data-testid="landing-how-it-works"
          className="mt-3 w-full h-12 rounded-2xl font-display font-semibold text-sm flex items-center justify-center gap-1.5 bg-white border"
          style={{ color: "#8A6D4B", borderColor: "#EADFCF" }}>
          Descubre cómo funciona <ArrowRight className="w-4 h-4" />
        </motion.button>

        {user && hasPets && (
          <button onClick={() => nav("/universo")} data-testid="landing-enter-universe"
            className="mt-4 w-full h-12 rounded-2xl font-display font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: "#F0E7D8", color: "#6E5B3E" }}>
            <PawPrint className="w-4 h-4" /> Entrar a mi universo
          </button>
        )}

        <div id="como-funciona" className="mt-12 scroll-mt-4">
          <h2 className="font-display font-bold text-lg" style={{ color: "#3A2A20" }}>Cómo funciona</h2>
          <div className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <motion.div key={s.title} {...fade(0.05 * i)}
                className="flex items-start gap-3 p-4 rounded-2xl bg-white border" style={{ borderColor: "#EEE3D2" }}
                data-testid={`landing-step-${i}`}>
                <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: "#F3E9DA", color: "#B85C3C" }}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display font-bold" style={{ color: "#3A2A20" }}>{s.title}</div>
                  <div className="text-sm mt-0.5" style={{ color: "#8A7868" }}>{s.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="mt-5 text-center text-xs" style={{ color: "#A7937F" }}>
            Lo imaginado por IA siempre va marcado. Tus recuerdos reales son solo tuyos. 🐾
          </p>
        </div>

        {user?.is_admin && (
          <button onClick={() => nav("/admin")} className="w-full mt-10 text-xs" style={{ color: "#C3B4A3" }} data-testid="landing-admin-link">
            Panel de administración
          </button>
        )}
      </div>
    </div>
  );
}

/** No-login "hear your pet" preview: 1 photo -> short watermarked talking video at /v/:slug. */
function VoicePreviewCard({ onDone }) {
  const inputRef = useRef();
  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState("");
  const [line, setLine] = useState(PREVIEW_LINES[0].key);
  const [busy, setBusy] = useState(false);

  const pick = (files) => {
    const f = files?.[0];
    if (f) setPhoto({ file: f, url: URL.createObjectURL(f) });
  };

  const start = async () => {
    if (!photo) return inputRef.current?.click();
    setBusy(true);
    try {
      const r = await createTalkPreview(photo.file, { pet_name: name.trim() || undefined, scenario: line });
      onDone(r.slug);
    } catch (e) {
      const status = e?.response?.status;
      toast.error(e?.response?.data?.detail
        || (status >= 500 ? "Estamos con alta demanda. Intenta en un momento 🐾" : "No pudimos usar esa foto. Prueba con otra."));
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-3xl bg-white border p-4 shadow-xl" style={{ borderColor: "#EEE3D2", boxShadow: "0 14px 30px -14px rgba(194,104,63,0.45)" }}
      data-testid="landing-voice-card">
      <div className="font-display font-bold text-lg" style={{ color: "#3A2A20" }}>Escucha lo que te diría 🐾</div>
      <div className="text-sm mt-0.5" style={{ color: "#8A7868" }}>Sube su foto y en un minuto te habla. Gratis y sin cuenta.</div>

      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
        onChange={(e) => { pick(e.target.files); e.target.value = ""; }} data-testid="landing-voice-input" />
      <div className="mt-4 flex items-center gap-3">
        <button onClick={() => inputRef.current?.click()} disabled={busy} data-testid="landing-voice-photo"
          className="w-20 h-24 rounded-2xl overflow-hidden shrink-0 grid place-items-center border-2 border-dashed"
          style={{ borderColor: photo ? "transparent" : "#E7C9B5", background: "#FBF6EE", color: "#B85C3C" }}>
          {photo ? <img src={photo.url} alt="Tu mascota" className="w-full h-full object-cover" />
            : <span className="flex flex-col items-center gap-1 text-xs font-semibold"><Camera className="w-6 h-6" /> Su foto</span>}
        </button>
        <div className="flex-1 min-w-0">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="¿Cómo se llama?"
            className="w-full h-11 px-3 rounded-xl border text-base outline-none" style={{ borderColor: "#EADFCF", background: "#FBF6EE" }}
            data-testid="landing-voice-name" />
          <div className="mt-2 flex gap-2">
            {PREVIEW_LINES.map((l) => (
              <button key={l.key} onClick={() => setLine(l.key)} data-testid={`landing-voice-line-${l.key}`}
                className="flex-1 h-9 rounded-full text-xs font-semibold border"
                style={line === l.key ? { background: "#C2683F", color: "#fff", borderColor: "#C2683F" } : { color: "#8A6D4B", borderColor: "#EADFCF" }}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={start} disabled={busy} data-testid="landing-voice-start"
        className="mt-4 w-full h-14 rounded-2xl text-white font-display font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-80"
        style={{ background: "#C2683F", boxShadow: "0 14px 30px -10px rgba(194,104,63,0.6)" }}>
        {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Subiendo su foto...</>
          : photo ? <><Mic className="w-5 h-5" /> Darle voz</> : <><Camera className="w-5 h-5" /> Subir su foto</>}
      </button>
    </div>
  );
}
