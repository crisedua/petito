"use client";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@/lib/router";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil, Trash2, Sparkles, Calendar, Check, X, Share2 } from "lucide-react";
import { getMemory, updateMemory, deleteMemory, reflectMemory, hideMemoryReflection, toggleMemoryShare, getEmotions, mediaUrl } from "@/lib/api";

export default function MemoryView() {
  const { id } = useParams();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const [m, setM] = useState(null);
  const [editing, setEditing] = useState(false);
  const [emotionOpts, setEmotionOpts] = useState([]);
  const [reflecting, setReflecting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  // edit buffers
  const [eTitle, setETitle] = useState("");
  const [eDate, setEDate] = useState("");
  const [eUnknown, setEUnknown] = useState(false);
  const [eFeeling, setEFeeling] = useState("");
  const [eEmotions, setEEmotions] = useState([]);

  useEffect(() => {
    getMemory(id).then(setM).catch(() => { toast.error("No se encontró el recuerdo"); nav("/album"); });
    getEmotions().then(setEmotionOpts).catch(() => {});
  }, [id, nav]);

  const startEdit = () => {
    setETitle(m.title); setEDate(m.happened_on || ""); setEUnknown(m.date_unknown);
    setEFeeling(m.feeling_text || ""); setEEmotions(m.emotions || []);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!eTitle.trim()) { toast.error("El título no puede quedar vacío"); return; }
    setBusy(true);
    try {
      const upd = await updateMemory(id, {
        title: eTitle.trim(), happened_on: eUnknown ? "" : eDate.trim(), date_unknown: eUnknown,
        feeling_text: eFeeling.trim(), emotions: eEmotions,
      });
      setM(upd); setEditing(false);
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo guardar"); }
    finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try { await deleteMemory(id); toast.success("Recuerdo eliminado"); nav("/album"); }
    catch { toast.error("No se pudo borrar"); setBusy(false); }
  };

  const askReflection = async () => {
    setReflecting(true);
    try { const r = await reflectMemory(id); setM((x) => ({ ...x, ai_reflection: r.ai_reflection })); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo crear el pensamiento"); }
    finally { setReflecting(false); }
  };

  const hideReflection = async () => {
    try { await hideMemoryReflection(id); setM((x) => ({ ...x, ai_reflection: null })); }
    catch { toast.error("No se pudo ocultar"); }
  };

  const toggleShare = async () => {
    try { const r = await toggleMemoryShare(id); setM((x) => ({ ...x, shared: r.shared })); toast.success(r.shared ? "Compartido en el álbum público 🔗" : "Quitado del álbum público"); }
    catch { toast.error("No se pudo cambiar"); }
  };

  const toggleE = (k) => setEEmotions((e) => (e.includes(k) ? e.filter((x) => x !== k) : [...e, k]));

  if (!m) {
    return <div className="mobile-frame grid place-items-center" style={{ background: "#FBF6EE" }}><Loader2 className="w-7 h-7 animate-spin" style={{ color: "#C2683F" }} /></div>;
  }

  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="memory-view-screen">
      <div className="flex items-center justify-between px-5 pt-5">
        <button onClick={() => (editing ? setEditing(false) : nav("/album"))} data-testid="memory-view-back"
          className="w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: "#EADFCF" }}>
          <ArrowLeft className="w-4 h-4" style={{ color: "#8A6D4B" }} />
        </button>
        {!editing && (
          <div className="flex items-center gap-2">
            <button onClick={toggleShare} data-testid="memory-share-toggle"
              className="w-9 h-9 rounded-full border grid place-items-center" style={m.shared ? { background: "#C2683F", borderColor: "#C2683F" } : { background: "#fff", borderColor: "#EADFCF" }}>
              <Share2 className="w-4 h-4" style={{ color: m.shared ? "#fff" : "#8A6D4B" }} />
            </button>
            <button onClick={startEdit} data-testid="memory-edit-button"
              className="w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: "#EADFCF" }}>
              <Pencil className="w-4 h-4" style={{ color: "#8A6D4B" }} />
            </button>
            <button onClick={() => setConfirmDel(true)} data-testid="memory-delete-button"
              className="w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: "#EADFCF" }}>
              <Trash2 className="w-4 h-4" style={{ color: "#C2683F" }} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 px-6 pt-4 pb-10 overflow-y-auto no-scrollbar">
        {m.photo_url && (
          <motion.div initial={reduce ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl overflow-hidden border-4 border-white shadow-xl" style={{ aspectRatio: "4 / 3" }}>
            <img src={mediaUrl(m.photo_url)} alt={m.title} className="w-full h-full object-cover" />
          </motion.div>
        )}

        {!editing ? (
          <>
            <div className="mt-5 flex items-center gap-1.5 text-sm" style={{ color: "#A7937F" }}>
              <Calendar className="w-4 h-4" /> {m.date_unknown ? "hace un tiempo" : (m.happened_on || "sin fecha")}
            </div>
            <h1 className="mt-1 font-display font-bold text-2xl leading-tight" style={{ color: "#3A2A20" }} data-testid="memory-view-title">{m.title}</h1>

            {m.emotion_labels?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.emotion_labels.map((e) => (
                  <span key={e.key} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#FBEEE4", color: "#B85C3C" }}>{e.emoji} {e.label}</span>
                ))}
              </div>
            )}

            {m.feeling_text && (
              <div className="mt-5">
                <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#B07A4A" }}>Lo que de verdad pasó</div>
                <p className="mt-1.5 text-base font-display leading-relaxed whitespace-pre-wrap" style={{ color: "#4A3B30" }} data-testid="memory-view-feeling">{m.feeling_text}</p>
              </div>
            )}

            {/* Petito reflection (IA) always labeled */}
            {m.ai_reflection ? (
              <div className="mt-6 p-4 rounded-2xl border" style={{ background: "#F6EFE2", borderColor: "#EADFCF" }} data-testid="memory-view-reflection">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#B07A4A" }}>💭 Un pensamiento de Petito</span>
                  <button onClick={hideReflection} data-testid="memory-hide-reflection" className="text-xs" style={{ color: "#A7937F" }}>Ocultar</button>
                </div>
                <p className="text-sm font-display leading-relaxed" style={{ color: "#4A3B30" }}>{m.ai_reflection}</p>
                <div className="mt-1.5 text-[10px]" style={{ color: "#A7937F" }}>Escrito por IA · acompaña tu recuerdo, no es un hecho</div>
              </div>
            ) : (
              <button onClick={askReflection} disabled={reflecting} data-testid="memory-ask-reflection"
                className="mt-6 w-full py-3.5 rounded-2xl font-display font-semibold text-sm flex items-center justify-center gap-2 border"
                style={{ background: "#fff", color: "#8A6D4B", borderColor: "#EADFCF" }}>
                {reflecting ? <><Loader2 className="w-4 h-4 animate-spin" /> Pensando...</>
                  : <><Sparkles className="w-4 h-4" style={{ color: "#C2683F" }} /> Pedir un pensamiento de Petito</>}
              </button>
            )}
          </>
        ) : (
          <div className="mt-5" data-testid="memory-edit-form">
            <label className="block text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>Título</label>
            <input value={eTitle} onChange={(e) => setETitle(e.target.value)} maxLength={80} data-testid="memory-edit-title"
              className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-white border outline-none font-display" style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />

            <label className="block mt-4 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>Fecha</label>
            <input value={eDate} onChange={(e) => setEDate(e.target.value)} maxLength={40} disabled={eUnknown} data-testid="memory-edit-date"
              className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-white border outline-none font-display disabled:opacity-50" style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />
            <button onClick={() => setEUnknown((v) => !v)}
              className="mt-2 flex items-center gap-2 px-3.5 py-2 rounded-2xl border font-display font-semibold text-sm"
              style={eUnknown ? { background: "#FBEEE4", borderColor: "#C2683F", color: "#B85C3C" } : { background: "#fff", borderColor: "#EADFCF", color: "#6E5B3E" }}>
              {eUnknown && <Check className="w-4 h-4" />} No la sé
            </button>

            <label className="block mt-4 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>Lo que sentiste</label>
            <textarea value={eFeeling} onChange={(e) => setEFeeling(e.target.value)} maxLength={1500} rows={4} data-testid="memory-edit-feeling"
              className="mt-1.5 w-full p-4 rounded-2xl bg-white border outline-none font-display text-sm resize-none" style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />

            <label className="block mt-4 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>Emociones</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {emotionOpts.map((o) => {
                const on = eEmotions.includes(o.key);
                return (
                  <button key={o.key} onClick={() => toggleE(o.key)}
                    className="px-3.5 py-2 rounded-full border-2 font-display font-semibold text-sm"
                    style={on ? { background: "#FBEEE4", borderColor: "#C2683F", color: "#B85C3C" } : { background: "#fff", borderColor: "#EADFCF", color: "#6E5B3E" }}>
                    {o.emoji} {o.label}
                  </button>
                );
              })}
            </div>

            <button onClick={saveEdit} disabled={busy} data-testid="memory-edit-save"
              className="mt-7 w-full h-14 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "#C2683F" }}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Guardar cambios</>}
            </button>
          </div>
        )}
      </div>

      {confirmDel && (
        <div className="absolute inset-0 z-50 grid place-items-center p-6" style={{ background: "rgba(40,28,20,0.45)" }} data-testid="memory-delete-confirm">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center">
            <h3 className="font-display font-bold text-lg" style={{ color: "#3A2A20" }}>¿Borrar este recuerdo?</h3>
            <p className="mt-1.5 text-sm" style={{ color: "#8A7868" }}>Esta acción no se puede deshacer.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmDel(false)} className="flex-1 h-12 rounded-2xl font-display font-semibold border" style={{ borderColor: "#EADFCF", color: "#6E5B3E" }}>
                <X className="w-4 h-4 inline mr-1" /> Cancelar
              </button>
              <button onClick={doDelete} disabled={busy} data-testid="memory-delete-confirm-yes"
                className="flex-1 h-12 rounded-2xl font-display font-bold text-white" style={{ background: "#C2683F" }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Borrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
