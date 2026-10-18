"use client";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@/lib/router";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, PawPrint, Heart, Check, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getInvite, acceptInvite, mediaUrl } from "@/lib/api";
import { Avatar } from "@/screens/Friends";

const C = { bg: "#FBF6EE", ink: "#3A2A20", muted: "#8A7868", accent: "#B85C3C", card: "#EEE3D2", soft: "#FBEEE4" };

/** /amigos/conectar/<code>: someone's personal invite link. Opening it while signed in connects you both. */
export default function FriendInvite() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user, loading, login } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    getInvite(code).then(setData).catch((e) => setError(e?.response?.data?.detail || "Este enlace no es válido"));
  }, [code, loading, user]);

  const connect = async () => {
    if (!user) { login(`/amigos/conectar/${code}`); return; }
    setBusy(true);
    try {
      await acceptInvite(code);
      toast.success(`¡Ahora estás conectado con ${data.owner.name}! 🐾`);
      nav("/amigos");
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo conectar"); setBusy(false); }
  };

  if (error) {
    return (
      <div className="mobile-frame grid place-items-center text-center px-8" style={{ background: C.bg }} data-testid="invite-error">
        <div>
          <Heart className="w-10 h-10 mx-auto" style={{ color: "#D9BBAE" }} />
          <p className="mt-3 font-display font-semibold" style={{ color: C.muted }}>{error}</p>
          <button onClick={() => nav("/")} className="mt-5 px-5 h-11 rounded-2xl font-display font-semibold text-white" style={{ background: C.accent }}>Ir a Petito</button>
        </div>
      </div>
    );
  }
  if (!data) return <div className="mobile-frame grid place-items-center" style={{ background: C.bg }}><Loader2 className="w-7 h-7 animate-spin" style={{ color: C.accent }} /></div>;

  const o = data.owner;
  const petNames = o.pets.map((p) => p.name);
  return (
    <div className="mobile-frame" style={{ background: C.bg }} data-testid="invite-screen">
      <div className="flex items-center gap-2 px-5 pt-5 font-display font-semibold" style={{ color: C.accent }}>
        <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: C.accent }}><PawPrint className="w-5 h-5 text-white" /></div>
        Petito
      </div>
      <div className="flex-1 px-6 pt-10 pb-28 flex flex-col items-center text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Avatar src={o.picture} name={o.name} size={96} />
        </motion.div>
        <h1 className="mt-5 font-display font-bold text-2xl" style={{ color: C.ink }} data-testid="invite-owner-name">
          {data.status === "self" ? "Este es tu enlace" : `${o.name} te invita a conectar`}
        </h1>
        {petNames.length > 0 && (
          <p className="mt-2 text-sm font-display" style={{ color: C.muted }}>
            {data.status === "self" ? "Compártelo con otros dueños." : `Conoce a ${petNames.length === 1 ? petNames[0] : `${petNames.slice(0, -1).join(", ")} y ${petNames[petNames.length - 1]}`} y compartan las historias de sus mascotas.`}
          </p>
        )}
        {o.pets.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {o.pets.slice(0, 4).map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md grid place-items-center" style={{ background: "#F3D9B8" }}>
                  {p.photo_url ? <img src={mediaUrl(p.photo_url)} alt={p.name} className="w-full h-full object-cover" /> : <PawPrint className="w-7 h-7" style={{ color: C.accent }} />}
                </div>
                <span className="font-script text-xl" style={{ color: C.accent }}>{p.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pt-10 w-full">
          {data.status === "friends" ? (
            <>
              <div className="flex items-center justify-center gap-2 font-display font-semibold" style={{ color: "#5E8C4F" }}><Check className="w-5 h-5" /> Ya están conectados</div>
              <button onClick={() => nav("/amigos")} className="mt-4 w-full h-12 rounded-2xl font-display font-bold text-white" style={{ background: C.accent }} data-testid="invite-go-feed">Ver novedades</button>
            </>
          ) : data.status === "self" ? (
            <button onClick={() => nav("/amigos?tab=amigos")} className="w-full h-12 rounded-2xl font-display font-bold text-white" style={{ background: C.accent }}>Ir a mis amigos</button>
          ) : (
            <>
              <button onClick={connect} disabled={busy} data-testid="invite-connect"
                className="w-full h-12 rounded-2xl font-display font-bold text-white flex items-center justify-center gap-2" style={{ background: C.accent }}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlus className="w-5 h-5" /> {user ? "Conectar" : "Entrar con Google para conectar"}</>}
              </button>
              <p className="mt-3 text-xs" style={{ color: C.muted }}>Solo verán lo que cada uno elija compartir. Puedes quitar la conexión cuando quieras.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
