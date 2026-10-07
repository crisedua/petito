import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PawPrint, Zap, MessageCircleHeart, Sparkles, ArrowRight, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXAMPLES = [
  { img: "https://images.unsplash.com/photo-1591208333284-825682219525?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", cap: "¡Llegué pal Dieciocho más regalón que nunca, poh!", badge: "Dieciochero 🇨🇱" },
  { img: "https://images.unsplash.com/photo-1656839631462-1adf96d4320f?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", cap: "Mi cara de 'dame pancito' nunca falla, humano.", badge: "Un día en mi vida ☀️" },
  { img: "https://images.unsplash.com/photo-1690876821983-cbb72ac167a8?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", cap: "Aventurero nivel plaza: corrí, olí y conquisté.", badge: "Mis aventuras 🏕️" },
];

const FEATURES = [
  { icon: Zap, label: "60 segundos" },
  { icon: MessageCircleHeart, label: "Voz de tu mascota" },
  { icon: PawPrint, label: "Humor chileno" },
  { icon: Share2, label: "Listo pa' compartir" },
];

export default function Landing() {
  const nav = useNavigate();
  const [ex, setEx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setEx((e) => (e + 1) % EXAMPLES.length), 2600);
    return () => clearInterval(t);
  }, []);

  const cur = EXAMPLES[ex];

  return (
    <div className="mobile-frame" data-testid="landing-screen">
      {/* top bar */}
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2 font-display font-semibold text-primary">
          <div className="w-8 h-8 rounded-full bg-primary grid place-items-center">
            <PawPrint className="w-5 h-5 text-white" />
          </div>
          Cuentapatas
        </div>
        <span className="text-xs font-semibold tracking-wide text-muted-foreground bg-white px-3 py-1.5 rounded-full border border-border">🇨🇱 Hecho en Chile</span>
      </div>

      <div className="flex-1 px-5 pt-6 pb-40">
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="font-display font-bold text-4xl leading-[1.08] tracking-tight text-neutral-900"
          data-testid="landing-headline"
        >
          Tu mascota <span className="text-primary">cuenta su historia</span>.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-3 text-base text-muted-foreground leading-relaxed"
        >
          Sube fotos de tu regalón y recibe una historia vertical con frases en su voz y humor bien chileno. Lista pa' la Insta y el WhatsApp.
        </motion.p>

        {/* example story */}
        <div className="mt-7 flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.15 }}
            className="relative w-[230px] rounded-[1.6rem] overflow-hidden shadow-2xl bg-stone-900 border-4 border-white"
            style={{ aspectRatio: "9 / 16" }}
            data-testid="landing-example-story"
          >
            <motion.img key={cur.img} src={cur.img} alt="Ejemplo" className="w-full h-full object-cover"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            <div className="absolute top-3 left-3 right-3 flex gap-1">
              {EXAMPLES.map((_, i) => (
                <div key={i} className="h-1 flex-1 rounded-full bg-white/40 overflow-hidden">
                  <div className={`h-full bg-white transition-all duration-[2600ms] ${i === ex ? "w-full" : "w-0"}`} />
                </div>
              ))}
            </div>
            <span className="absolute top-7 left-3 text-[11px] font-semibold text-white bg-primary/90 px-2.5 py-1 rounded-full">{cur.badge}</span>
            <p className="absolute bottom-4 left-3 right-3 font-display font-semibold text-white text-[15px] leading-snug drop-shadow">
              {cur.cap}
            </p>
          </motion.div>
        </div>

        {/* features */}
        <div className="mt-7 grid grid-cols-2 gap-2.5">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex items-center gap-2 bg-white rounded-2xl px-3.5 py-3 border border-border">
              <div className="w-8 h-8 rounded-full bg-accent/20 grid place-items-center shrink-0">
                <f.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-neutral-800">{f.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 text-accent" /> Pago único · Sin suscripciones · Sin cuenta
        </div>
      </div>

      {/* sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 pb-6 bg-gradient-to-t from-[#FAF6F0] via-[#FAF6F0] to-transparent">
        <Button
          onClick={() => nav("/crear")}
          className="w-full h-14 text-base font-display font-semibold rounded-2xl shadow-lg shadow-primary/30"
          data-testid="landing-hero-cta"
        >
          Crea la historia de tu mascota <ArrowRight className="w-5 h-5 ml-1" />
        </Button>
        <button onClick={() => nav("/admin")} className="w-full mt-3 text-xs text-muted-foreground" data-testid="landing-admin-link">
          Panel de administración
        </button>
      </div>
    </div>
  );
}
