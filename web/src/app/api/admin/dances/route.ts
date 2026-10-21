import { fail, handler, json, readJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { danceUrlPath, refreshDances, startDance } from "@/lib/server/dances";
import { higgsfieldEnabled } from "@/lib/server/higgsfield";
import { DANCE_SECONDS, MOTION_SCENES } from "@/lib/catalogs";

export const maxDuration = 60;

/** Choreography library: one source video per dance (also finalizes generations that finished). */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const c = await refreshDances();
  return json({
    higgsfield: higgsfieldEnabled(), seconds: DANCE_SECONDS,
    dances: Object.entries(MOTION_SCENES).filter(([, s]) => s.choreo).map(([key, s]) => ({
      key, label: s.label, emoji: s.emoji, ready: Boolean(c[key]?.file), url: c[key]?.file ? danceUrlPath(c[key].file!) : null,
      created_at: c[key]?.created_at ?? null, pending: Boolean(c[key]?.pending), error: c[key]?.error ?? null,
    })),
  });
});

/** Generate (or regenerate) the choreography video for a dance: { key }. Takes 1–3 minutes. */
export const POST = handler(async (req: Request) => {
  await requireAdmin(req);
  const { key } = await readJson<{ key?: string }>(req);
  if (!key || !MOTION_SCENES[key]?.choreo) throw fail(400, "Ese baile no existe");
  if (!higgsfieldEnabled()) throw fail(503, "Higgsfield no está configurado");
  try {
    return json(await startDance(key));
  } catch (e: any) {
    throw fail(502, String(e?.message ?? "No se pudo iniciar").slice(0, 200));
  }
});
