import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Mic, Film, Crown, Plus, ChevronDown, Heart, CalendarHeart, Images, ArrowRight } from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { mediaUrl, getPets, petCreations, getActivePetId, setActivePetId } from "@/lib/api";

const KIND_BADGE = {
  historia: { label: "Historia", color: "#B85C3C" },
  retrato: { label: "Retrato", color: "#C79A3B" },
  recuerdo: { label: "Recuerdo", color: "#7C8AA0" },
  video: { label: "Video", color: "#8A9B6E" },
};

export default function Universe() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const [pets, setPets] = useState(null);
  const [active, setActive] = useState(null);
  const [creations, setCreations] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadCreations = useCallback((petId) => {
    petCreations(petId).then(setCreations).catch(() => setCreations([]));
  }, []);

  useEffect(() => {
    getPets().then((list) => {
      if (!list.length) { nav("/bienvenida", { replace: true }); return; }
      setPets(list);
      const stored = getActivePetId();
      const chosen = list.find((p) => p.id === stored) || list[0];
      setActive(chosen);
      setActivePetId(chosen.id);
      loadCreations(chosen.id);
    }).catch(() => nav("/", { replace: true }));
  }, [nav, loadCreations]);

  const switchPet = (p) => {
    setActive(p);
    setActivePetId(p.id);
    setCreations([]);
    loadCreations(p.id);
    setPickerOpen(false);
  };

  if (!active) {
    return (
      <div className="mobile-frame grid place-items-center" style={{ background: "#FBF6EE" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C2683F" }} />
      </div>
    );
  }

  const name = active.name;
  const invitations = [
    { key: "habla", icon: Mic, title: `Imagina lo que ${name} te diría`, desc: "Dale voz en un video", to: "/hablar", bg: "#FBEEE4", fg: "#B85C3C" },
    { key: "historia", icon: Film, title: "Creen una aventura juntos", desc: "Una historia ilustrada", to: "/crear", bg: "#EEF1E6", fg: "#7A8B5A" },
    { key: "retrato", icon: Crown, title: `Descubre a ${name} en otro mundo`, desc: "Un retrato de realeza", to: "/retrato", bg: "#FBF3DD", fg: "#C79A3B" },
  ];

  const fade = (d = 0) => reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: d } };

  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="universe-screen">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="relative">
          <button onClick={() => pets?.length > 1 && setPickerOpen((o) => !o)} data-testid="universe-pet-picker"
            className="flex items-center gap-2 px-2 py-1 rounded-full">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow" style={{ background: "#F3E9DA" }}>
              {active.photo_url && <img src={mediaUrl(active.photo_url)} alt={name} className="w-full h-full object-cover" />}
            </div>
            <span className="font-display font-bold" style={{ color: "#3A2A20" }}>{name}</span>
            {pets?.length > 1 && <ChevronDown className="w-4 h-4" style={{ color: "#8A6D4B" }} />}
          </button>
          {pickerOpen && (
            <div className="absolute left-0 mt-2 w-60 bg-white rounded-2xl border shadow-xl z-50 overflow-hidden" style={{ borderColor: "#EADFCF" }} data-testid="universe-pet-list">
              {pets.map((p) => (
                <button key={p.id} onClick={() => switchPet(p)} data-testid={`universe-pet-${p.id}`}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#FBF6EE] text-left">
                  <div className="w-8 h-8 rounded-full overflow-hidden" style={{ background: "#F3E9DA" }}>
                    {p.photo_url && <img src={mediaUrl(p.photo_url)} alt={p.name} className="w-full h-full object-cover" />}
                  </div>
                  <span className="font-display font-semibold text-sm" style={{ color: "#3A2A20" }}>{p.name}</span>
                </button>
              ))}
              <button onClick={() => nav("/bienvenida")} data-testid="universe-add-pet"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 border-t hover:bg-[#FBF6EE] text-left" style={{ borderColor: "#EADFCF" }}>
                <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: "#FBEEE4", color: "#B85C3C" }}><Plus className="w-4 h-4" /></div>
                <span className="font-display font-semibold text-sm" style={{ color: "#B85C3C" }}>Agregar otra mascota</span>
              </button>
            </div>
          )}
        </div>
        <ProfileMenu />
      </div>

      <div className="flex-1 px-6 pt-5 pb-10 overflow-y-auto no-scrollbar">
        <motion.div {...fade(0)} className="relative rounded-[2rem] overflow-hidden border-4 border-white shadow-xl"
          style={{ aspectRatio: "4 / 3", maxHeight: 280 }}>
          {active.photo_url && <img src={mediaUrl(active.photo_url)} alt={name} className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(58,32,20,0.75), transparent 60%)" }} />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="font-script text-4xl text-white">{name}</div>
            <div className="text-xs text-white/85 font-display">El universo de {name}</div>
          </div>
        </motion.div>

        {active.intro_text && (
          <motion.p {...fade(0.1)} className="mt-5 text-sm leading-relaxed font-display text-center px-1" style={{ color: "#6E5B4E" }} data-testid="universe-intro">
            {active.intro_text}
          </motion.p>
        )}

        <h2 className="mt-8 font-display font-bold text-lg" style={{ color: "#3A2A20" }}>¿Qué quieres vivir hoy?</h2>
        <div className="mt-3 space-y-3">
          {invitations.map((inv, i) => (
            <motion.button key={inv.key} {...fade(0.05 * i)} whileTap={reduce ? undefined : { scale: 0.98 }}
              onClick={() => nav(inv.to)} data-testid={`universe-invite-${inv.key}`}
              className="w-full flex items-center gap-3.5 p-4 rounded-2xl border text-left" style={{ background: inv.bg, borderColor: "rgba(0,0,0,0.04)" }}>
              <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0 bg-white/70" style={{ color: inv.fg }}>
                <inv.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="font-display font-bold" style={{ color: "#3A2A20" }}>{inv.title}</div>
                <div className="text-xs mt-0.5" style={{ color: "#8A7868" }}>{inv.desc}</div>
              </div>
              <ArrowRight className="w-5 h-5" style={{ color: inv.fg }} />
            </motion.button>
          ))}
        </div>

        {/* Creations collection */}
        <div className="mt-8 flex items-center gap-2">
          <Images className="w-4 h-4" style={{ color: "#B85C3C" }} />
          <h2 className="font-display font-bold text-lg" style={{ color: "#3A2A20" }}>La colección de {name}</h2>
        </div>
        {creations.length === 0 ? (
          <div className="mt-3 p-5 rounded-2xl bg-white border text-center" style={{ borderColor: "#EEE3D2" }} data-testid="universe-creations-empty">
            <p className="text-sm" style={{ color: "#8A7868" }}>Aún no hay creaciones. Elige una experiencia de arriba para empezar su álbum. 🐾</p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3" data-testid="universe-creations">
            {creations.map((c) => {
              const badge = KIND_BADGE[c.kind] || KIND_BADGE.retrato;
              return (
                <button key={c.id} onClick={() => nav(c.view_path)} data-testid={`universe-creation-${c.id}`}
                  className="relative rounded-2xl overflow-hidden border-2 border-white shadow-md text-left" style={{ aspectRatio: "3 / 4" }}>
                  <img src={mediaUrl(c.thumb_url)} alt={c.title} className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0.15; }} />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent 55%)" }} />
                  <span className="absolute top-2 left-2 text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: badge.color }}>{badge.label}</span>
                  <span className="absolute bottom-2 left-2 right-2 text-white text-xs font-display font-semibold truncate">{c.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Upcoming dates placeholder */}
        <div className="mt-8 p-4 rounded-2xl border flex items-center gap-3" style={{ background: "#F6EFE2", borderColor: "#EEE3D2" }} data-testid="universe-dates">
          <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: "#fff", color: "#B85C3C" }}><CalendarHeart className="w-5 h-5" /></div>
          <div>
            <div className="font-display font-bold text-sm" style={{ color: "#3A2A20" }}>Fechas especiales</div>
            <div className="text-xs mt-0.5" style={{ color: "#8A7868" }}>Pronto podrás celebrar cumpleaños y aniversarios de {name}.</div>
          </div>
        </div>

        {/* Memorial — calm, optional */}
        <button onClick={() => nav("/recuerdo")} data-testid="universe-memorial-link"
          className="mt-4 w-full flex items-center justify-center gap-2 h-11 rounded-2xl text-xs font-display font-semibold" style={{ color: "#8695A8" }}>
          <Heart className="w-4 h-4" /> Un homenaje sereno para recordar
        </button>
      </div>
    </div>
  );
}
