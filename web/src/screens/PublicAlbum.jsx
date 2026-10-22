"use client";
import { HomeLink } from "@/components/HomeLink";
import { useEffect, useState } from "react";
import { useParams } from "@/lib/router";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, PawPrint, Calendar, Heart, UserPlus, Check } from "lucide-react";
import { useNavigate } from "@/lib/router";
import { useAuth } from "@/lib/auth";
import { publicAlbum, requestConnection, mediaUrl } from "@/lib/api";

export default function PublicAlbum() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [asking, setAsking] = useState(false);
  const { user, loading, login } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    publicAlbum(slug).then(setData).catch(() => setNotFound(true));
  }, [slug, loading, user]);

  // Ask this pet's owner to connect (they accept from their Amigos screen).
  const connect = async () => {
    if (!user) { login(`/u/${slug}`); return; }
    setAsking(true);
    try {
      const r = await requestConnection(slug);
      setData((d) => ({ ...d, connection: r.status === "accepted" ? "friends" : "pending" }));
      toast.success(r.status === "accepted" ? "¡Ahora están conectados! 🐾" : "Solicitud enviada. Te avisaremos cuando acepten 🐾");
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo enviar la solicitud"); }
    finally { setAsking(false); }
  };

  if (notFound) {
    return (
      <div className="mobile-frame grid place-items-center text-center px-8" style={{ background: "#FBF6EE" }} data-testid="public-album-notfound">
        <div>
          <Heart className="w-10 h-10 mx-auto" style={{ color: "#D9BBAE" }} />
          <p className="mt-3 font-display font-semibold" style={{ color: "#8A7868" }}>Este álbum es privado o no existe.</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="mobile-frame grid place-items-center" style={{ background: "#FBF6EE" }}><Loader2 className="w-7 h-7 animate-spin" style={{ color: "#C2683F" }} /></div>;

  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="public-album-screen">
      <HomeLink className="flex items-center gap-2 px-5 pt-5 font-display font-semibold" style={{ color: "#B85C3C" }}>
        <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: "#B85C3C" }}><PawPrint className="w-5 h-5 text-white" /></div>
        Petipo
      </HomeLink>

      <div className="flex-1 px-6 pt-5 pb-12 overflow-y-auto no-scrollbar">
        <div className="text-center">
          {data.photo_url && (
            <div className="mx-auto w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg">
              <img src={mediaUrl(data.photo_url)} alt={data.name} className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="mt-4 font-script text-4xl" style={{ color: "#B85C3C" }} data-testid="public-album-name">{data.name}</h1>
          {data.intro_text && <p className="mt-2 text-sm font-display leading-relaxed" style={{ color: "#6E5B4E" }}>{data.intro_text}</p>}
          {data.connection && data.connection !== "self" && (
            <div className="mt-4" data-testid="public-album-connect-block">
              {data.connection === "friends" ? (
                <button onClick={() => nav("/amigos")} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-display font-semibold border" style={{ borderColor: "#CFE0C6", color: "#5E8C4F", background: "#F1F7EE" }}>
                  <Check className="w-4 h-4" /> Ya están conectados
                </button>
              ) : data.connection === "pending" ? (
                <span className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-display font-semibold bg-white border" style={{ borderColor: "#EADFCF", color: "#8A7868" }} data-testid="public-album-pending">
                  Solicitud enviada
                </span>
              ) : data.connection === "incoming" ? (
                <button onClick={() => nav("/amigos?tab=amigos")} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-display font-semibold text-white" style={{ background: "#B85C3C" }}>
                  <UserPlus className="w-4 h-4" /> Quiere conectar contigo
                </button>
              ) : (
                <button onClick={connect} disabled={asking} data-testid="public-album-connect"
                  className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-display font-semibold text-white" style={{ background: "#B85C3C" }}>
                  {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Conectar con su familia
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 space-y-4">
          {data.memories.length === 0 ? (
            <p className="text-center text-sm" style={{ color: "#8A7868" }}>Aún no hay recuerdos compartidos.</p>
          ) : data.memories.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
              className="rounded-3xl overflow-hidden bg-white border shadow-sm" style={{ borderColor: "#EEE3D2" }} data-testid="public-memory">
              {m.photo_url && <div className="w-full" style={{ aspectRatio: "16 / 10" }}><img src={mediaUrl(m.photo_url)} alt={m.title} className="w-full h-full object-cover" /></div>}
              <div className="p-4">
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "#A7937F" }}>
                  <Calendar className="w-3.5 h-3.5" /> {m.date_unknown ? "hace un tiempo" : (m.happened_on || "")}
                </div>
                <div className="mt-1 font-display font-bold text-lg" style={{ color: "#3A2A20" }}>{m.title}</div>
                {m.emotion_labels?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.emotion_labels.map((e) => <span key={e.key} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FBEEE4", color: "#B85C3C" }}>{e.emoji} {e.label}</span>)}
                  </div>
                )}
                {m.feeling_text && <p className="mt-2 text-sm font-display leading-relaxed whitespace-pre-wrap" style={{ color: "#4A3B30" }}>{m.feeling_text}</p>}
              </div>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs" style={{ color: "#B3A48F" }}>Hecho con cariño en Petipo 🐾</p>
      </div>
    </div>
  );
}
