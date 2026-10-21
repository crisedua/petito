"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { adminDances, adminGenerateDance, mediaUrl } from "@/lib/api";

/**
 * Admin → Bailes: the choreography videos behind "Tu mascota en movimiento". Each dance needs one
 * source video (a dancer performing it); Genjutsu then puts every pet into those exact moves.
 */
export default function AdminDances() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState({});
  const load = () => adminDances().then(setD).catch((e) => toast.error(e?.response?.data?.detail || "No se pudieron cargar los bailes"));
  useEffect(() => { load(); }, []);
  // While something is generating, check every 6 s (the server finalizes it when Higgsfield is done).
  useEffect(() => {
    if (!d?.dances?.some((x) => x.pending)) return;
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [d]);

  if (!d) return <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const generate = async (key) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try { await adminGenerateDance(key); toast.success("Generando la coreografía (1 a 3 minutos)…"); await load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo iniciar"); }
    finally { setBusy((b) => ({ ...b, [key]: false })); }
  };
  const missing = d.dances.filter((x) => !x.ready && !x.pending);

  return (
    <div data-testid="admin-dances">
      <p className="text-xs text-muted-foreground">
        Cada baile necesita un video base de un bailarín haciendo la coreografía ({d.seconds} s). Se genera una sola vez con IA y después tu mascota baila exactamente esos pasos. Sin video base, el baile se hace solo con una descripción (menos impresionante).
      </p>
      {!d.higgsfield && <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">Higgsfield no está configurado: agrega HIGGSFIELD_API_KEY en Vercel.</p>}
      {missing.length > 0 && d.higgsfield && (
        <button onClick={() => missing.forEach((x) => generate(x.key))} data-testid="dances-generate-all"
          className="mt-3 w-full h-10 rounded-xl bg-primary text-white text-sm font-bold inline-flex items-center justify-center gap-1.5">
          <Sparkles className="w-4 h-4" /> Generar las {missing.length} coreografías que faltan (~US${(missing.length * d.seconds * 0.144).toFixed(2)})
        </button>
      )}
      <div className="mt-4 space-y-3">
        {d.dances.map((x) => (
          <div key={x.key} className="bg-white rounded-2xl border border-border p-3.5 flex gap-3" data-testid={`dance-${x.key}`}>
            <div className="w-[88px] shrink-0 rounded-xl overflow-hidden bg-stone-100 grid place-items-center" style={{ aspectRatio: "9 / 16" }}>
              {x.url ? <video src={mediaUrl(x.url)} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                : x.pending ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <span className="text-2xl">{x.emoji}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-neutral-900">{x.emoji} {x.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {x.pending ? "Generando la coreografía…" : x.ready ? `Lista · ${new Date(x.created_at).toLocaleDateString("es-CL")}` : "Sin video base todavía"}
                {x.error && <span className="text-red-600"> · {x.error}</span>}
              </div>
              <button onClick={() => generate(x.key)} disabled={busy[x.key] || x.pending || !d.higgsfield} data-testid={`dance-generate-${x.key}`}
                className="mt-2 px-3 h-9 rounded-xl text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50 bg-primary text-white">
                {busy[x.key] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : x.ready ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                {x.ready ? "Generar otra versión" : "Generar coreografía"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
