"use client";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@/lib/router";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Mic, Film, Crown, Plus as PlusIcon, ChevronDown, Heart, CalendarHeart, Images, ArrowRight, BookHeart, Settings, Cake, Users } from "lucide-react";
import { toast } from "sonner";
import { ProfileMenu } from "@/components/ProfileMenu";
import { mediaUrl, getPets, petCreations, getActivePetId, setActivePetId, plusStatus, friendsSummary } from "@/lib/api";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function nextOccurrence(raw) {
  // raw "YYYY-MM-DD" or "MM-DD" -> next occurrence from today (local)
  const parts = raw.split("-").map(Number);
  const [mo, da] = parts.length === 3 ? [parts[1], parts[2]] : [parts[0], parts[1]];
  if (!mo || !da) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), mo - 1, da);
  if (next < today) next = new Date(now.getFullYear() + 1, mo - 1, da);
  const days = Math.round((next - today) / 86400000);
  return { mo, da, days };
}

function buildSpecialDates(pet, name) {
  const defs = [
    { key: "birthday", raw: pet.birthday, label: `Cumpleaños de ${name}`, icon: <Cake className="w-5 h-5" /> },
    { key: "adoption", raw: pet.adoption_date, label: "Aniversario de adopción", icon: <Heart className="w-5 h-5" /> },
  ];
  const out = [];
  for (const d of defs) {
    if (!d.raw) continue;
    const n = nextOccurrence(d.raw);
    if (!n) continue;
    const badge = n.days === 0 ? "¡Hoy! 🎉" : n.days === 1 ? "Mañana" : `en ${n.days} días`;
    out.push({ ...d, when: `${n.da} de ${MESES[n.mo - 1]}`, badge, days: n.days });
  }
  return out.sort((a, b) => a.days - b.days);
}

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
  const [plus, setPlus] = useState(false);
  const [friendRequests, setFriendRequests] = useState(0);

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
    plusStatus().then((s) => setPlus(s.active)).catch(() => {});
    friendsSummary().then((s) => setFriendRequests(s.pending)).catch(() => {});
    if (new URLSearchParams(window.location.search).get("plus") === "success") {
      toast.success("¡Bienvenido a Petito Plus! 👑 Ahora todo es ilimitado.");
    }
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
    { key: "recuerdo", icon: BookHeart, title: "Guarda un recuerdo especial", desc: "Un momento real para siempre", to: "/album", bg: "#F3EAF0", fg: "#9C5F86" },
    { key: "habla", icon: Mic, title: `${name} habla… o te canta`, desc: "Un videomensaje para quien tú elijas, o su propia canción", to: "/hablar", bg: "#FBEEE4", fg: "#B85C3C" },
    { key: "historia", icon: Film, title: "Creen una aventura juntos", desc: "Una historia ilustrada", to: "/crear", bg: "#EEF1E6", fg: "#7A8B5A" },
    { key: "retrato", icon: Crown, title: `Descubre a ${name} en otro mundo`, desc: "Un retrato de realeza", to: "/retrato", bg: "#FBF3DD", fg: "#C79A3B" },
  ];

  const fade = (d = 0) => reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: d } };

  const specialDates = buildSpecialDates(active, name);

  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="universe-screen">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="relative">
          <button onClick={() => pets?.length > 1 && setPickerOpen((o) => !o)} data-testid="universe-pet-picker"
            className="flex items-center gap-2 px-2 py-1 rounded-full">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow grid place-items-center" style={{ background: "#E2A878" }}>
              {active.photo_url
                ? <img src={mediaUrl(active.photo_url)} alt={name} onError={(e) => { e.currentTarget.style.display = "none"; }} className="w-full h-full object-cover" />
                : <span className="font-display font-bold text-white text-sm">{(name || "P").charAt(0).toUpperCase()}</span>}
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
                <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: "#FBEEE4", color: "#B85C3C" }}><PlusIcon className="w-4 h-4" /></div>
                <span className="font-display font-semibold text-sm" style={{ color: "#B85C3C" }}>Agregar otra mascota</span>
              </button>
            </div>
          )}
        </div>
        <ProfileMenu />
      </div>

      <div className="flex items-center justify-between px-6 pt-3">
        {plus ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-display font-bold text-stone-900" style={{ background: "#F5C355" }} data-testid="universe-plus-badge">
            <Crown className="w-3.5 h-3.5" /> Plus
          </span>
        ) : (
          <button onClick={() => nav("/plus")} data-testid="universe-plus-cta"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-display font-bold text-stone-900" style={{ background: "#F5C355" }}>
            <Crown className="w-3.5 h-3.5" /> Hazte Plus
          </button>
        )}
        <button onClick={() => nav("/perfil")} data-testid="universe-profile-link"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border text-xs font-display font-semibold" style={{ borderColor: "#EADFCF", color: "#8A6D4B" }}>
          <Settings className="w-3.5 h-3.5" /> Editar perfil
        </button>
      </div>

      <div className="flex-1 px-6 pt-3 pb-10 overflow-y-auto no-scrollbar">
        <motion.div {...fade(0)} className="relative rounded-[2rem] overflow-hidden border-4 border-white shadow-xl"
          style={{ aspectRatio: "4 / 3", maxHeight: 280, background: "linear-gradient(135deg, #F3D9B8, #E2A878)" }}>
          <div className="absolute inset-0 grid place-items-center" aria-hidden>
            <span className="font-script text-white/80" style={{ fontSize: 110, lineHeight: 1 }}>{(name || "P").charAt(0).toUpperCase()}</span>
          </div>
          {active.photo_url && (
            <>
              <img src={mediaUrl(active.photo_url)} alt="" aria-hidden onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-cover scale-110" style={{ filter: "blur(16px)", opacity: 0.6 }} />
              <img src={mediaUrl(active.photo_url)} alt={name} onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 w-full h-full object-contain" />
            </>
          )}
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

        <motion.button {...fade(0.15)} whileTap={reduce ? undefined : { scale: 0.98 }} onClick={() => nav(friendRequests ? "/amigos?tab=amigos" : "/amigos")} data-testid="universe-friends"
          className="mt-6 w-full flex items-center gap-3.5 p-4 rounded-2xl border text-left" style={{ background: "#fff", borderColor: "#EEE3D2" }}>
          <div className="relative w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: "#FBEEE4", color: "#B85C3C" }}>
            <Users className="w-6 h-6" />
            {friendRequests > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold grid place-items-center bg-red-500 text-white" data-testid="universe-friends-badge">{friendRequests}</span>}
          </div>
          <div className="flex-1">
            <div className="font-display font-bold" style={{ color: "#3A2A20" }}>Amigos de Petito</div>
            <div className="text-xs mt-0.5" style={{ color: "#8A7868" }}>{friendRequests > 0 ? `${friendRequests} ${friendRequests === 1 ? "dueño quiere" : "dueños quieren"} conectar contigo` : `Comparte las aventuras de ${name} con otros dueños`}</div>
          </div>
          <ArrowRight className="w-5 h-5" style={{ color: "#B85C3C" }} />
        </motion.button>

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

        {/* Upcoming special dates (computed in the owner's local day) */}
        <h2 className="mt-8 font-display font-bold text-lg" style={{ color: "#3A2A20" }}>Fechas especiales</h2>
        {specialDates.length > 0 ? (
          <div className="mt-3 space-y-2.5" data-testid="universe-dates">
            {specialDates.map((d) => (
              <div key={d.key} className="p-4 rounded-2xl border flex items-center gap-3" style={{ background: "#F6EFE2", borderColor: "#EEE3D2" }} data-testid={`universe-date-${d.key}`}>
                <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: "#fff", color: "#B85C3C" }}>{d.icon}</div>
                <div className="flex-1">
                  <div className="font-display font-bold text-sm" style={{ color: "#3A2A20" }}>{d.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#8A7868" }}>{d.when}</div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#FBEEE4", color: "#B85C3C" }}>{d.badge}</span>
              </div>
            ))}
          </div>
        ) : (
          <button onClick={() => nav("/perfil")} data-testid="universe-dates-empty"
            className="mt-3 w-full p-4 rounded-2xl border flex items-center gap-3 text-left" style={{ background: "#F6EFE2", borderColor: "#EEE3D2" }}>
            <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: "#fff", color: "#B85C3C" }}><CalendarHeart className="w-5 h-5" /></div>
            <div>
              <div className="font-display font-bold text-sm" style={{ color: "#3A2A20" }}>Agrega sus fechas</div>
              <div className="text-xs mt-0.5" style={{ color: "#8A7868" }}>Añade el cumpleaños y la adopción de {name} para celebrarlos.</div>
            </div>
          </button>
        )}

        {/* Memorial — calm, optional */}
        <button onClick={() => nav("/recuerdo")} data-testid="universe-memorial-link"
          className="mt-4 w-full flex items-center justify-center gap-2 h-11 rounded-2xl text-xs font-display font-semibold" style={{ color: "#8695A8" }}>
          <Heart className="w-4 h-4" /> Un homenaje sereno para recordar
        </button>
      </div>
    </div>
  );
}
