import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Crown, Trash2, ArrowLeft, PawPrint } from "lucide-react";
import {
  adminUsers, adminUserDetail, adminSetPlus, adminDeletePet, adminDeleteUser, adminDeleteCreation,
  adminCreations,
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

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadList = async (query = "") => {
    try { setRows(await adminUsers(query)); } catch { toast.error("No se pudieron cargar los usuarios"); }
  };
  const openUser = async (id) => {
    setSel(id); setDetail(null);
    try { setDetail(await adminUserDetail(id)); } catch { toast.error("No se pudo abrir el usuario"); setSel(null); }
  };

  useEffect(() => { loadList(""); }, []);
  useEffect(() => { const t = setTimeout(() => loadList(q), 350); return () => clearTimeout(t); }, [q]);

  const togglePlus = async () => {
    setBusy(true);
    try { const r = await adminSetPlus(detail.user_id, !detail.is_plus); setDetail({ ...detail, is_plus: r.is_plus }); toast.success(r.is_plus ? "Plus activado (cortesía)" : "Plus quitado"); loadList(q); }
    catch { toast.error("No se pudo cambiar el plan"); } finally { setBusy(false); }
  };
  const delPet = async (pid) => {
    setBusy(true);
    try { await adminDeletePet(pid); setDetail({ ...detail, pets: detail.pets.filter((p) => p.id !== pid) }); toast.success("Mascota eliminada"); }
    catch { toast.error("No se pudo eliminar"); } finally { setBusy(false); }
  };
  const delCreation = async (c) => {
    setBusy(true);
    try { await adminDeleteCreation(c.kind, c.id); setDetail({ ...detail, creations: detail.creations.filter((x) => x.id !== c.id) }); toast.success("Creación eliminada"); }
    catch { toast.error("No se pudo eliminar"); } finally { setBusy(false); }
  };
  const delUser = async () => {
    setBusy(true);
    try { await adminDeleteUser(detail.user_id); toast.success("Cuenta eliminada"); setSel(null); setDetail(null); loadList(q); }
    catch { toast.error("No se pudo eliminar la cuenta"); } finally { setBusy(false); }
  };

  const KIND_LABEL = { story: "Historia", portrait: "Retrato", video: "Video" };

  if (sel) {
    if (!detail) return <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
    return (
      <div data-testid="admin-user-detail">
        <button onClick={() => { setSel(null); setDetail(null); }} className="inline-flex items-center gap-1 text-sm text-primary font-semibold mb-3" data-testid="admin-user-back">
          <ArrowLeft className="w-4 h-4" /> Usuarios
        </button>
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="font-display font-bold text-neutral-900 truncate">{detail.name || "—"}</div>
          <div className="text-xs text-muted-foreground truncate">{detail.email}</div>
          <div className="mt-3 flex items-center justify-between">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${detail.is_plus ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-500"}`}>
              {detail.is_plus ? "👑 Plus" : "Gratis"}
            </span>
            <button onClick={togglePlus} disabled={busy} data-testid="admin-toggle-plus"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-display font-bold ${detail.is_plus ? "bg-neutral-100 text-neutral-700" : "text-stone-900"}`}
              style={detail.is_plus ? {} : { background: "#F5C355" }}>
              <Crown className="w-3.5 h-3.5" /> {detail.is_plus ? "Quitar Plus" : "Dar Plus (cortesía)"}
            </button>
          </div>
        </div>

        <div className="mt-4 text-xs font-display font-bold text-neutral-700">Mascotas ({detail.pets.length})</div>
        <div className="mt-2 space-y-2" data-testid="admin-user-pets">
          {detail.pets.length === 0 && <p className="text-xs text-muted-foreground">Sin mascotas.</p>}
          {detail.pets.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3" data-testid={`admin-pet-${p.id}`}>
              <div className="w-9 h-9 rounded-full overflow-hidden grid place-items-center shrink-0" style={{ background: "#E2A878" }}>
                {p.photo_url ? <img src={p.photo_url} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="w-full h-full object-cover" /> : <PawPrint className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1 min-w-0"><div className="font-display font-semibold text-sm truncate">{p.name}</div><div className="text-[11px] text-muted-foreground">{p.species} · {p.memory_count} recuerdos</div></div>
              <ConfirmButton label="Eliminar" testid={`admin-del-pet-${p.id}`} busy={busy} onConfirm={() => delPet(p.id)} />
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs font-display font-bold text-neutral-700">Creaciones ({detail.creations.length})</div>
        <div className="mt-2 space-y-2" data-testid="admin-user-creations">
          {detail.creations.length === 0 && <p className="text-xs text-muted-foreground">Sin creaciones.</p>}
          {detail.creations.map((c) => (
            <div key={`${c.kind}-${c.id}`} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3" data-testid={`admin-creation-${c.id}`}>
              <div className="flex-1 min-w-0"><div className="font-display font-semibold text-sm truncate">{KIND_LABEL[c.kind]} · {c.title}</div><div className="text-[11px] text-muted-foreground">{c.status}</div></div>
              <button onClick={() => window.open(c.view_path, "_blank")} className="text-xs text-primary font-semibold">Ver</button>
              <ConfirmButton label="Borrar" testid={`admin-del-creation-${c.id}`} busy={busy} onConfirm={() => delCreation(c)} />
            </div>
          ))}
        </div>

        {!detail.is_admin && (
          <div className="mt-6 bg-red-50 rounded-2xl border border-red-200 p-4">
            <div className="text-xs font-display font-bold text-red-700">Zona peligrosa</div>
            <p className="text-[11px] text-red-600/80 mt-1 mb-2">Elimina la cuenta y TODO su contenido. Permanente.</p>
            <ConfirmButton label="Eliminar cuenta completa" testid="admin-del-user" busy={busy} onConfirm={delUser} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="admin-users-panel">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-display font-bold text-neutral-800">Usuarios</span>
        {rows !== null && <span className="text-xs text-muted-foreground" data-testid="admin-users-total">{rows.length} en total</span>}
      </div>
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por correo o nombre" data-testid="admin-users-search"
          className="w-full h-11 rounded-xl border border-border pl-9 pr-3 text-sm bg-white outline-none" />
      </div>
      {rows === null ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Sin usuarios.</p>}
          {rows.map((u) => (
            <button key={u.user_id} onClick={() => openUser(u.user_id)} data-testid={`admin-user-${u.user_id}`}
              className="w-full text-left bg-white rounded-2xl border border-border p-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-neutral-900 truncate">{u.name || u.email}</span>
                  {u.is_plus && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">PLUS</span>}
                  {u.is_admin && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">ADMIN</span>}
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
