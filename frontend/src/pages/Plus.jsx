import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Check, Crown, Sparkles, Infinity as InfinityIcon, Share2, Mic, Info, AlertCircle } from "lucide-react";
import { plusStatus, plusSubscribe, plusSync, plusCancel, plusDevActivate } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const BENEFITS = [
  { icon: InfinityIcon, text: "Mascotas ilimitadas, cada una con su universo" },
  { icon: Crown, text: "Retratos, videos e historias incluidos, sin pagar por cada uno" },
  { icon: Sparkles, text: "Pensamientos de Petito ilimitados en tus recuerdos" },
  { icon: Share2, text: "Comparte el álbum público de tu mascota" },
  { icon: Mic, text: "Y lo nuevo que vaya llegando a Plus" },
];

const clp = (n) => "$" + (n || 0).toLocaleString("es-CL");

export default function Plus() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [st, setSt] = useState(null);
  const [plan, setPlan] = useState("annual");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [email, setEmail] = useState("");
  const [payHelp, setPayHelp] = useState(false);

  const load = () => plusStatus().then((d) => { setSt(d); return d; }).catch(() => null);

  useEffect(() => { if (user?.email && !email) setEmail(user.email); }, [user]); // eslint-disable-line

  useEffect(() => {
    if (params.get("pago") === "success") {
      setSyncing(true);
      plusSync()
        .then(() => load())
        .then((d) => { if (d && !d.active) setPayHelp(true); })
        .finally(() => setSyncing(false));
    } else {
      load();
    }
  }, []); // eslint-disable-line

  const subscribe = async () => {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Ingresa un correo válido de tu cuenta de Mercado Pago"); return; }
    setBusy(true);
    try {
      const r = await plusSubscribe(plan, e);
      window.location.assign(r.init_point);
    } catch (err) {
      const detail = err?.response?.data?.detail || "No se pudo iniciar la suscripción";
      toast.error(detail);
      if (err?.response?.status === 400) setPayHelp(true);
      setBusy(false);
    }
  };

  const devActivate = async () => {
    setBusy(true);
    try { await plusDevActivate(plan); toast.success("¡Plus activado (modo prueba)! 👑"); nav("/universo?plus=success"); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo activar"); setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true);
    try { const r = await plusCancel(); toast.success("Suscripción cancelada. Mantienes Plus hasta el fin del período."); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo cancelar"); }
    finally { setBusy(false); }
  };

  if (!st) return <div className="mobile-frame grid place-items-center" style={{ background: "#2A1D16" }}><Loader2 className="w-7 h-7 animate-spin text-amber-300" /></div>;

  const monthly = st.monthly_clp, annual = st.annual_clp;
  const annualPerMonth = Math.round(annual / 12);

  return (
    <div className="mobile-frame" style={{ background: "linear-gradient(170deg,#3A2416,#241812)" }} data-testid="plus-screen">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => nav("/universo")} data-testid="plus-back" className="w-9 h-9 rounded-full grid place-items-center" style={{ background: "rgba(255,255,255,0.1)" }}>
          <ArrowLeft className="w-4 h-4 text-amber-100" />
        </button>
        <div className="flex items-center gap-1.5 font-display font-bold text-amber-100"><Crown className="w-5 h-5 text-amber-300" /> Petito Plus</div>
      </div>

      <div className="flex-1 px-6 pt-6 pb-10 overflow-y-auto no-scrollbar">
        {st.active ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center" data-testid="plus-active">
            <div className="w-20 h-20 mx-auto rounded-full grid place-items-center" style={{ background: "rgba(245,195,85,0.18)" }}>
              <Crown className="w-10 h-10 text-amber-300" />
            </div>
            <h1 className="mt-5 font-display font-bold text-2xl text-amber-50">Eres Petito Plus 👑</h1>
            <p className="mt-2 text-sm text-amber-100/70">
              Plan {st.plan === "annual" ? "anual" : "mensual"}
              {st.plus_until ? ` · activo hasta el ${st.plus_until.slice(0, 10)}` : ""}
              {st.status === "canceled" ? " · no se renovará" : ""}
            </p>
            <div className="mt-8 text-left space-y-3">
              {BENEFITS.map((b, i) => (
                <div key={i} className="flex items-center gap-3 text-amber-50/90"><b.icon className="w-5 h-5 text-amber-300 shrink-0" /><span className="text-sm">{b.text}</span></div>
              ))}
            </div>
            {st.status !== "canceled" && (
              <button onClick={cancel} disabled={busy} data-testid="plus-cancel"
                className="mt-10 w-full h-12 rounded-2xl font-display font-semibold text-sm text-amber-100/70" style={{ background: "rgba(255,255,255,0.08)" }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Cancelar renovación"}
              </button>
            )}
          </motion.div>
        ) : (
          <>
            {payHelp && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid="plus-pay-help"
                className="mb-6 rounded-2xl p-4" style={{ background: "rgba(220,120,90,0.14)", border: "1px solid rgba(220,120,90,0.4)" }}>
                <div className="flex items-center gap-2 font-display font-bold text-amber-50 text-sm"><AlertCircle className="w-4 h-4 text-orange-300" /> No pudimos confirmar tu suscripción</div>
                <p className="mt-1.5 text-[11px] text-amber-100/70">Suele deberse a uno de estos motivos:</p>
                <ul className="mt-1.5 text-[11px] text-amber-100/70 space-y-1 list-disc pl-4">
                  <li>El correo no coincide con el de tu cuenta de Mercado Pago</li>
                  <li>Tarjeta de débito con restricción para cobros automáticos (prueba una de crédito)</li>
                  <li>La validación de $950 fue rechazada por tu banco</li>
                  <li>No puedes suscribirte a tu propia cuenta vendedora (usa otra cuenta/tarjeta)</li>
                </ul>
                <button onClick={() => setPayHelp(false)} data-testid="plus-pay-retry"
                  className="mt-3 w-full h-10 rounded-xl font-display font-semibold text-xs text-stone-900" style={{ background: "#F5C355" }}>
                  Reintentar
                </button>
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display font-bold text-3xl text-amber-50 leading-tight">Todo el universo de tu mascota, sin límites.</h1>
              <p className="mt-2 text-sm text-amber-100/70">Crea sin pagar por cada cosa y guarda cada recuerdo con cariño.</p>
            </motion.div>

            <div className="mt-6 space-y-3">
              {BENEFITS.map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}
                  className="flex items-center gap-3 text-amber-50/90"><div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: "rgba(245,195,85,0.15)" }}><b.icon className="w-4 h-4 text-amber-300" /></div><span className="text-sm">{b.text}</span></motion.div>
              ))}
            </div>

            {/* plan selector */}
            <div className="mt-8 space-y-3">
              <button onClick={() => setPlan("annual")} data-testid="plus-plan-annual"
                className="w-full p-4 rounded-2xl border-2 text-left relative" style={plan === "annual" ? { borderColor: "#F5C355", background: "rgba(245,195,85,0.1)" } : { borderColor: "rgba(255,255,255,0.15)" }}>
                <span className="absolute -top-2.5 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full text-stone-900" style={{ background: "#F5C355" }}>AHORRA 36%</span>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display font-bold text-amber-50">Anual</div>
                    <div className="text-xs text-amber-100/60">{clp(annualPerMonth)}/mes, facturado una vez al año</div>
                  </div>
                  <div className="text-right"><div className="font-display font-bold text-xl text-amber-50">{clp(annual)}</div></div>
                </div>
              </button>
              <button onClick={() => setPlan("monthly")} data-testid="plus-plan-monthly"
                className="w-full p-4 rounded-2xl border-2 text-left" style={plan === "monthly" ? { borderColor: "#F5C355", background: "rgba(245,195,85,0.1)" } : { borderColor: "rgba(255,255,255,0.15)" }}>
                <div className="flex items-center justify-between">
                  <div><div className="font-display font-bold text-amber-50">Mensual</div><div className="text-xs text-amber-100/60">Flexible, cancela cuando quieras</div></div>
                  <div className="text-right"><div className="font-display font-bold text-xl text-amber-50">{clp(monthly)}</div><div className="text-xs text-amber-100/60">/mes</div></div>
                </div>
              </button>
            </div>

            {/* Mercado Pago email confirmation + advisory */}
            <div className="mt-6" data-testid="plus-mp-email-block">
              <label className="text-xs font-display font-semibold text-amber-100/85">Correo de tu cuenta de Mercado Pago</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" data-testid="plus-mp-email"
                placeholder="tucorreo@ejemplo.com"
                className="mt-1.5 w-full h-12 rounded-xl px-4 text-sm text-amber-50 placeholder:text-amber-100/35 outline-none"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)" }} />
              <p className="mt-1.5 text-[11px] text-amber-100/55">Usa el mismo correo de tu cuenta de Mercado Pago. Si no coincide, el botón "Confirmar" puede quedar deshabilitado.</p>
            </div>

            <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.06)" }} data-testid="plus-mp-notice">
              <div className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-100/70">
                <Info className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>Mercado Pago cobrará <b className="text-amber-50">$950 reembolsables</b> solo para validar tu tarjeta. Te recomendamos una <b className="text-amber-50">tarjeta de crédito</b> para el cobro automático. Puedes cancelar cuando quieras.</span>
              </div>
            </div>

            <button onClick={subscribe} disabled={busy || syncing} data-testid="plus-subscribe"
              className="mt-7 w-full h-15 py-4 rounded-2xl font-display font-bold text-lg text-stone-900 flex items-center justify-center gap-2" style={{ background: "#F5C355" }}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Crown className="w-5 h-5" /> Hazme Plus</>}
            </button>
            <p className="mt-3 text-center text-[11px] text-amber-100/50">Se renueva automáticamente. Puedes cancelar cuando quieras.</p>

            {st.free_mode && (
              <button onClick={devActivate} disabled={busy} data-testid="plus-dev-activate"
                className="mt-4 w-full h-11 rounded-2xl text-xs font-display font-semibold text-amber-100/70" style={{ background: "rgba(255,255,255,0.08)" }}>
                Activar en modo prueba (sin cobro)
              </button>
            )}
          </>
        )}
        {syncing && <p className="mt-4 text-center text-xs text-amber-100/60"><Loader2 className="w-3 h-3 animate-spin inline mr-1" /> Confirmando tu pago...</p>}
      </div>
    </div>
  );
}
