import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Film, Crown, Gift, Check, Lock, PawPrint, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { myStories, myPortraits, mediaUrl } from "@/lib/api";

export default function MyCreations() {
  const nav = useNavigate();
  const [tab, setTab] = useState("portraits");
  const [stories, setStories] = useState(null);
  const [portraits, setPortraits] = useState(null);

  useEffect(() => {
    myStories().then(setStories).catch(() => setStories([]));
    myPortraits().then(setPortraits).catch(() => setPortraits([]));
  }, []);

  const loading = stories === null || portraits === null;

  return (
    <div className="mobile-frame" data-testid="my-creations-screen">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => nav("/")} className="w-9 h-9 rounded-full bg-white border border-border grid place-items-center" data-testid="creations-back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="flex-1 font-display font-bold text-xl text-neutral-900">Mis creaciones</h1>
      </div>

      <div className="flex gap-2 px-5 mt-5">
        {[["portraits", "Mis retratos", Crown], ["stories", "Mis historias", Film]].map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`creations-tab-${k}`}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-display font-semibold transition-all ${tab === k ? "bg-primary text-white" : "bg-white border border-border text-neutral-600"}`}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5 pt-5 pb-10 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : tab === "portraits" ? (
          portraits.length === 0 ? (
            <Empty icon={Crown} text="Aún no tienes retratos" cta="Crear un retrato" onClick={() => nav("/retrato")} />
          ) : (
            <div className="grid grid-cols-2 gap-3" data-testid="portraits-grid">
              {portraits.map((p) => (
                <Card key={p.id} onClick={() => nav(`/r/${p.slug}`)} testid={`portrait-card-${p.id}`}
                  thumb={mediaUrl(p.thumb_url)} title={p.pet_name || "Retrato"} subtitle={p.style_label}
                  paid={p.paid} badge={p.gift_enabled ? Gift : null} />
              ))}
            </div>
          )
        ) : (
          stories.length === 0 ? (
            <Empty icon={Film} text="Aún no tienes historias" cta="Crear una historia" onClick={() => nav("/crear")} />
          ) : (
            <div className="grid grid-cols-2 gap-3" data-testid="stories-grid">
              {stories.map((s) => (
                <Card key={s.id} onClick={() => nav(`/h/${s.slug}`)} testid={`story-card-${s.id}`}
                  thumb={mediaUrl(s.thumb_url)} title={s.pet_name} subtitle={s.theme_label} paid={s.paid} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Card({ onClick, thumb, title, subtitle, paid, badge: Badge, testid }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} data-testid={testid}
      className="text-left rounded-2xl overflow-hidden bg-white border border-border shadow-sm">
      <div className="relative w-full bg-stone-200" style={{ aspectRatio: "3 / 4" }}>
        {thumb && <img src={thumb} alt={title} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />}
        <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${paid ? "bg-emerald-500 text-white" : "bg-black/60 text-white"}`}>
          {paid ? <><Check className="w-3 h-3" /> HD</> : <><Lock className="w-3 h-3" /> Vista previa</>}
        </span>
        {Badge && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-white grid place-items-center"><Badge className="w-3.5 h-3.5" /></span>}
      </div>
      <div className="p-2.5">
        <div className="font-display font-semibold text-neutral-900 text-sm truncate">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>
    </motion.button>
  );
}

function Empty({ icon: Icon, text, cta, onClick }) {
  return (
    <div className="flex flex-col items-center text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 grid place-items-center mb-4"><Icon className="w-8 h-8 text-primary" /></div>
      <p className="font-display font-semibold text-neutral-900">{text}</p>
      <Button onClick={onClick} className="mt-5 rounded-2xl font-semibold"><Plus className="w-4 h-4 mr-1" /> {cta}</Button>
    </div>
  );
}
