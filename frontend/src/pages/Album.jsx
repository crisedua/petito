import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Plus, Loader2, BookHeart, Calendar } from "lucide-react";
import { getPet, listMemories, getActivePetId, mediaUrl } from "@/lib/api";

export default function Album() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const [pet, setPet] = useState(null);
  const [memories, setMemories] = useState(null);

  useEffect(() => {
    const pid = getActivePetId();
    if (!pid) { nav("/universo", { replace: true }); return; }
    getPet(pid).then(setPet).catch(() => nav("/universo", { replace: true }));
    listMemories(pid).then(setMemories).catch(() => setMemories([]));
  }, [nav]);

  const fade = (d = 0) => reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: d } };

  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="album-screen">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => nav("/universo")} data-testid="album-back"
          className="w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: "#EADFCF" }}>
          <ArrowLeft className="w-4 h-4" style={{ color: "#8A6D4B" }} />
        </button>
        <div className="flex items-center gap-1.5 font-display font-bold" style={{ color: "#3A2A20" }}>
          <BookHeart className="w-5 h-5" style={{ color: "#B85C3C" }} /> Nuestra historia
        </div>
      </div>

      <div className="flex-1 px-6 pt-5 pb-28 overflow-y-auto no-scrollbar">
        {pet && (
          <p className="text-sm font-display" style={{ color: "#8A7868" }}>
            El álbum de recuerdos reales de <span className="font-bold" style={{ color: "#B85C3C" }}>{pet.name}</span>
          </p>
        )}

        {memories === null ? (
          <div className="mt-16 grid place-items-center"><Loader2 className="w-7 h-7 animate-spin" style={{ color: "#C2683F" }} /></div>
        ) : memories.length === 0 ? (
          <motion.div {...fade(0)} className="mt-10 text-center px-4" data-testid="album-empty">
            <div className="w-20 h-20 mx-auto rounded-3xl grid place-items-center" style={{ background: "#F3E9DA", color: "#B85C3C" }}>
              <BookHeart className="w-10 h-10" />
            </div>
            <h2 className="mt-5 font-display font-bold text-xl" style={{ color: "#3A2A20" }}>Aún no hay recuerdos</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#8A7868" }}>
              Cada historia empieza con un primer momento. Guarda uno y quédate con él para siempre. 🤍
            </p>
          </motion.div>
        ) : (
          <div className="mt-5 space-y-4">
            {memories.map((m, i) => (
              <motion.button key={m.id} {...fade(0.04 * i)} whileTap={reduce ? undefined : { scale: 0.98 }}
                onClick={() => nav(`/album/${m.id}`)} data-testid={`album-memory-${m.id}`}
                className="w-full rounded-3xl overflow-hidden bg-white border shadow-sm text-left" style={{ borderColor: "#EEE3D2" }}>
                {m.photo_url && (
                  <div className="relative w-full" style={{ aspectRatio: "16 / 10" }}>
                    <img src={mediaUrl(m.photo_url)} alt={m.title} className="absolute inset-0 w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: "#A7937F" }}>
                    <Calendar className="w-3.5 h-3.5" />
                    {m.date_unknown ? "hace un tiempo" : (m.happened_on || "sin fecha")}
                  </div>
                  <div className="mt-1 font-display font-bold text-lg leading-snug" style={{ color: "#3A2A20" }}>{m.title}</div>
                  {m.emotion_labels?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.emotion_labels.map((e) => (
                        <span key={e.key} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FBEEE4", color: "#B85C3C" }}>
                          {e.emoji} {e.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5" style={{ background: "linear-gradient(to top, #FBF6EE 70%, transparent)" }}>
        <button onClick={() => nav("/album/nuevo")} data-testid="album-add-memory"
          className="w-full h-14 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2 shadow-xl"
          style={{ background: "#C2683F", boxShadow: "0 12px 26px -10px rgba(194,104,63,0.6)" }}>
          <Plus className="w-5 h-5" /> Añadir recuerdo
        </button>
      </div>
    </div>
  );
}
