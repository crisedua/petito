"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminEvents, adminFunnel } from "@/lib/api";

const clp = (n) => new Intl.NumberFormat("es-CL").format(Math.round(n || 0));
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "—");

const FEATURES = {
  video: { label: "Video que habla", steps: ["opened", "uploaded", "result", "signed_in", "paywall", "checkout", "paid"] },
  portrait: { label: "Retrato", steps: ["opened", "uploaded", "result", "signed_in", "paywall", "checkout", "paid"] },
  memorial: { label: "Homenaje", steps: ["opened", "uploaded", "result", "signed_in", "paywall", "checkout", "paid"] },
  story: { label: "Historia", steps: ["opened", "uploaded", "result", "signed_in", "paywall", "checkout", "paid"] },
  memory: { label: "Recuerdos (álbum)", steps: ["opened", "uploaded", "signed_in", "checkout", "paid"] },
  friends: { label: "Amigos", steps: ["opened", "signed_in", "checkout", "paid"] },
};
const active = (f) => ["opened", "uploaded", "result", "signed_in", "paywall", "checkout", "paid"].some((s) => (f[s] ?? 0) > 0);

const STEP_LABEL = {
  opened: "Abrieron la sección", uploaded: "Subieron una foto", result: "Recibieron su resultado", signed_in: "Iniciaron sesión",
  paywall: "Vieron el pago", checkout: "Fueron a pagar", paid: "Pagaron",
};

function Tile({ label, value, testid }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-3.5" data-testid={testid}>
      <div className="text-[11px] text-muted-foreground font-semibold">{label}</div>
      <div className="mt-1 font-display font-bold text-xl text-neutral-900 tabular-nums">{value}</div>
    </div>
  );
}

function FeatureFunnel({ k, f }) {
  const cfg = FEATURES[k];
  const start = Math.max(f.opened ?? 0, f.uploaded ?? 0); // people who began this feature
  const widest = Math.max(1, ...cfg.steps.map((s) => f[s] ?? 0));
  return (
    <div className="bg-white rounded-2xl border border-border p-4" data-testid={`funnel-${k}`}>
      <div className="flex items-baseline justify-between">
        <div className="font-display font-bold text-neutral-900">{cfg.label}</div>
        <div className="text-xs text-muted-foreground tabular-nums">{f.paid} {f.paid === 1 ? "pago" : "pagos"}{f.revenue_clp ? ` · $${clp(f.revenue_clp)}` : ""}</div>
      </div>
      <div className="mt-3 space-y-2">
        {cfg.steps.map((s) => {
          const n = f[s] ?? 0;
          const w = Math.max(n ? 3 : 0, Math.round((n / widest) * 100));
          const share = start ? pct(n, start) : "";
          return (
            <div key={s} className="grid grid-cols-[1fr_auto] gap-x-3 items-center" title={`${STEP_LABEL[s]}: ${n}${share ? ` (${share} de quienes empezaron)` : ""}`}>
              <div>
                <div className="text-[11px] text-neutral-600">{STEP_LABEL[s]}</div>
                <div className="mt-1 h-2 rounded bg-[#F3E9DA] overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${w}%`, background: "#B85C3C" }} />
                </div>
              </div>
              <div className="text-right text-xs tabular-nums w-16">
                <span className="font-bold text-neutral-900">{n}</span> <span className="text-muted-foreground">{share}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Admin → Embudo: which features bring people from visiting to paying. */
export default function AdminFunnel() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setD(null); setErr(null);
    adminFunnel(days).then(setD).catch((e) => setErr(e?.response?.data?.detail || "No se pudo cargar el embudo"));
  }, [days]);

  const ranked = d?.features ? [...d.features].sort((a, b) => b.paid - a.paid || b.uploaded - a.uploaded) : [];
  const best = ranked.find((f) => f.paid > 0);

  return (
    <div data-testid="admin-funnel">
      <div className="flex gap-1.5 mb-3">
        {[7, 30, 90].map((n) => (
          <button key={n} onClick={() => setDays(n)} data-testid={`funnel-days-${n}`}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${days === n ? "bg-primary text-white" : "bg-white border border-border text-neutral-600"}`}>{n} días</button>
        ))}
      </div>

      {err ? <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-4" data-testid="funnel-error">{err}</p>
        : !d ? <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        : (
          <>
            <div className="grid grid-cols-2 gap-2.5" data-testid="funnel-totals">
              <Tile label="Visitantes" value={d.visitors} testid="funnel-visitors" />
              <Tile label="Iniciaron sesión" value={d.signed_in} />
              <Tile label="Cuentas nuevas" value={d.signups} />
              <Tile label="Pagaron" value={d.paid} testid="funnel-paid" />
              <Tile label="Ingresos" value={`$${clp(d.revenue_clp)}`} />
              <Tile label="Instalaron la app" value={d.installs} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Personas únicas en los últimos {d.days} días (un navegador cuenta como una persona hasta que inicia sesión). {d.share_opens} aperturas de enlaces compartidos.
            </p>

            <div className="mt-5 text-sm font-display font-bold text-neutral-800">Qué vende</div>
            <p className="text-[11px] text-muted-foreground mb-2">
              {best ? <>Lo que más pagos trae: <b className="text-neutral-800">{FEATURES[best.feature]?.label}</b>. Cada pago se acredita a la función desde la que la persona llegó al pago.</> : "Aún no hay pagos en este período."}
            </p>
            <div className="space-y-3">
              {ranked.filter((f) => FEATURES[f.feature] && active(f)).map((f) => <FeatureFunnel key={f.feature} k={f.feature} f={f} />)}
            </div>
            {ranked.some((f) => FEATURES[f.feature] && !active(f)) && (
              <p className="mt-2 text-[11px] text-muted-foreground" data-testid="funnel-idle">
                Sin actividad en este período: {ranked.filter((f) => FEATURES[f.feature] && !active(f)).map((f) => FEATURES[f.feature].label).join(", ")}.
              </p>
            )}

            <div className="mt-5 text-sm font-display font-bold text-neutral-800">De dónde llegan</div>
            <div className="mt-2 bg-white rounded-2xl border border-border overflow-hidden" data-testid="funnel-sources">
              <table className="w-full text-sm">
                <thead><tr className="text-[11px] text-muted-foreground text-left"><th className="px-3 py-2 font-semibold">Fuente</th><th className="px-3 py-2 font-semibold text-right">Visitantes</th><th className="px-3 py-2 font-semibold text-right">Pagaron</th></tr></thead>
                <tbody>
                  {d.sources.length === 0 && <tr><td colSpan={3} className="px-3 py-3 text-xs text-muted-foreground">Sin visitas todavía.</td></tr>}
                  {d.sources.map((s) => (
                    <tr key={s.source} className="border-t border-border">
                      <td className="px-3 py-2 capitalize">{s.source}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.visitors}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Para medir una campaña, agrega <code>?utm_source=nombre</code> al enlace que compartes.</p>
            <RecentEvents />
          </>
        )}
    </div>
  );
}

const FEATURE_LABEL = { video: "video", portrait: "retrato", memorial: "homenaje", story: "historia", memory: "recuerdo", friends: "amigos", pet: "mascota", plus: "Plus" };

/** The latest raw events, to check that tracking is working. */
function RecentEvents() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const load = () => adminEvents({ limit: 40 }).then(setRows).catch(() => setRows([]));
  return (
    <div className="mt-5" data-testid="funnel-recent">
      <button onClick={() => { setOpen((o) => !o); if (!rows) load(); }} className="text-xs font-semibold text-primary">
        {open ? "Ocultar últimos eventos" : "Ver últimos eventos"}
      </button>
      {open && (
        <div className="mt-2 bg-white rounded-2xl border border-border divide-y divide-border">
          {rows === null ? <div className="py-6 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            : rows.length === 0 ? <p className="px-3 py-3 text-xs text-muted-foreground">Sin eventos todavía.</p>
            : rows.map((e, i) => (
              <div key={i} className="px-3 py-2 text-xs flex items-center gap-2">
                <span className="font-semibold text-neutral-800">{e.label}</span>
                {e.feature && <span className="text-muted-foreground">· {FEATURE_LABEL[e.feature] || e.feature}</span>}
                {e.props?.amount ? <span className="text-muted-foreground">· ${clp(e.props.amount)}</span> : null}
                {e.props?.source && e.name === "visit" ? <span className="text-muted-foreground">· {e.props.source}</span> : null}
                <span className="flex-1" />
                <span className="text-muted-foreground truncate max-w-[40%]">{e.user || (e.device ? `anónimo ${e.device}` : "")}</span>
                <span className="text-muted-foreground/70 tabular-nums">{new Date(e.created_at).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
