"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Crown, Trash2, ArrowLeft, PawPrint, UserPlus } from "lucide-react";
import {
  adminUsers, adminUserDetail, adminSetPlus, adminDeletePet, adminDeleteUser, adminDeleteCreation,
  adminCreations, adminCreateUser, adminUpdateUser,
} from "@/lib/api";

function ConfirmButton({ label, onConfirm, testid, busy }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button onClick={() => setArmed(true)} data-testid={testid}
        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
        <Trash2 className="w-3.5 h-3.5" /> {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-red-600 font-semibold">¿Seguro?</span>
      <button onClick={onConfirm} disabled={busy} data-testid={`${testid}-confirm`} className="font-bold text-red-700">Sí, borrar</button>
      <button onClick={() => setArmed(false)} className="text-neutral-500">No</button>
    </span>
  );
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : "—");
const SOURCE_LABEL = { mercadopago: "Mercado Pago", courtesy: "Cortesía", admin: "Admin", dev: "Prueba" };
const DURATIONS = [["month", "1 mes"], ["year", "1 año"], ["lifetime", "Sin término"], ["until", "Hasta fecha"]];
const FILTERS = [["", "Todos"], ["plus", "Plus"], ["pro", "Plus+"], ["free", "Gratis"], ["admin", "Admins"], ["suspended", "Suspendidos"]];
const errMsg = (e, fb) => e?.response?.data?.detail || fb;

function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-500", plus: "bg-amber-100 text-amber-700", admin: "bg-blue-100 text-blue-700",
    danger: "bg-red-100 text-red-700", muted: "bg-neutral-100 text-neutral-400",
  };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

function Section({ title, children, testid }) {
  return (
    <div className="mt-4 bg-white rounded-2xl border border-border p-4" data-testid={testid}>
      <div className="text-xs font-display font-bold text-neutral-700 mb-3">{title}</div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, disabled, testid }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} disabled={disabled} data-testid={testid} role="switch" aria-checked={on}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-primary" : "bg-neutral-300"} ${disabled ? "opacity-40" : ""}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function PlusPicker({ value, setValue, until, setUntil }) {
  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        {DURATIONS.map(([k, l]) => (
          <button key={k} onClick={() => setValue(k)} data-testid={`admin-plus-duration-${k}`}
            className={`py-2 rounded-xl text-[11px] font-display font-semibold border ${value === k ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-white border-border text-neutral-600"}`}>{l}</button>
        ))}
      </div>
      {value === "until" && (
        <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} data-testid="admin-plus-until"
          className="mt-2 w-full h-10 rounded-xl border border-border px-3 text-sm bg-white" />
      )}
    </>
  );
}

function AddUser({ onCreated, onCancel }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [givePlus, setGivePlus] = useState(false);
  const [duration, setDuration] = useState("year");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await adminCreateUser({ email: email.trim(), name: name.trim(), ...(givePlus ? { plus: duration, until } : {}) });
      toast.success("Usuario agregado. Cuando entre con Google usando ese correo, verá su cuenta.");
      onCreated(r.user_id);
    } catch (e) { toast.error(errMsg(e, "No se pudo agregar")); } finally { setBusy(false); }
  };
  return (
    <div className="mb-3 bg-white rounded-2xl border border-border p-4" data-testid="admin-add-user">
      <div className="text-sm font-display font-bold text-neutral-800">Agregar usuario</div>
      <p className="text-[11px] text-muted-foreground mt-0.5">Útil para dejarle Pro listo antes de que entre por primera vez.</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Correo de Google" data-testid="admin-add-email"
        className="mt-3 w-full h-10 rounded-xl border border-border px-3 text-sm bg-white outline-none" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (opcional)" data-testid="admin-add-name"
        className="mt-2 w-full h-10 rounded-xl border border-border px-3 text-sm bg-white outline-none" />
      <label className="mt-3 flex items-center justify-between text-sm font-display font-semibold text-neutral-700">
        Darle Pro <Toggle on={givePlus} onChange={setGivePlus} testid="admin-add-plus" />
      </label>
      {givePlus && <div className="mt-2"><PlusPicker value={duration} setValue={setDuration} until={until} setUntil={setUntil} /></div>}
      <div className="mt-3 flex gap-2">
        <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-neutral-600">Cancelar</button>
        <button onClick={submit} disabled={busy || !email.includes("@")} data-testid="admin-add-submit"
          className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Agregar"}</button>
      </div>
    </div>
  );
}

function UserDetail({ id, onBack, onChanged }) {
  const [d, setD] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", admin_note: "" });
  const [duration, setDuration] = useState("year");
  const [grantTier, setGrantTier] = useState("plus");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = async () => {
    try {
      const x = await adminUserDetail(id);
      setD(x); setForm({ name: x.name || "", email: x.email || "", admin_note: x.admin_note || "" });
      setGrantTier(x.plus?.tier === "pro" ? "pro" : "plus");
    } catch { toast.error("No se pudo abrir el usuario"); onBack(); }
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (!d) return <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const run = async (fn, ok) => {
    setBusy(true);
    try { const r = await fn(); if (ok) toast.success(typeof ok === "function" ? ok(r) : ok); await load(); onChanged(); return r; }
    catch (e) { toast.error(errMsg(e, "No se pudo completar")); } finally { setBusy(false); }
  };
  const dirty = form.name !== (d.name || "") || form.email !== d.email || form.admin_note !== (d.admin_note || "");
  const save = () => run(() => adminUpdateUser(id, form), "Datos guardados");
  const grant = () => run(() => adminSetPlus(id, true, { duration, until, tier: grantTier }), grantTier === "pro" ? "Plus+ activado" : "Plus activado");
  const revoke = () => run(() => adminSetPlus(id, false), (r) => r.mp_failed?.length
    ? "Plan quitado, pero Mercado Pago no confirmó la cancelación. Revísalo en Mercado Pago."
    : r.mp_canceled?.length ? "Plan quitado y suscripción de Mercado Pago cancelada" : "Plan quitado");
  const setAdmin = (v) => run(() => adminUpdateUser(id, { is_admin: v }), v ? "Ahora es admin" : "Ya no es admin");
  const setSuspended = (v) => run(() => adminUpdateUser(id, { suspended: v }), v ? "Cuenta suspendida" : "Cuenta reactivada");
  const delPet = (pid) => run(() => adminDeletePet(pid), "Mascota eliminada");
  const delCreation = (c) => run(() => adminDeleteCreation(c.kind, c.id), "Creación eliminada");
  const delUser = async () => {
    setBusy(true);
    try { await adminDeleteUser(id); toast.success("Cuenta eliminada"); onChanged(); onBack(); }
    catch (e) { toast.error(errMsg(e, "No se pudo eliminar la cuenta")); setBusy(false); }
  };

  const cur = d.plus?.current;
  const KIND_LABEL = { story: "Historia", portrait: "Retrato", video: "Video" };
  const initial = (d.name || d.email || "?").charAt(0).toUpperCase();

  return (
    <div data-testid="admin-user-detail">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-primary font-semibold mb-3" data-testid="admin-user-back">
        <ArrowLeft className="w-4 h-4" /> Usuarios
      </button>

      <div className="bg-white rounded-2xl border border-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden grid place-items-center shrink-0 bg-primary/10">
            {d.picture ? <img src={d.picture} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <span className="font-display font-bold text-primary">{initial}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-neutral-900 truncate">{d.name || "Sin nombre"}</div>
            <div className="text-xs text-muted-foreground truncate">{d.email}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" data-testid="admin-user-badges">
          {d.is_plus ? <Badge tone="plus">{d.plus?.tier === "pro" ? "👑 PLUS+" : "👑 PLUS"}</Badge> : <Badge>GRATIS</Badge>}
          {d.is_admin && <Badge tone="admin">{d.owner_admin ? "ADMIN (FIJO)" : "ADMIN"}</Badge>}
          {d.suspended && <Badge tone="danger">SUSPENDIDA</Badge>}
          {!d.linked && <Badge tone="muted">AÚN NO ENTRA</Badge>}
          {d.is_self && <Badge tone="muted">TÚ</Badge>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>Cliente desde: <b className="text-neutral-700">{fmtDate(d.created_at)}</b></span>
          <span>Último ingreso: <b className="text-neutral-700">{fmtDate(d.last_sign_in_at)}</b></span>
          <span>Mascotas: <b className="text-neutral-700">{d.pets.length}</b> · Creaciones: <b className="text-neutral-700">{d.creations.length}</b></span>
          <span>Amigos: <b className="text-neutral-700">{d.friend_count ?? "—"}</b></span>
        </div>
      </div>

      <Section title="Datos" testid="admin-user-edit">
        <label className="text-[11px] font-semibold text-neutral-500">Nombre</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} data-testid="admin-edit-name"
          className="mt-1 w-full h-10 rounded-xl border border-border px-3 text-sm bg-white outline-none" />
        <label className="mt-3 block text-[11px] font-semibold text-neutral-500">Correo</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" data-testid="admin-edit-email" disabled={d.owner_admin}
          className="mt-1 w-full h-10 rounded-xl border border-border px-3 text-sm bg-white outline-none disabled:opacity-50" />
        {d.linked && form.email !== d.email && <p className="mt-1 text-[11px] text-amber-700">Seguirá entrando con su misma cuenta de Google; esto solo cambia el correo que ves aquí.</p>}
        <label className="mt-3 block text-[11px] font-semibold text-neutral-500">Nota interna (solo admins)</label>
        <textarea value={form.admin_note} onChange={(e) => setForm({ ...form, admin_note: e.target.value })} maxLength={2000} rows={2} data-testid="admin-edit-note"
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm bg-white outline-none resize-none" />
        <button onClick={save} disabled={!dirty || busy} data-testid="admin-edit-save"
          className="mt-2 w-full h-10 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-40">Guardar cambios</button>
      </Section>

      <Section title="Plan (Petito Plus / Plus+)" testid="admin-user-plus">
        <div className="text-sm" data-testid="admin-plus-status">
          {cur ? (
            <>
              <div className="font-display font-bold text-amber-700">👑 {String(cur.plan).startsWith("pro_") ? "Plus+" : "Plus"} activo · {SOURCE_LABEL[cur.source] || cur.source}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {cur.until ? `Hasta ${fmtDate(cur.until)}` : "Sin fecha de término"}
                {cur.source === "mercadopago" && cur.next_payment_date ? ` · próximo cobro ${fmtDate(cur.next_payment_date)}` : ""}
                {cur.source === "mercadopago" ? ` · estado ${cur.status}` : ""}
              </div>
            </>
          ) : d.is_plus && d.is_admin ? (
            <div className="font-display font-bold text-amber-700">👑 Plus+ incluido por ser administrador</div>
          ) : <div className="font-display font-semibold text-neutral-600">Cuenta gratis</div>}
        </div>
        <div className="mt-3 text-[11px] font-semibold text-neutral-500">{cur ? "Cambiar plan o duración (cortesía)" : "Dar un plan de cortesía"}</div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5" data-testid="admin-plus-tier">
          {[["plus", "Plus"], ["pro", "Plus+ (canta y baila)"]].map(([k, l]) => (
            <button key={k} onClick={() => setGrantTier(k)} data-testid={`admin-plus-tier-${k}`}
              className={`h-9 rounded-xl text-xs font-bold border ${grantTier === k ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-white border-border text-neutral-600"}`}>{l}</button>
          ))}
        </div>
        <div className="mt-1.5"><PlusPicker value={duration} setValue={setDuration} until={until} setUntil={setUntil} /></div>
        <button onClick={grant} disabled={busy || (duration === "until" && !until)} data-testid="admin-plus-grant"
          className="mt-2 w-full h-10 rounded-xl text-sm font-bold text-stone-900 inline-flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ background: "#F5C355" }}>
          <Crown className="w-4 h-4" /> {cur ? "Aplicar" : grantTier === "pro" ? "Dar Plus+" : "Dar Plus"}
        </button>
        {d.is_plus && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{cur?.source === "mercadopago" ? "También cancela su suscripción en Mercado Pago." : "Vuelve a cuenta gratis."}</span>
            <ConfirmButton label="Quitar plan" testid="admin-plus-revoke" busy={busy} onConfirm={revoke} />
          </div>
        )}
        {d.plus?.history?.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowHistory((v) => !v)} className="text-[11px] font-semibold text-primary" data-testid="admin-plus-history-toggle">
              {showHistory ? "Ocultar historial" : `Ver historial (${d.plus.history.length})`}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-1.5" data-testid="admin-plus-history">
                {d.plus.history.map((h) => (
                  <div key={h.id} className="text-[11px] flex items-center justify-between rounded-lg bg-neutral-50 px-2.5 py-1.5">
                    <span className="font-semibold text-neutral-700">{SOURCE_LABEL[h.source] || h.source} · {String(h.plan).startsWith("pro_") ? "Plus+ " : "Plus "}{String(h.plan).endsWith("annual") ? "anual" : "mensual"}</span>
                    <span className="text-muted-foreground">{h.active ? "activo" : h.status || "inactivo"} · {h.until ? fmtDate(h.until) : "sin término"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Acceso" testid="admin-user-access">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-display font-semibold text-neutral-800">Administrador</div>
            <div className="text-[11px] text-muted-foreground">{d.owner_admin ? "Fijo por ADMIN_EMAILS en Vercel." : "Puede entrar a este panel y gestionar usuarios."}</div>
          </div>
          <Toggle on={d.is_admin} onChange={setAdmin} disabled={busy || d.owner_admin || (d.is_self && d.is_admin) || d.suspended} testid="admin-toggle-admin" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-display font-semibold text-neutral-800">Suspender cuenta</div>
            <div className="text-[11px] text-muted-foreground">{d.suspended ? `Suspendida desde ${fmtDate(d.suspended_at)}. No puede entrar ni crear nada.` : "Bloquea el acceso sin borrar nada."}</div>
          </div>
          <Toggle on={d.suspended} onChange={setSuspended} disabled={busy || d.is_self || d.is_admin} testid="admin-toggle-suspended" />
        </div>
      </Section>

      <div className="mt-4 text-xs font-display font-bold text-neutral-700">Mascotas ({d.pets.length})</div>
      <div className="mt-2 space-y-2" data-testid="admin-user-pets">
        {d.pets.length === 0 && <p className="text-xs text-muted-foreground">Sin mascotas.</p>}
        {d.pets.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3" data-testid={`admin-pet-${p.id}`}>
            <div className="w-9 h-9 rounded-full overflow-hidden grid place-items-center shrink-0" style={{ background: "#E2A878" }}>
              {p.photo_url ? <img src={p.photo_url} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="w-full h-full object-cover" /> : <PawPrint className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1 min-w-0"><div className="font-display font-semibold text-sm truncate">{p.name}</div><div className="text-[11px] text-muted-foreground">{p.species} · {p.memory_count} recuerdos</div></div>
            <ConfirmButton label="Eliminar" testid={`admin-del-pet-${p.id}`} busy={busy} onConfirm={() => delPet(p.id)} />
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs font-display font-bold text-neutral-700">Creaciones ({d.creations.length})</div>
      <div className="mt-2 space-y-2" data-testid="admin-user-creations">
        {d.creations.length === 0 && <p className="text-xs text-muted-foreground">Sin creaciones.</p>}
        {d.creations.map((c) => (
          <div key={`${c.kind}-${c.id}`} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3" data-testid={`admin-creation-${c.id}`}>
            <div className="flex-1 min-w-0"><div className="font-display font-semibold text-sm truncate">{KIND_LABEL[c.kind]} · {c.title}</div><div className="text-[11px] text-muted-foreground">{c.status} · {fmtDate(c.created_at)}</div></div>
            <button onClick={() => window.open(c.view_path, "_blank")} className="text-xs text-primary font-semibold">Ver</button>
            <ConfirmButton label="Borrar" testid={`admin-del-creation-${c.id}`} busy={busy} onConfirm={() => delCreation(c)} />
          </div>
        ))}
      </div>

      {!d.is_self && !d.owner_admin && (
        <div className="mt-6 bg-red-50 rounded-2xl border border-red-200 p-4">
          <div className="text-xs font-display font-bold text-red-700">Zona peligrosa</div>
          <p className="text-[11px] text-red-600/80 mt-1 mb-2">Elimina la cuenta y TODO su contenido. Si paga por Mercado Pago, se cancela la suscripción. Permanente.</p>
          <ConfirmButton label="Eliminar cuenta completa" testid="admin-del-user" busy={busy} onConfirm={delUser} />
        </div>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);

  const loadList = async (query = q, f = filter) => {
    try { setRows(await adminUsers(query, f)); } catch { toast.error("No se pudieron cargar los usuarios"); }
  };
  useEffect(() => { const t = setTimeout(() => loadList(q, filter), 300); return () => clearTimeout(t); }, [q, filter]); // eslint-disable-line

  if (sel) return <UserDetail id={sel} onBack={() => setSel(null)} onChanged={() => loadList()} />;

  return (
    <div data-testid="admin-users-panel">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-display font-bold text-neutral-800">Usuarios {rows !== null && <span className="text-xs font-normal text-muted-foreground" data-testid="admin-users-total">· {rows.length}</span>}</span>
        {!adding && (
          <button onClick={() => setAdding(true)} data-testid="admin-add-user-open" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold">
            <UserPlus className="w-3.5 h-3.5" /> Agregar
          </button>
        )}
      </div>
      {adding && <AddUser onCancel={() => setAdding(false)} onCreated={(uid) => { setAdding(false); loadList(); setSel(uid); }} />}
      <div className="relative mb-2">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por correo o nombre" data-testid="admin-users-search"
          className="w-full h-11 rounded-xl border border-border pl-9 pr-3 text-sm bg-white outline-none" />
      </div>
      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar" data-testid="admin-users-filters">
        {FILTERS.map(([k, l]) => (
          <button key={k || "all"} onClick={() => setFilter(k)} data-testid={`admin-filter-${k || "all"}`}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${filter === k ? "bg-primary text-white" : "bg-white border border-border text-neutral-600"}`}>{l}</button>
        ))}
      </div>
      {rows === null ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Sin usuarios.</p>}
          {rows.map((u) => (
            <button key={u.user_id} onClick={() => setSel(u.user_id)} data-testid={`admin-user-${u.user_id}`}
              className="w-full text-left bg-white rounded-2xl border border-border p-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-display font-semibold text-neutral-900 truncate max-w-[60%]">{u.name || u.email}</span>
                  {u.is_plus && <Badge tone="plus">{u.tier === "pro" ? "PLUS+" : "PLUS"}</Badge>}
                  {u.is_admin && <Badge tone="admin">ADMIN</Badge>}
                  {u.suspended && <Badge tone="danger">SUSPENDIDA</Badge>}
                  {!u.linked && <Badge tone="muted">SIN INGRESAR</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-muted-foreground">{u.pet_count} 🐾 · {u.creation_count} ✨</div>
                {u.created_at && <div className="text-[10px] text-muted-foreground/70">{new Date(u.created_at).toLocaleDateString("es-CL")}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminCreations() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const KIND = { story: "Historia", portrait: "Retrato", video: "Video" };
  const load = async () => { try { setRows(await adminCreations()); } catch { toast.error("No se pudieron cargar las creaciones"); } };
  useEffect(() => { load(); }, []);
  const del = async (c) => {
    setBusy(true);
    try { await adminDeleteCreation(c.kind, c.id); setRows((rs) => rs.filter((x) => x.id !== c.id)); toast.success("Creación eliminada"); }
    catch { toast.error("No se pudo eliminar"); } finally { setBusy(false); }
  };
  if (rows === null) return <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  return (
    <div className="space-y-2" data-testid="admin-creations-panel">
      {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Sin creaciones.</p>}
      {rows.map((c) => (
        <div key={`${c.kind}-${c.id}`} className="bg-white rounded-2xl border border-border p-3.5 flex items-center gap-3" data-testid={`admin-gcreation-${c.id}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold text-neutral-900 truncate">{KIND[c.kind]} · {c.title}</span>
              {c.paid && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">PAGADA</span>}
            </div>
            <div className="text-xs text-muted-foreground truncate">{c.status}{c.email ? ` · ${c.email}` : ""}</div>
          </div>
          <button onClick={() => window.open(c.view_path, "_blank")} className="text-xs text-primary font-semibold">Ver</button>
          <ConfirmButton label="Borrar" testid={`admin-del-gcreation-${c.id}`} busy={busy} onConfirm={() => del(c)} />
        </div>
      ))}
    </div>
  );
}
