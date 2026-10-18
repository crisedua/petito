import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ShieldAlert, TrendingUp, DollarSign, FileText, Percent, PawPrint, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminMetrics, adminStories, adminSurvey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Login from "@/pages/Login";
import AdminUsers, { AdminCreations } from "@/pages/AdminUsers";

const clp = (n) => new Intl.NumberFormat("es-CL").format(n || 0);

export default function Admin() {
  const nav = useNavigate();
  const { user, loading, logout } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [rows, setRows] = useState([]);
  const [survey, setSurvey] = useState(null);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("panel");

  const isAdmin = user?.is_admin;

  const load = async (f = filter) => {
    try {
      const [m, s, sv] = await Promise.all([adminMetrics(), adminStories(f), adminSurvey()]);
      setMetrics(m); setRows(s); setSurvey(sv);
    } catch { toast.error("No se pudieron cargar los datos"); }
  };

  useEffect(() => { if (isAdmin) load(filter); /* eslint-disable-next-line */ }, [isAdmin, filter]);

  if (loading) return <div className="mobile-frame grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!user) return <Login returnPath="/admin" subtitle="Inicia sesión con tu Google autorizado para entrar al panel" />;

  if (!isAdmin) {
    return (
      <div className="mobile-frame grid place-items-center px-8 text-center" data-testid="admin-unauthorized">
        <div>
          <div className="w-16 h-16 rounded-2xl bg-red-50 grid place-items-center mx-auto mb-4"><ShieldAlert className="w-8 h-8 text-red-500" /></div>
          <h1 className="font-display font-bold text-2xl text-neutral-900">No autorizado</h1>
          <p className="text-sm text-muted-foreground mt-2">La cuenta <b>{user.email}</b> no tiene acceso al panel de administración.</p>
          <Button onClick={() => { logout(); nav("/"); }} variant="secondary" className="mt-6 rounded-2xl bg-white border border-border" data-testid="admin-switch-account">Cerrar sesión</Button>
          <button onClick={() => nav("/")} className="w-full mt-4 text-xs text-muted-foreground">Volver al inicio</button>
        </div>
      </div>
    );
  }

  const KPIS = metrics ? [
    { icon: FileText, label: "Historias", value: metrics.total_stories, color: "text-blue-600 bg-blue-50" },
    { icon: Percent, label: "Conversión", value: `${metrics.conversion_rate}%`, color: "text-emerald-600 bg-emerald-50" },
    { icon: DollarSign, label: "Ingresos", value: `$${clp(metrics.revenue_clp)}`, color: "text-primary bg-primary/10" },
    { icon: TrendingUp, label: "Costo IA/historia", value: `$${clp(metrics.avg_cost_clp)}`, color: "text-amber-600 bg-amber-50" },
  ] : [];

  return (
    <div className="mobile-frame" data-testid="admin-dashboard">
      <div className="flex items-center justify-between px-5 pt-5">
        <h1 className="font-display font-bold text-xl flex items-center gap-2"><PawPrint className="w-5 h-5 text-primary" /> Admin</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">{user.email}</span>
          <button onClick={() => { logout(); nav("/"); }} className="text-xs text-primary font-semibold" data-testid="admin-logout">Salir</button>
        </div>
      </div>

      <div className="flex-1 px-5 pt-4 pb-10 overflow-y-auto no-scrollbar">
        <div className="flex gap-2 mb-4" data-testid="admin-tabs">
          {[["panel", "Resumen"], ["usuarios", "Usuarios"], ["creaciones", "Creaciones"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} data-testid={`admin-tab-${k}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === k ? "bg-primary text-white" : "bg-white border border-border text-neutral-600"}`}>{l}</button>
          ))}
        </div>
        {tab === "usuarios" && <AdminUsers />}
        {tab === "creaciones" && <AdminCreations />}
        {tab === "panel" && (<>
        <div className="grid grid-cols-2 gap-3" data-testid="admin-kpis">
          {KPIS.map((k) => (
            <div key={k.label} className="bg-white rounded-2xl border border-border p-4">
              <div className={`w-9 h-9 rounded-xl grid place-items-center mb-2 ${k.color}`}><k.icon className="w-5 h-5" /></div>
              <div className="font-display font-bold text-xl text-neutral-900">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </div>
          ))}
        </div>

        {metrics && (
          <div className="mt-3 text-xs text-muted-foreground bg-white rounded-2xl border border-border p-3">
            Costo IA total: <b>${clp(metrics.total_ai_cost_clp)} CLP</b> · Guardrail objetivo: &lt; ${metrics.cost_guardrail_clp} CLP por historia
            {metrics.avg_cost_clp > metrics.cost_guardrail_clp && <span className="text-destructive font-semibold"> · ⚠️ sobre el objetivo</span>}
          </div>
        )}

        {survey && (
          <div className="mt-3 bg-white rounded-2xl border border-border p-4" data-testid="admin-survey-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl grid place-items-center bg-primary/10 text-primary"><MessageCircleQuestion className="w-5 h-5" /></div>
              <div>
                <div className="font-display font-semibold text-neutral-900 leading-tight">Encuesta: ¿Pagarías ${clp(survey.price_clp)}/año?</div>
                <div className="text-xs text-muted-foreground">{survey.total} respuesta{survey.total === 1 ? "" : "s"}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-50 rounded-xl py-2"><div className="font-display font-bold text-xl text-emerald-600" data-testid="admin-survey-yes">{survey.yes}</div><div className="text-[11px] text-muted-foreground">Sí</div></div>
              <div className="bg-red-50 rounded-xl py-2"><div className="font-display font-bold text-xl text-red-500" data-testid="admin-survey-no">{survey.no}</div><div className="text-[11px] text-muted-foreground">No</div></div>
              <div className="bg-primary/10 rounded-xl py-2"><div className="font-display font-bold text-xl text-primary" data-testid="admin-survey-pct">{survey.yes_pct}%</div><div className="text-[11px] text-muted-foreground">dirían Sí</div></div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-red-100 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${survey.yes_pct}%` }} />
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5 mb-3">
          {[["all", "Todas"], ["paid", "Pagadas"], ["pending", "Pendientes"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} data-testid={`admin-filter-${k}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${filter === k ? "bg-primary text-white" : "bg-white border border-border text-neutral-600"}`}>{l}</button>
          ))}
        </div>

        <div className="space-y-2" data-testid="admin-stories-table">
          {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Sin historias todavía.</p>}
          {rows.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-border p-3.5 flex items-center gap-3" data-testid={`admin-row-${r.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-neutral-900 truncate">{r.pet_name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.paid ? "bg-emerald-100 text-emerald-700" : r.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {r.paid ? "PAGADA" : r.status === "failed" ? "FALLÓ" : "PENDIENTE"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{r.theme} · {r.photo_count} fotos · {r.species}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-neutral-700">${clp(r.ai_cost_clp)}</div>
                <div className="text-[10px] text-muted-foreground">costo IA</div>
              </div>
              <button onClick={() => window.open(`/h/${r.slug}`, "_blank")} className="text-xs text-primary font-semibold" data-testid={`admin-view-${r.id}`}>Ver</button>
            </div>
          ))}
        </div>
        </>)}
      </div>
    </div>
  );
}
