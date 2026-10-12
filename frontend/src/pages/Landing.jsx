import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PawPrint, Sparkles, ArrowRight, Film, Crown } from "lucide-react";
import { InviteButton } from "@/components/InviteButton";

const RETRATO_SAMPLE = "https://static.prod-images.emergentagent.com/jobs/55d7bedb-acdf-4650-a697-273c1ee82bf7/images/42f75f4b075be62844c2842e416061b8e10596f349513a4510d5b36c3a79d343.jpeg";
const HISTORIA_SAMPLE = "https://images.unsplash.com/photo-1591208333284-825682219525?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

const CHOICES = [
  {
    key: "retrato",
    to: "/retrato",
    icon: Crown,
    title: "Crear retrato",
    desc: "Una pintura de realeza con marco dorado. Vista previa gratis.",
    img: RETRATO_SAMPLE,
    badge: "Nuevo ✨",
    accent: "from-amber-500/90 to-orange-600/90",
  },
  {
    key: "historia",
    to: "/crear",
    icon: Film,
    title: "Crear historia",
    desc: "Un carrusel vertical con frases en la voz de tu mascota.",
    img: HISTORIA_SAMPLE,
    badge: "Clásico",
    accent: "from-rose-500/90 to-primary/90",
  },
];

export default function Landing() {
  const nav = useNavigate();
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTilt((x) => (x + 1) % 2), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mobile-frame" data-testid="landing-screen">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2 font-display font-semibold text-primary">
          <div className="w-8 h-8 rounded-full bg-primary grid place-items-center">
            <PawPrint className="w-5 h-5 text-white" />
          </div>
          Petito
        </div>
        <InviteButton />
      </div>

      <div className="flex-1 px-5 pt-6 pb-10 overflow-y-auto no-scrollbar">
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="font-display font-bold text-4xl leading-[1.08] tracking-tight text-neutral-900"
          data-testid="landing-headline"
        >
          Tu mascota, <span className="text-primary">de película</span>.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-3 text-base text-muted-foreground leading-relaxed"
        >
          Elige qué quieres crear hoy con tu regalón. Dos formas de hacerlo brillar 🐾
        </motion.p>

        <div className="mt-6 space-y-4">
          {CHOICES.map((c, i) => (
            <motion.button
              key={c.key}
              onClick={() => nav(c.to)}
              data-testid={`landing-choice-${c.key}`}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              whileTap={{ scale: 0.97 }}
              className="relative w-full h-44 rounded-[1.6rem] overflow-hidden shadow-xl border-4 border-white text-left group"
            >
              <img src={c.img} alt={c.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-active:scale-105" />
              <div className={`absolute inset-0 bg-gradient-to-tr ${c.accent} mix-blend-multiply opacity-80`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute top-3 right-3 text-[11px] font-semibold text-neutral-900 bg-white/90 px-2.5 py-1 rounded-full">{c.badge}</span>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2 text-white">
                  <div className="w-9 h-9 rounded-full bg-white/25 backdrop-blur grid place-items-center">
                    <c.icon className="w-5 h-5" />
                  </div>
                  <span className="font-display font-bold text-xl">{c.title}</span>
                  <ArrowRight className="w-5 h-5 ml-auto" />
                </div>
                <p className="mt-1.5 text-sm text-white/90 leading-snug">{c.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>

        <div className="mt-7 flex items-center justify-center gap-2 text-sm text-muted-foreground text-center">
          <Sparkles className="w-4 h-4 text-accent shrink-0" /> Sin cuenta · Vista previa gratis · Humor y cariño chileno
        </div>

        <button onClick={() => nav("/admin")} className="w-full mt-8 text-xs text-muted-foreground" data-testid="landing-admin-link">
          Panel de administración
        </button>
      </div>
    </div>
  );
}
