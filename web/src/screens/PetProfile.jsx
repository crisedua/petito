"use client";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ImagePlus, Check, Trash2, Share2, Copy, Cake, Heart } from "lucide-react";
import { getPet, updatePet, deletePet, uploadPetPhoto, getPetsMeta, getActivePetId, clearActivePet, mediaUrl } from "@/lib/api";

const SPECIES = [
  { key: "perro", label: "Perro", emoji: "🐶" },
  { key: "gato", label: "Gato", emoji: "🐱" },
  { key: "otro", label: "Otro", emoji: "🐾" },
];

export default function PetProfile() {
  const nav = useNavigate();
  const inputRef = useRef();
  const [pet, setPet] = useState(null);
  const [opts, setOpts] = useState([]);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("perro");
  const [personality, setPersonality] = useState([]);
  const [birthday, setBirthday] = useState("");
  const [adoption, setAdoption] = useState("");
  const [publicOn, setPublicOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    const pid = getActivePetId();
    if (!pid) { nav("/universo", { replace: true }); return; }
    getPet(pid).then((p) => {
      setPet(p); setName(p.name); setSpecies(p.species); setPersonality(p.personality || []);
      setBirthday(p.birthday || ""); setAdoption(p.adoption_date || ""); setPublicOn(!!p.public_enabled);
    }).catch(() => nav("/universo", { replace: true }));
    getPetsMeta().then((m) => setOpts(m.personality_options || [])).catch(() => {});
  }, [nav]);

  const onPhoto = async (list) => {
    const arr = Array.from(list);
    const f = arr.find((x) => x.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(x.name)) || arr[0];
    if (!f) return;
    setBusy(true);
    try { const r = await uploadPetPhoto(pet.id, f); setPet((p) => ({ ...p, photo_url: r.photo_url + `?t=${Date.now()}` })); toast.success("Foto actualizada"); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo subir la foto"); }
    finally { setBusy(false); }
  };

  const toggleP = (k) => setPersonality((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const save = async () => {
    if (!name.trim()) { toast.error("Ponle un nombre"); return; }
    setBusy(true);
    try {
      await updatePet(pet.id, { name: name.trim(), species, personality, birthday, adoption_date: adoption, public_enabled: publicOn });
      toast.success("Perfil guardado 🐾");
      nav("/universo");
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo guardar"); }
    finally { setBusy(false); }
  };

  const shareUrl = pet ? `${window.location.origin}/u/${pet.share_slug}` : "";
  const copyLink = () => { navigator.clipboard?.writeText(shareUrl); toast.success("Enlace copiado 🔗"); };

  const doDelete = async () => {
    setBusy(true);
    try { await deletePet(pet.id); clearActivePet(); toast.success("Mascota eliminada"); nav("/universo"); }
    catch { toast.error("No se pudo borrar"); setBusy(false); }
  };

  if (!pet) return <div className="mobile-frame grid place-items-center" style={{ background: "#FBF6EE" }}><Loader2 className="w-7 h-7 animate-spin" style={{ color: "#C2683F" }} /></div>;

  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="pet-profile-screen">
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => { onPhoto(e.target.files); e.target.value = ""; }} data-testid="profile-photo-input" />
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => nav("/universo")} data-testid="profile-back" className="w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: "#EADFCF" }}>
          <ArrowLeft className="w-4 h-4" style={{ color: "#8A6D4B" }} />
        </button>
        <div className="font-display font-bold" style={{ color: "#3A2A20" }}>Perfil de {pet.name}</div>
      </div>

      <div className="flex-1 px-6 pt-5 pb-10 overflow-y-auto no-scrollbar">
        <button onClick={() => inputRef.current?.click()} data-testid="profile-photo-button"
          className="mx-auto w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg grid place-items-center relative" style={{ background: "#F3E9DA" }}>
          {pet.photo_url ? <img src={mediaUrl(pet.photo_url)} alt={pet.name} className="w-full h-full object-cover" /> : <ImagePlus className="w-8 h-8" style={{ color: "#B85C3C" }} />}
          <div className="absolute bottom-0 inset-x-0 py-1 text-[10px] font-semibold text-white" style={{ background: "rgba(194,104,63,0.85)" }}>Cambiar</div>
        </button>

        <label className="block mt-6 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} data-testid="profile-name-input"
          className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-white border outline-none font-display" style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />

        <label className="block mt-4 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>Tipo</label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {SPECIES.map((s) => (
            <button key={s.key} onClick={() => setSpecies(s.key)} data-testid={`profile-species-${s.key}`}
              className="h-12 rounded-2xl border-2 font-display font-semibold text-sm"
              style={species === s.key ? { background: "#C2683F", color: "#fff", borderColor: "#C2683F" } : { background: "#fff", color: "#6E5B3E", borderColor: "#EADFCF" }}>
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        <label className="block mt-4 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}>Personalidad</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {opts.map((o) => {
            const on = personality.includes(o.key);
            return (
              <button key={o.key} onClick={() => toggleP(o.key)} data-testid={`profile-trait-${o.key}`}
                className="px-3.5 py-2 rounded-full border-2 font-display font-semibold text-sm"
                style={on ? { background: "#FBEEE4", borderColor: "#C2683F", color: "#B85C3C" } : { background: "#fff", borderColor: "#EADFCF", color: "#6E5B3E" }}>
                {o.emoji} {o.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="flex items-center gap-1 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}><Cake className="w-4 h-4" /> Cumpleaños</label>
            <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} data-testid="profile-birthday-input"
              className="mt-1.5 w-full h-12 px-3 rounded-2xl bg-white border outline-none font-display text-sm" style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />
          </div>
          <div>
            <label className="flex items-center gap-1 text-sm font-display font-semibold" style={{ color: "#6E5B3E" }}><Heart className="w-4 h-4" /> Adopción</label>
            <input type="date" value={adoption} onChange={(e) => setAdoption(e.target.value)} data-testid="profile-adoption-input"
              className="mt-1.5 w-full h-12 px-3 rounded-2xl bg-white border outline-none font-display text-sm" style={{ borderColor: "#EADFCF", color: "#3A2A20" }} />
          </div>
        </div>

        {/* Public album */}
        <div className="mt-6 p-4 rounded-2xl border" style={{ background: "#fff", borderColor: "#EEE3D2" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4" style={{ color: "#B85C3C" }} />
              <span className="font-display font-bold text-sm" style={{ color: "#3A2A20" }}>Álbum público</span>
            </div>
            <button onClick={() => setPublicOn((v) => !v)} data-testid="profile-public-toggle"
              className="w-12 h-7 rounded-full relative transition-colors" style={{ background: publicOn ? "#C2683F" : "#D9CDBB" }}>
              <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all" style={{ left: publicOn ? "22px" : "2px" }} />
            </button>
          </div>
          <p className="mt-1.5 text-xs" style={{ color: "#8A7868" }}>
            {publicOn ? "Cualquiera con el enlace verá solo los recuerdos que marques para compartir." : "Actívalo para compartir una página pública de tu mascota."}
          </p>
          {publicOn && (
            <button onClick={copyLink} data-testid="profile-copy-link"
              className="mt-3 w-full flex items-center justify-center gap-2 h-11 rounded-2xl font-display font-semibold text-sm" style={{ background: "#F3E9DA", color: "#8A6D4B" }}>
              <Copy className="w-4 h-4" /> Copiar enlace del álbum
            </button>
          )}
        </div>

        <button onClick={save} disabled={busy} data-testid="profile-save"
          className="mt-7 w-full h-14 rounded-2xl text-white font-display font-bold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "#C2683F" }}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Guardar perfil</>}
        </button>
        <button onClick={() => setConfirmDel(true)} data-testid="profile-delete"
          className="mt-3 w-full h-11 rounded-2xl font-display font-semibold text-sm flex items-center justify-center gap-2" style={{ color: "#B06A54" }}>
          <Trash2 className="w-4 h-4" /> Eliminar esta mascota
        </button>
      </div>

      {confirmDel && (
        <div className="absolute inset-0 z-50 grid place-items-center p-6" style={{ background: "rgba(40,28,20,0.45)" }} data-testid="profile-delete-confirm">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center">
            <h3 className="font-display font-bold text-lg" style={{ color: "#3A2A20" }}>¿Eliminar a {pet.name}?</h3>
            <p className="mt-1.5 text-sm" style={{ color: "#8A7868" }}>Se borrarán su universo y sus recuerdos. No se puede deshacer.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmDel(false)} className="flex-1 h-12 rounded-2xl font-display font-semibold border" style={{ borderColor: "#EADFCF", color: "#6E5B3E" }}>Cancelar</button>
              <button onClick={doDelete} disabled={busy} data-testid="profile-delete-yes" className="flex-1 h-12 rounded-2xl font-display font-bold text-white" style={{ background: "#C2683F" }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
