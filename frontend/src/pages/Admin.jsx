import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Lock, TrendingUp, DollarSign, FileText, Percent, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLogin, adminMetrics, adminStories } from "@/lib/api";

const clp = (n) => new Intl.NumberFormat("es-CL").format(n || 0);

export default function Admin() {
  const nav = useNavigate();
  const [token, setToken] = useState(localStorage.getItem("cp_admin_token") || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");

  const load = async (t, f = filter) => {
    try {
      const [m, s] = await Promise.all([adminMetrics(t), adminStories(t, f)]);
      setMetrics(m); setRows(s);
    } catch { localStorage.removeItem("cp_admin_token"); setToken(""); toast.error("Sesión expirada"); }
  };

  useEffect(() => { if (token) load(token); }, []);
  useEffect(() => { if (token) load(token, filter); /* eslint-disable-next-line */ }, [filter]);

  const login = async () => {
    setBusy(true);
    try {
      const { token: t } = await adminLogin(password);
      localStorage.setItem("cp_admin_token", t); setToken(t); await load(t);
    } catch { toast.error("Contraseña incorrecta"); } finally { setBusy(false); }
  };

  if (!token) {
    return (
      <div className="mobile-frame grid place-items-center px-6" data-testid="admin-login-screen">
        <div className="w-full">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary grid place-items-center mb-3"><Lock className="w-7 h-7 text-white" /></div>
            <h1 className="font-display font-bold text-2xl">Panel Cuentapatas</h1>
            <p className="text-sm text-muted-foreground">Acceso restringido</p>
          </div>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()} placeholder="Contraseña"
            className="h-14 rounded-2xl bg-white text-center" data-testid="admin-login-password-input" />
          <Button onClick={login} disabled={busy} className="w-full h-14 mt-3 rounded-2xl font-display font-semibold" data-testid="admin-login-submit">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar"}
          </Button>
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
        <button onClick={() => { localStorage.removeItem("cp_admin_token"); setToken(""); }} className="text-xs text-primary font-semibold" data-testid="admin-logout">Salir</button>
      </div>

      <div className="flex-1 px-5 pt-4 pb-10 overflow-y-auto no-scrollbar">
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
      </div>
    </div>
  );
}
