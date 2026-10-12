import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PawPrint, ArrowRight, Film, Crown, Mic, Images, ImagePlus, Loader2, Volume2, Heart } from "lucide-react";
import { InviteButton } from "@/components/InviteButton";
import { ProfileMenu } from "@/components/ProfileMenu";
import { useAuth } from "@/lib/auth";
import { createTalkPreview } from "@/lib/api";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const HERO_VIDEO = `${BACKEND}/api/media/1a14af57-5b2f-47fb-b122-fb442aeb4031/preview.mp4`;
const HERO_POSTER = `${BACKEND}/api/media/1a14af57-5b2f-47fb-b122-fb442aeb4031/source.jpg`;

const RETRATO_SAMPLE = "https://static.prod-images.emergentagent.com/jobs/55d7bedb-acdf-4650-a697-273c1ee82bf7/images/42f75f4b075be62844c2842e416061b8e10596f349513a4510d5b36c3a79d343.jpeg";
const HISTORIA_SAMPLE = "https://images.unsplash.com/photo-1591208333284-825682219525?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

const CARDS = [
  { key: "retrato", to: "/retrato", icon: Crown, title: "Crear retrato", desc: "Una pintura de realeza con marco dorado", img: RETRATO_SAMPLE, accent: "from-amber-500/90 to-orange-600/90" },
  { key: "historia", to: "/crear", icon: Film, title: "Crear historia", desc: "Un carrusel con frases en su voz", img: HISTORIA_SAMPLE, accent: "from-rose-500/90 to-primary/90" },
];

export default function Landing() {
  const nav = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const onMagic = () => inputRef.current?.click();

  const onFile = async (list) => {
    const f = Array.from(list).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    setUploading(true);
    try {
      const res = await createTalkPreview(f);
      nav(`/v/${res.slug}`);
    } catch (e) {
      const msg = e?.response?.status === 429
        ? "Llegaste al límite de adelantos gratis de hoy. ¡Crea el tuyo completo!"
        : (e?.response?.data?.detail || "No se pudo crear el adelanto");
      toast.error(msg);
      setUploading(false);
    }
  };

  return (
    <div className="mobile-frame" data-testid="landing-screen">
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { onFile(e.target.files); e.target.value = ""; }} data-testid="landing-magic-input" />

      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2 font-display font-semibold text-primary">
          <div className="w-8 h-8 rounded-full bg-primary grid place-items-center"><PawPrint className="w-5 h-5 text-white" /></div>
          Petito
        </div>
        <div className="flex items-center gap-2">
          <InviteButton />
          <ProfileMenu />
        </div>
      </div>

      <div className="flex-1 px-5 pt-5 pb-10 overflow-y-auto no-scrollbar">
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="font-display font-bold text-4xl leading-[1.05] tracking-tight text-neutral-900" data-testid="landing-headline">
          Haz que tu mascota <span className="text-primary">hable</span> 🗣️
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-2 text-base text-muted-foreground leading-relaxed">
          Sube una foto y mira la magia. Gratis y al toque 🐾
        </motion.p>

        {/* Hero talking video */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-5 relative mx-auto rounded-[1.8rem] overflow-hidden bg-stone-900 border-4 border-white shadow-2xl" style={{ aspectRatio: "9 / 16", maxWidth: 260 }}>
          <video src={HERO_VIDEO} poster={HERO_POSTER} className="w-full h-full object-cover" autoPlay loop muted playsInline />
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/55 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
            <Volume2 className="w-3.5 h-3.5" /> con su propia voz
          </div>
        </motion.div>

        <motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
          whileTap={{ scale: 0.97 }} onClick={onMagic} disabled={uploading} data-testid="landing-magic-button"
          className="mt-6 w-full h-16 rounded-2xl bg-primary text-white font-display font-bold text-lg flex items-center justify-center gap-2 shadow-xl shadow-primary/30 disabled:opacity-70">
          {uploading ? <><Loader2 className="w-6 h-6 animate-spin" /> Subiendo foto...</>
            : <><ImagePlus className="w-6 h-6" /> Sube una foto y mira la magia</>}
        </motion.button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Adelanto gratis, sin cuenta · marca de agua Petito</p>

        {/* Other creation cards */}
        <div className="mt-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">o crea algo más</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="mt-4 space-y-3">
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => nav("/hablar")} data-testid="landing-choice-habla"
            className="relative w-full flex items-center gap-3 p-3 rounded-2xl bg-primary/10 border-2 border-primary/30 text-left">
            <div className="w-12 h-12 rounded-xl bg-primary grid place-items-center text-white shrink-0"><Mic className="w-6 h-6" /></div>
            <div className="flex-1">
              <div className="font-display font-bold text-neutral-900">Video completo que habla</div>
              <div className="text-xs text-muted-foreground">~8s, elige la voz, descarga en HD</div>
            </div>
            <span className="text-[10px] font-bold text-primary bg-white px-2 py-0.5 rounded-full">Nuevo ✨</span>
          </motion.button>

          {CARDS.map((c) => (
            <motion.button key={c.key} whileTap={{ scale: 0.98 }} onClick={() => nav(c.to)} data-testid={`landing-choice-${c.key}`}
              className="relative w-full h-28 rounded-2xl overflow-hidden shadow-lg border-4 border-white text-left group">
              <img src={c.img} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
              <div className={`absolute inset-0 bg-gradient-to-tr ${c.accent} mix-blend-multiply opacity-80`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center gap-2 text-white">
                <div className="w-8 h-8 rounded-full bg-white/25 backdrop-blur grid place-items-center"><c.icon className="w-4.5 h-4.5" /></div>
                <div className="flex-1">
                  <div className="font-display font-bold">{c.title}</div>
                  <div className="text-xs text-white/90">{c.desc}</div>
                </div>
                <ArrowRight className="w-5 h-5" />
              </div>
            </motion.button>
          ))}

          <motion.button whileTap={{ scale: 0.98 }} onClick={() => nav("/recuerdo")} data-testid="landing-choice-recuerdo"
            className="relative w-full flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-200 text-left">
            <div className="w-12 h-12 rounded-xl bg-slate-100 grid place-items-center text-slate-500 shrink-0"><Heart className="w-6 h-6" /></div>
            <div className="flex-1">
              <div className="font-display font-bold text-slate-700">Retrato recuerdo</div>
              <div className="text-xs text-slate-400">Un homenaje sereno para quien siempre estará contigo</div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400" />
          </motion.button>
        </div>

        {user && (
          <button onClick={() => nav("/mis-creaciones")} data-testid="landing-my-creations"
            className="mt-6 w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-white border border-border text-sm font-display font-semibold text-neutral-700 active:scale-[0.98] transition-transform">
            <Images className="w-4 h-4 text-primary" /> Ver mis creaciones
          </button>
        )}

        <button onClick={() => nav("/admin")} className="w-full mt-8 text-xs text-muted-foreground" data-testid="landing-admin-link">
          Panel de administración
        </button>
      </div>
    </div>
  );
}
