"use client";
import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router";
import { motion, useReducedMotion } from "framer-motion";
import { PawPrint, ArrowRight, Sparkles, Heart, BookHeart, Mic } from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { useAuth } from "@/lib/auth";
import { getPets } from "@/lib/api";

const HERO_IMG = "https://images.unsplash.com/photo-1558788353-f76d92427f16?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";

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

  useEffect(() => {
    if (!user) { setHasPets(false); return; }
    getPets().then((p) => setHasPets(p.length > 0)).catch(() => setHasPets(false));
  }, [user]);

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

      <div className="flex-1 px-6 pt-6 pb-10 overflow-y-auto no-scrollbar">
        <motion.div {...fade(0)}
          className="relative rounded-[2rem] overflow-hidden shadow-xl border-4 border-white"
          style={{ aspectRatio: "4 / 5", maxHeight: 360, margin: "0 auto" }}>
          <img src={HERO_IMG} alt="Mascota querida" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(58,32,20,0.55), transparent 55%)" }} />
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-white text-xs font-semibold">
            <Heart className="w-4 h-4" fill="currentColor" /> Su universo, para siempre
          </div>
        </motion.div>

        <motion.h1 {...fade(0.12)}
          className="mt-7 font-display font-bold text-[2rem] leading-[1.1] tracking-tight" style={{ color: "#3A2A20" }}
          data-testid="landing-headline">
          Su vida es parte de tu historia. <span style={{ color: "#B85C3C" }}>Hagamos que sea inolvidable.</span>
        </motion.h1>
        <motion.p {...fade(0.2)} className="mt-3 text-base leading-relaxed" style={{ color: "#7A6A5E" }}>
          Convierte los momentos con tu mascota en historias, recuerdos, aventuras y pequeñas sorpresas llenas de cariño.
        </motion.p>

        <motion.button {...fade(0.28)} whileTap={reduce ? undefined : { scale: 0.97 }}
          onClick={startUniverse} data-testid="landing-create-universe"
          className="mt-7 w-full h-16 rounded-2xl text-white font-display font-bold text-lg flex items-center justify-center gap-2 shadow-xl"
          style={{ background: "#C2683F", boxShadow: "0 14px 30px -10px rgba(194,104,63,0.6)" }}>
          <Sparkles className="w-6 h-6" /> Crea el universo de tu mascota
        </motion.button>

        <motion.button {...fade(0.34)}
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

        <button onClick={() => nav("/admin")} className="w-full mt-10 text-xs" style={{ color: "#C3B4A3" }} data-testid="landing-admin-link">
          Panel de administración
        </button>
      </div>
    </div>
  );
}
