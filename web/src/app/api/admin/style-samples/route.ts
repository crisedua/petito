import { fail, handler, json, readJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { loadImage } from "@/lib/server/images";
import { mediaPath } from "@/lib/server/storage";
import { chooseSample, generateCandidate, readCatalog, sampleUrl } from "@/lib/server/styleSamples";
import { PORTRAIT_FRAMES, PORTRAIT_STYLES, STYLE_DEFAULT_FRAME } from "@/lib/catalogs";

export const maxDuration = 60;

/** Every style with its built-in sample, the chosen one and the generated alternatives. */
export const GET = handler(async (req: Request) => {
  const me = await requireAdmin(req);
  const c = await readCatalog();
  const { data: pets } = await db().from("pets").select("id, name, photo_file").eq("user_id", me.user_id).not("photo_file", "is", null);
  return json({
    frames: Object.entries(PORTRAIT_FRAMES).map(([key, f]) => ({ key, label: f.label })),
    pets: (pets ?? []).map((p) => ({ id: p.id, name: p.name, photo_url: mediaPath(p.id, p.photo_file!) })),
    styles: Object.entries(PORTRAIT_STYLES).map(([key, s]) => ({
      key, label: s.label, emoji: s.emoji, default_frame: STYLE_DEFAULT_FRAME[key] ?? "dorado",
      builtin: ["estudio", "coronita", "flores"].includes(key) ? null : `/portrait-styles/${key}.jpg`,
      current: c[key]?.current ? sampleUrl(c[key].current!) : null, current_name: c[key]?.current ?? null,
      by_frame: c[key]?.byFrame ?? {},
      candidates: (c[key]?.candidates ?? []).map((x) => ({ ...x, url: sampleUrl(x.name) })),
    })),
  });
});

/** Generate one more alternative: { style, frame?, pet_id? } (pet_id = one of your pets' photos; default the example dog). */
export const POST = handler(async (req: Request) => {
  const me = await requireAdmin(req);
  const b = await readJson<{ style?: string; frame?: string; pet_id?: string }>(req);
  if (!b.style || !(b.style in PORTRAIT_STYLES)) throw fail(400, "Estilo inválido");
  let ref: { label: string; photo?: Buffer } = { label: "Perro de ejemplo" };
  if (b.pet_id) {
    const { data: pet } = await db().from("pets").select("id, name, photo_file").eq("id", b.pet_id).eq("user_id", me.user_id).maybeSingle();
    if (!pet?.photo_file) throw fail(400, "Esa mascota no tiene foto");
    ref = { label: pet.name, photo: await loadImage(pet.id, pet.photo_file) };
  }
  try {
    return json(await generateCandidate(b.style, b.frame ?? null, ref));
  } catch (e: any) {
    throw fail(502, String(e?.message ?? "No se pudo generar la muestra").slice(0, 200));
  }
});

/** Choose which alternative the app shows: { style, name } (name null = back to the built-in sample). */
export const PUT = handler(async (req: Request) => {
  await requireAdmin(req);
  const b = await readJson<{ style?: string; name?: string | null }>(req);
  if (!b.style || !(b.style in PORTRAIT_STYLES)) throw fail(400, "Estilo inválido");
  try {
    await chooseSample(b.style, b.name ?? null);
  } catch (e: any) {
    throw fail(400, e.message);
  }
  return json({ ok: true });
});
