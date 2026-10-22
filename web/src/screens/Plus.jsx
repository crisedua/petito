"use client";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "@/lib/router";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Crown, Sparkles, Infinity as InfinityIcon, Share2, Mic, Info, AlertCircle, Music, Clapperboard, Image as ImageIcon, BookHeart } from "lucide-react";
import { getConfig, plusStatus, plusSubscribe, plusSync, plusCancel, plusDevActivate, plusAdminActivate, plusAdminDeactivate } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const PLUS_BENEFITS = [
  { icon: InfinityIcon, text: "Mascotas ilimitadas, cada una con su universo" },
  { icon: ImageIcon, text: "Retratos e historias incluidos, en HD y sin sello" },
  { icon: Mic, text: "Videos donde tu mascota te habla, incluidos" },
  { icon: Sparkles, text: "Pensamientos de Petipo ilimitados en tus recuerdos" },
  { icon: Share2, text: "Comparte el álbum público de tu mascota" },
];
const proBenefits = (n) => [
  { icon: Crown, text: "Todo lo de Petipo Plus" },
  { icon: Music, text: "Tu mascota te canta su propia canción" },
  { icon: Clapperboard, text: "Tu mascota baila y se mueve en video" },
  { icon: BookHeart, text: n > 0 ? `${n} videos de canción o movimiento cada mes` : "Canciones y videos en movimiento sin límite" },
];

const clp = (n) => "$" + (n || 0).toLocaleString("es-CL");
const TIER_NAME = { plus: "Petipo Plus", pro: "Petipo Plus+" };

export default function Plus() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user, loading, login } = useAuth();
  const [st, setSt] = useState(null);
  const [tier, setTier] = useState(params.get("tier") === "pro" ? "pro" : "plus");
  const [period, setPeriod] = useState("annual");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [email, setEmail] = useState("");
  const [payHelp, setPayHelp] = useState(false);

  // Visitors without an account see the plans and prices from the public config.
  const loadPublic = () => getConfig().then((c) => {
    const d = {
      active: false, tier: "none", anon: true, monthly_clp: c.plus_monthly_clp, annual_clp: c.plus_annual_clp,
      pro_monthly_clp: c.plus_pro_monthly_clp, pro_annual_clp: c.plus_pro_annual_clp,
      allowance: { premium_limit: c.plus_pro_monthly_videos ?? 0 },
    };
    setSt(d); return d;
  }).catch(() => null);
  const load = () => (user ? plusStatus().then((d) => { setSt(d); if (d?.tier === "plus") setTier("pro"); return d; }).catch(() => null) : loadPublic());

  useEffect(() => { if (user?.email && !email) setEmail(user.email); }, [user]); // eslint-disable-line

  useEffect(() => {
    if (loading) return;
    if (params.get("pago") === "success" && user) {
      setSyncing(true);
      plusSync()
        .then(() => load())
        .then((d) => { if (d && !d.active) setPayHelp(true); })
        .finally(() => setSyncing(false));
    } else {
      load();
    }
  }, [loading, user]); // eslint-disable-line

  const planKey = tier === "pro" ? `pro_${period}` : period;

  const subscribe = async () => {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Ingresa un correo válido de tu cuenta de Mercado Pago"); return; }
    setBusy(true);
    try {
      const r = await plusSubscribe(planKey, e, params.get("from") || undefined);
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
    try { await plusDevActivate(planKey); toast.success(`¡${TIER_NAME[tier]} activado (modo prueba)! 👑`); nav("/universo?plus=success"); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo activar"); setBusy(false); }
  };

  const adminActivate = async () => {
    setBusy(true);
    try { await plusAdminActivate(planKey); toast.success(`${TIER_NAME[tier]} activado (prueba de admin) 👑`); nav("/universo?plus=success"); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo activar"); setBusy(false); }
  };

  const adminDeactivate = async () => {
    setBusy(true);
    try { await plusAdminDeactivate(); toast.success("Plan de prueba desactivado"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo desactivar"); }
    finally { setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true);
    try { await plusCancel(); toast.success("Suscripción cancelada. Mantienes tu plan hasta el fin del período."); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo cancelar"); }
    finally { setBusy(false); }
  };

  if (!st) return <div className="mobile-frame grid place-items-center" style={{ background: "#2A1D16" }}><Loader2 className="w-7 h-7 animate-spin text-amber-300" /></div>;

  const n = st.allowance?.premium_limit ?? 0;
  const benefits = (t) => (t === "pro" ? proBenefits(n) : PLUS_BENEFITS);
  const canBuy = st.tier !== "pro";
  // Admins already have Plus+; they still get to see the plans as customers do, without paying.
  const preview = st.is_admin && !canBuy;

  return (
    <div className="mobile-frame" style={{ background: "linear-gradient(170deg,#3A2416,#241812)" }} data-testid="plus-screen">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => nav(user ? "/universo" : "/")} data-testid="plus-back" className="w-9 h-9 rounded-full grid place-items-center" style={{ background: "rgba(255,255,255,0.1)" }}>
          <ArrowLeft className="w-4 h-4 text-amber-100" />
        </button>
        <div className="flex items-center gap-1.5 font-display font-bold text-amber-100"><Crown className="w-5 h-5 text-amber-300" /> Petipo Plus</div>
      </div>

      <div className="flex-1 px-6 pt-6 pb-10 overflow-y-auto no-scrollbar">
        {st.active && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center" data-testid="plus-active">
            <div className="w-20 h-20 mx-auto rounded-full grid place-items-center" style={{ background: "rgba(245,195,85,0.18)" }}>
              <Crown className="w-10 h-10 text-amber-300" />
            </div>
            <h1 className="mt-5 font-display font-bold text-2xl text-amber-50" data-testid="plus-active-tier">Eres {TIER_NAME[st.tier]} 👑</h1>
            {st.via_admin ? (
              <p className="mt-2 text-sm text-amber-100/70" data-testid="plus-via-admin">Incluido por ser administrador · sin cobro</p>
            ) : (
              <p className="mt-2 text-sm text-amber-100/70">
                Plan {String(st.plan || "").endsWith("annual") ? "anual" : "mensual"}
                {st.plus_until ? ` · activo hasta el ${st.plus_until.slice(0, 10)}` : ""}
                {st.status === "canceled" ? " · no se renovará" : ""}
              </p>
            )}
            {st.tier === "pro" && n > 0 && !st.allowance?.unlimited && (
              <div className="mt-5 rounded-2xl p-4 text-left" style={{ background: "rgba(255,255,255,0.06)" }} data-testid="plus-allowance">
                <div className="flex items-center justify-between text-sm text-amber-50">
                  <span>Canciones y videos en movimiento este mes</span>
                  <b>{st.allowance.premium_used} de {n}</b>
                </div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.12)" }}>
                  <div className="h-full" style={{ width: `${Math.min(100, (st.allowance.premium_used / n) * 100)}%`, background: "#F5C355" }} />
                </div>
                <p className="mt-2 text-[11px] text-amber-100/60">Se renuevan el día 1 de cada mes.</p>
              </div>
            )}
            <div className="mt-6 text-left space-y-3">
              {benefits(st.tier).map((b, i) => (
                <div key={i} className="flex items-center gap-3 text-amber-50/90"><b.icon className="w-5 h-5 text-amber-300 shrink-0" /><span className="text-sm">{b.text}</span></div>
              ))}
            </div>
            {!st.via_admin && st.status !== "canceled" && (
              <button onClick={cancel} disabled={busy} data-testid="plus-cancel"
                className="mt-8 w-full h-12 rounded-2xl font-display font-semibold text-sm text-amber-100/70" style={{ background: "rgba(255,255,255,0.08)" }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Cancelar renovación"}
              </button>
            )}
            {st.is_admin && !st.via_admin && (
              <button onClick={adminDeactivate} disabled={busy} data-testid="plus-admin-deactivate"
                className="mt-3 w-full h-11 rounded-2xl text-xs font-display font-semibold text-amber-100/60" style={{ background: "rgba(255,255,255,0.06)", border: "1px dashed rgba(245,195,85,0.4)" }}>
                🛠️ Desactivar plan de prueba (solo admin)
              </button>
            )}
          </motion.div>
        )}

        {(canBuy || preview) && (
          <div className={st.active ? "mt-10 pt-8 border-t" : ""} style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            {payHelp && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid="plus-pay-help"
                className="mb-6 rounded-2xl p-4" style={{ background: "rgba(220,120,90,0.14)", border: "1px solid rgba(220,120,90,0.4)" }}>
                <div className="flex items-center gap-2 font-display font-bold text-amber-50 text-sm"><AlertCircle className="w-4 h-4 text-orange-300" /> No pudimos confirmar tu suscripción</div>
                <p className="mt-1.5 text-[11px] text-amber-100/80"><b className="text-amber-50">Lo más probable:</b> no puedes suscribirte con tu propia cuenta de Mercado Pago (la que recibe el dinero). Prueba con otra cuenta de Mercado Pago distinta.</p>
                <p className="mt-1.5 text-[11px] text-amber-100/70">Otros motivos posibles:</p>
                <ul className="mt-1.5 text-[11px] text-amber-100/70 space-y-1 list-disc pl-4">
                  <li>El correo no coincide con el de tu cuenta de Mercado Pago</li>
                  <li>Tarjeta de débito con restricción para cobros automáticos (prueba una de crédito)</li>
                  <li>La validación de $950 fue rechazada por tu banco</li>
                </ul>
                <button onClick={() => setPayHelp(false)} data-testid="plus-pay-retry"
                  className="mt-3 w-full h-10 rounded-xl font-display font-semibold text-xs text-stone-900" style={{ background: "#F5C355" }}>
                  Reintentar
                </button>
              </motion.div>
            )}

            {preview && (
              <div className="mb-5 rounded-2xl p-3 text-[11px] text-amber-100/80" style={{ background: "rgba(245,195,85,0.08)", border: "1px dashed rgba(245,195,85,0.45)" }} data-testid="plus-admin-preview">
                🛠️ Vista previa de administrador: así ven los planes tus clientes. Tú ya tienes Plus+ por ser admin, así que aquí no se cobra.
              </div>
            )}
            {st.tier === "plus" ? (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="font-display font-bold text-2xl text-amber-50 leading-tight">Mejora a Petipo Plus+</h2>
                <p className="mt-2 text-sm text-amber-100/70">Que tu mascota te cante y baile. Cancelamos tu plan Plus actual al activar Plus+, para que no pagues dos veces.</p>
              </motion.div>
            ) : (
              <>
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <h1 className="font-display font-bold text-3xl text-amber-50 leading-tight">Todo el universo de tu mascota.</h1>
                  <p className="mt-2 text-sm text-amber-100/70">Elige tu plan. Puedes cambiar o cancelar cuando quieras.</p>
                </motion.div>
                <div className="mt-6 grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.08)" }} data-testid="plus-tier-toggle">
                  {[["plus", "Plus", "Habla, retratos, historias"], ["pro", "Plus+", "También canta y baila"]].map(([k, l, sub]) => (
                    <button key={k} onClick={() => setTier(k)} data-testid={`plus-tier-${k}`}
                      className="py-2.5 rounded-xl text-center transition-all" style={tier === k ? { background: "#F5C355", color: "#1c1917" } : { color: "rgba(254,243,199,0.8)" }}>
                      <div className="font-display font-bold text-sm">{l}</div>
                      <div className="text-[10px] opacity-75">{sub}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-6 space-y-3">
              {benefits(tier).map((b, i) => (
                <motion.div key={`${tier}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}
                  className="flex items-center gap-3 text-amber-50/90"><div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: "rgba(245,195,85,0.15)" }}><b.icon className="w-4 h-4 text-amber-300" /></div><span className="text-sm">{b.text}</span></motion.div>
              ))}
            </div>

            <PeriodPicker st={st} tier={tier} period={period} setPeriod={setPeriod} />

            {st.anon && (
              <>
                <button onClick={() => login(`/plus?tier=${tier}`)} data-testid="plus-login-to-subscribe"
                  className="mt-7 w-full py-4 rounded-2xl font-display font-bold text-lg text-stone-900 flex items-center justify-center gap-2" style={{ background: "#F5C355" }}>
                  <Crown className="w-5 h-5" /> Entrar con Google para suscribirme
                </button>
                <p className="mt-3 text-center text-[11px] text-amber-100/50">Se paga con Mercado Pago. Puedes cancelar cuando quieras.</p>
              </>
            )}
            {!preview && !st.anon && (<>
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
              className="mt-7 w-full py-4 rounded-2xl font-display font-bold text-lg text-stone-900 flex items-center justify-center gap-2" style={{ background: "#F5C355" }}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Crown className="w-5 h-5" /> {st.tier === "plus" ? "Mejorar a Plus+" : tier === "pro" ? "Hazme Plus+" : "Hazme Plus"}</>}
            </button>
            <p className="mt-3 text-center text-[11px] text-amber-100/50">Se renueva automáticamente. Puedes cancelar cuando quieras.</p>
            </>)}

            {st.free_mode && !st.active && (
              <button onClick={devActivate} disabled={busy} data-testid="plus-dev-activate"
                className="mt-4 w-full h-11 rounded-2xl text-xs font-display font-semibold text-amber-100/70" style={{ background: "rgba(255,255,255,0.08)" }}>
                Activar {TIER_NAME[tier]} en modo prueba (sin cobro)
              </button>
            )}
          </div>
        )}

        {st.is_admin && !st.active && (
          <div className="mt-5 rounded-2xl p-4" style={{ background: "rgba(245,195,85,0.08)", border: "1px dashed rgba(245,195,85,0.45)" }} data-testid="plus-admin-tool">
            <div className="flex items-center gap-2 text-xs font-display font-bold text-amber-200">🛠️ Herramienta de administrador</div>
            <p className="mt-1 text-[11px] text-amber-100/65">Activa el plan elegido en tu cuenta para verificar la experiencia sin pago real. Esto solo lo ves tú como admin.</p>
            <button onClick={adminActivate} disabled={busy} data-testid="plus-admin-activate"
              className="mt-3 w-full h-11 rounded-xl text-xs font-display font-bold text-stone-900" style={{ background: "#F5C355" }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `Activar ${TIER_NAME[tier]} de prueba (solo admin)`}
            </button>
          </div>
        )}
        {syncing && <p className="mt-4 text-center text-xs text-amber-100/60"><Loader2 className="w-3 h-3 animate-spin inline mr-1" /> Confirmando tu pago...</p>}
      </div>
    </div>
  );
}

function PeriodPicker({ st, tier, period, setPeriod }) {
  const monthly = tier === "pro" ? st.pro_monthly_clp : st.monthly_clp;
  const annual = tier === "pro" ? st.pro_annual_clp : st.annual_clp;
  const perMonth = Math.round(annual / 12);
  const save = monthly ? Math.round((1 - annual / (monthly * 12)) * 100) : 0;
  const card = (on) => (on ? { borderColor: "#F5C355", background: "rgba(245,195,85,0.1)" } : { borderColor: "rgba(255,255,255,0.15)" });
  return (
    <div className="mt-8 space-y-3">
      <button onClick={() => setPeriod("annual")} data-testid="plus-plan-annual" className="w-full p-4 rounded-2xl border-2 text-left relative" style={card(period === "annual")}>
        {save > 0 && <span className="absolute -top-2.5 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full text-stone-900" style={{ background: "#F5C355" }}>AHORRA {save}%</span>}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-amber-50">Anual</div>
            <div className="text-xs text-amber-100/60">{clp(perMonth)}/mes, facturado una vez al año</div>
          </div>
          <div className="text-right"><div className="font-display font-bold text-xl text-amber-50">{clp(annual)}</div></div>
        </div>
      </button>
      <button onClick={() => setPeriod("monthly")} data-testid="plus-plan-monthly" className="w-full p-4 rounded-2xl border-2 text-left" style={card(period === "monthly")}>
        <div className="flex items-center justify-between">
          <div><div className="font-display font-bold text-amber-50">Mensual</div><div className="text-xs text-amber-100/60">Flexible, cancela cuando quieras</div></div>
          <div className="text-right"><div className="font-display font-bold text-xl text-amber-50">{clp(monthly)}</div><div className="text-xs text-amber-100/60">/mes</div></div>
        </div>
      </button>
    </div>
  );
}
