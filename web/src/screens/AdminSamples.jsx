"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Check } from "lucide-react";
import { adminChooseSample, adminGenerateSample, adminSetImageEngine, adminStyleSamples, adminShowcase, adminSetShowcase } from "@/lib/api";

/**
 * Admin → Muestras: the pictures on the portrait style picker. Generate alternatives with the real
 * portrait AI (same prompt and frame a customer gets) and pick the one customers see.
 */
export default function AdminSamples() {
  const [d, setD] = useState(null);
  const [ref, setRef] = useState(""); // "" = example dog, else one of your pets
  const [engine, setEngine] = useState(""); // "" = the current default
  const [batch, setBatch] = useState(null); // { done, total } while generating everything that's missing
  const load = () => adminStyleSamples().then(setD).catch((e) => toast.error(e?.response?.data?.detail || "No se pudieron cargar las muestras"));
  useEffect(() => { load(); }, []);

  if (!d) return <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const missing = d.styles.flatMap((s) => d.frames.filter((f) => !s.by_frame?.[f.key]).map((f) => ({ style: s.key, frame: f.key })));
  const generateMissing = async (list) => {
    setBatch({ done: 0, total: list.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      try { await adminGenerateSample(list[i].style, list[i].frame, ref, engine); } catch { failed++; }
      setBatch({ done: i + 1, total: list.length, failed });
      if ((i + 1) % 5 === 0) load();
    }
    await load();
    setBatch(null);
    toast[failed ? "error" : "success"](failed ? `Listo, pero ${failed} fallaron. Vuelve a intentar.` : "Todas las muestras listas 🎉");
  };

  return (
    <div data-testid="admin-samples">
      <ShowcasePicker />
      <p className="mt-6 text-xs text-muted-foreground">
        Estas son las imágenes que ven los clientes al elegir estilo. Genera alternativas con la IA real (mismo estilo y marco que recibe un cliente) y elige la mejor. Cada una cuesta lo mismo que un retrato (~US$0,04) y tarda unos 20 segundos.
      </p>
      <label className="mt-3 block text-[11px] font-semibold text-neutral-500">Mascota de referencia</label>
      <select value={ref} onChange={(e) => setRef(e.target.value)} data-testid="samples-ref"
        className="mt-1 w-full h-10 rounded-xl border border-border px-3 text-sm bg-white">
        <option value="">Perro de ejemplo (golden retriever)</option>
        {d.pets.map((p) => <option key={p.id} value={p.id}>{p.name} (tu mascota)</option>)}
      </select>
      <label className="mt-3 block text-[11px] font-semibold text-neutral-500">Motor de imagen (para comparar)</label>
      <select value={engine} onChange={(e) => setEngine(e.target.value)} data-testid="samples-engine"
        className="mt-1 w-full h-10 rounded-xl border border-border px-3 text-sm bg-white">
        <option value="">Por defecto: {d.engines.find((e) => e.key === d.default_engine)?.label}</option>
        {d.engines.map((e) => <option key={e.key} value={e.key} disabled={!e.available}>{e.label} · {e.note} · ~US${e.cost_usd.toFixed(2)}{e.available ? "" : " (sin configurar)"}</option>)}
      </select>
      {engine && engine !== d.default_engine && (
        <button onClick={async () => { try { await adminSetImageEngine(engine); toast.success("Ahora todos los retratos usan ese motor"); await load(); } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo cambiar"); } }}
          data-testid="samples-set-default-engine" className="mt-2 w-full h-10 rounded-xl border border-primary text-primary text-sm font-bold">
          Usar {d.engines.find((e) => e.key === engine)?.label} para todos los retratos
        </button>
      )}
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3" data-testid="samples-batch">
        <div className="text-xs text-amber-900">
          {missing.length
            ? <>Faltan <b>{missing.length}</b> combinaciones de estilo y marco. Generarlas todas cuesta unos US${(missing.length * 0.04).toFixed(2)} y toma ~{Math.ceil(missing.length * 20 / 60)} min (deja esta pantalla abierta).</>
            : "Todos los estilos tienen muestra en todos los marcos."}
        </div>
        {missing.length > 0 && (
          <button onClick={() => generateMissing(missing)} disabled={!!batch} data-testid="samples-generate-all"
            className="mt-2 w-full h-10 rounded-xl bg-primary text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
            {batch ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando {batch.done} de {batch.total}…</> : <><Sparkles className="w-4 h-4" /> Generar todo lo que falta</>}
          </button>
        )}
      </div>
      <div className="mt-4 space-y-4">
        {d.styles.map((s) => <StyleRow key={s.key} s={s} frames={d.frames} petId={ref} engine={engine} engines={d.engines} reload={load} busyAll={!!batch}
          onMissing={(list) => generateMissing(list)} />)}
      </div>
    </div>
  );
}

function StyleRow({ s, frames, petId, engine, engines, reload, busyAll, onMissing }) {
  const engineLabel = (k) => (k === "petito" ? "Petito" : engines.find((e) => e.key === k)?.label ?? k ?? "");
  const missingHere = frames.filter((f) => !s.by_frame?.[f.key]).map((f) => ({ style: s.key, frame: f.key }));
  const [frame, setFrame] = useState(s.default_frame);
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try { await adminGenerateSample(s.key, frame, petId, engine); toast.success("Alternativa lista"); await reload(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo generar"); }
    finally { setBusy(false); }
  };
  const choose = async (name) => {
    try { await adminChooseSample(s.key, name); toast.success(name ? "Muestra elegida" : "Volvió la muestra original"); await reload(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo elegir"); }
  };
  const frameLabel = (k) => frames.find((f) => f.key === k)?.label ?? k;

  return (
    <div className="bg-white rounded-2xl border border-border p-3.5" data-testid={`samples-${s.key}`}>
      <div className="flex items-center justify-between">
        <div className="font-display font-bold text-neutral-900">{s.emoji} {s.label}</div>
        {missingHere.length > 0 && (
          <button onClick={() => onMissing(missingHere)} disabled={busyAll} data-testid={`samples-missing-${s.key}`}
            className="text-[11px] font-bold text-primary disabled:opacity-50">Generar {missingHere.length} marcos que faltan</button>
        )}
      </div>
      <div className="mt-2 text-[11px] font-semibold text-neutral-500">Lo que ve el cliente en cada marco</div>
      <div className="mt-1 grid grid-cols-5 gap-1.5" data-testid={`samples-byframe-${s.key}`}>
        {frames.map((f) => {
          const name = s.by_frame?.[f.key];
          const url = name ? s.candidates.find((c) => c.name === name)?.url : null;
          return (
            <div key={f.key}>
              <div className="rounded-md overflow-hidden bg-stone-100 grid place-items-center" style={{ aspectRatio: "3 / 4" }}>
                {url ? <img src={url} alt={f.label} className="w-full h-full object-cover" /> : <span className="text-[9px] text-muted-foreground text-center px-1">sin muestra</span>}
              </div>
              <div className="mt-0.5 text-[9px] leading-tight text-neutral-600 text-center">{f.label}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[11px] font-semibold text-neutral-500">Alternativas (toca “Usar” para mostrarla en su marco)</div>
      <div className="mt-1 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {s.builtin && <Thumb url={s.builtin} label="Original" active={!s.current_name} onUse={() => choose(null)} />}
        {s.candidates.map((c) => (
          <Thumb key={c.name} url={c.url} label={c.engine ? engineLabel(c.engine) : frameLabel(c.frame)} sub={c.engine ? `${frameLabel(c.frame)} · ${c.ref}` : c.ref} active={s.current_name === c.name} onUse={() => choose(c.name)} />
        ))}
        {busy && <div className="w-[72px] shrink-0 rounded-lg bg-stone-100 grid place-items-center" style={{ aspectRatio: "3 / 4" }}><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
      </div>
      <div className="mt-2 flex gap-2">
        <select value={frame} onChange={(e) => setFrame(e.target.value)} data-testid={`samples-frame-${s.key}`}
          className="flex-1 h-9 rounded-xl border border-border px-2 text-xs bg-white">
          {frames.map((f) => <option key={f.key} value={f.key}>{f.label}{f.key === s.default_frame ? " (por defecto)" : ""}</option>)}
        </select>
        <button onClick={generate} disabled={busy} data-testid={`samples-generate-${s.key}`}
          className="px-3 h-9 rounded-xl bg-primary text-white text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generar alternativa
        </button>
      </div>
    </div>
  );
}

function Thumb({ url, label, sub, active, onUse }) {
  return (
    <div className="w-[72px] shrink-0">
      <div className={`relative rounded-lg overflow-hidden border-2 ${active ? "border-primary" : "border-transparent"}`} style={{ aspectRatio: "3 / 4" }}>
        <img src={url} alt={label} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.opacity = 0.2; }} />
        {active && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary grid place-items-center"><Check className="w-3 h-3 text-white" /></span>}
      </div>
      <div className="mt-1 text-[10px] leading-tight text-neutral-600 truncate">{label}</div>
      {sub && <div className="text-[9px] leading-tight text-muted-foreground truncate">{sub}</div>}
      {!active && <button onClick={onUse} className="mt-0.5 text-[10px] font-bold text-primary" data-testid="samples-use">Usar</button>}
    </div>
  );
}

/** The three creations featured on the landing (your own, so no customer's pet is ever shown). */
function ShowcasePicker() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => adminShowcase().then(setD).catch((e) => toast.error(e?.response?.data?.detail || "No se pudo cargar la portada"));
  useEffect(() => { load(); }, []);
  if (!d) return null;
  const toggle = async (c) => {
    const refs = d.refs.filter((r) => !(r.kind === c.kind && r.id === c.id));
    if (!c.chosen) {
      if (refs.length >= d.max) return toast.error(`Máximo ${d.max} en la portada`);
      refs.push({ kind: c.kind, id: c.id });
    }
    setBusy(true);
    try { await adminSetShowcase(refs); await load(); toast.success(c.chosen ? "Quitado de la portada" : "En la portada"); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo guardar"); }
    finally { setBusy(false); }
  };
  return (
    <div className="bg-white rounded-2xl border border-border p-3.5" data-testid="admin-showcase">
      <div className="font-display font-bold text-neutral-900">Portada ({d.items.length} de {d.max})</div>
      <p className="text-xs text-muted-foreground mt-0.5">Lo que ven los visitantes antes de subir su foto. Elige hasta {d.max} de tus creaciones: idealmente un retrato, un video que habla y una más. Solo tus propias creaciones.</p>
      {d.candidates.length === 0 && <p className="mt-3 text-xs text-amber-800">Aún no tienes retratos ni videos listos con tu cuenta. Crea algunos con tu mascota y vuelve aquí.</p>}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {d.candidates.map((c) => (
          <button key={`${c.kind}:${c.id}`} onClick={() => toggle(c)} disabled={busy} title={c.title} data-testid={`showcase-pick-${c.id}`}
            className={`relative rounded-lg overflow-hidden border-2 ${c.chosen ? "border-primary" : "border-transparent"}`} style={{ aspectRatio: "3 / 4" }}>
            <img src={c.thumb} alt={c.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.opacity = 0.2; }} />
            <span className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-white">{c.kind === "video" ? "video" : "retrato"}</span>
            {c.chosen && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary grid place-items-center"><Check className="w-3 h-3 text-white" /></span>}
          </button>
        ))}
      </div>
    </div>
  );
}
