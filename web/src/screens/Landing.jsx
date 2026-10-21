"use client";
import { HomeLink } from "@/components/HomeLink";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { PawPrint, Sparkles, BookHeart, Mic, Camera, Loader2 } from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { useAuth } from "@/lib/auth";
import { createTalkPreview, getPets } from "@/lib/api";
import { openInstallSheet, useInstallOffer } from "@/components/app/InstallPrompt";
import { isMobile, isStandalone } from "@/lib/install";
import TryPortrait from "@/components/TryPortrait";
import Showcase from "@/components/Showcase";


const PREVIEW_LINES = [
  { key: "te_amo", label: "❤️ Te amo" },
  { key: "chistoso", label: "😄 Algo chistoso" },
];

// The no-login "Escucha lo que te diría" card. Hidden for now; set to true to bring it back.
const SHOW_VOICE_PREVIEW = false;

const STEPS = [
  { icon: Camera, title: "Sube una foto" },
  { icon: Sparkles, title: "Mírala en un minuto" },
  { icon: BookHeart, title: "Guárdala y comparte" },
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

  const fade = (d = 0) => reduce
    ? {}
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: d } };

  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="landing-screen">
      <div className="flex items-center justify-between px-5 pt-5">
        <HomeLink className="flex items-center gap-2 font-display font-semibold" style={{ color: "#B85C3C" }}>
          <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: "#B85C3C" }}>
            <PawPrint className="w-5 h-5 text-white" />
          </div>
          Petito
        </HomeLink>
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

        <motion.h1 {...fade(0)}
          className="font-display font-bold text-[1.75rem] leading-[1.1] tracking-tight" style={{ color: "#3A2A20" }}
          data-testid="landing-headline">
          Mira a tu mascota <span style={{ color: "#B85C3C" }}>como nunca la viste.</span>
        </motion.h1>
        <motion.p {...fade(0.08)} className="mt-2 text-[0.95rem] leading-snug" style={{ color: "#7A6A5E" }} data-testid="landing-subhead">
          Con una sola foto: un retrato de realeza, un video donde te habla con su voz y su propia canción.
        </motion.p>

        <motion.div {...fade(0.14)} className="mt-5">
          <Showcase />
        </motion.div>

        <motion.div {...fade(0.2)} className="mt-5">
          <TryPortrait title="Pruébalo con su foto, ahora" subtitle="Tu mascota como realeza, con corona, trono y su título. Gratis, sin cuenta, en menos de un minuto." sample={null} testid="landing-try" />
        </motion.div>
        {SHOW_VOICE_PREVIEW && (
          <motion.div {...fade(0.28)}>
            <VoicePreviewCard onDone={(slug) => nav(`/v/${slug}`)} />
          </motion.div>
        )}

        {user && hasPets && (
          <button onClick={() => nav("/universo")} data-testid="landing-enter-universe"
            className="mt-4 w-full h-12 rounded-2xl font-display font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: "#F0E7D8", color: "#6E5B3E" }}>
            <PawPrint className="w-4 h-4" /> Entrar a mi universo
          </button>
        )}

        <div id="como-funciona" className="mt-10 scroll-mt-4">
          <div className="grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => (
              <motion.div key={s.title} {...fade(0.05 * i)}
                className="p-3 rounded-2xl bg-white border text-center" style={{ borderColor: "#EEE3D2" }}
                data-testid={`landing-step-${i}`}>
                <div className="w-9 h-9 mx-auto rounded-xl grid place-items-center" style={{ background: "#F3E9DA", color: "#B85C3C" }}>
                  <s.icon className="w-4 h-4" />
                </div>
                <div className="mt-2 font-display font-bold text-xs leading-tight" style={{ color: "#3A2A20" }}>{s.title}</div>
              </motion.div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs" style={{ color: "#A7937F" }}>
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
