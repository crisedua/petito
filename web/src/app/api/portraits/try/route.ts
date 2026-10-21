import { clip, dayStartIso, deviceId, fail, handler, json, readJson } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { validatePetId } from "@/lib/server/domain";
import { isoNow, newId, newSlug } from "@/lib/server/ids";
import { env } from "@/lib/server/env";
import { trackLater } from "@/lib/server/events";
import { PORTRAIT_STYLES, STYLE_DEFAULT_FRAME } from "@/lib/catalogs";
import { missingColumn } from "@/lib/server/admin";

/** The style of the free try: TRY_STYLE if it exists, otherwise the first painted style. */
const tryStyle = () =>
  env.tryStyle in PORTRAIT_STYLES ? env.tryStyle : (Object.entries(PORTRAIT_STYLES).find(([, s]) => s.mode === "paint")?.[0] ?? Object.keys(PORTRAIT_STYLES)[0]);

/**
 * "Pruébalo gratis": a portrait with no account, in one fixed style, so a visitor sees their own pet
 * transformed before signing up. Signed-in owners get a normal portrait of their active pet.
 * Anonymous rows are limited per device and per day (FREE_TRY_PER_DAY, TRY_DAILY_CAP).
 */
export const POST = handler(async (req: Request) => {
  const user = await getCurrentUser(req);
  if (user?.suspended_at) throw fail(403, "Tu cuenta está suspendida");
  const b = await readJson<{ pet_name?: string; pet_id?: string }>(req);
  const device = deviceId(req);
  if (!user) {
    if (!device) throw fail(400, "Falta el identificador del dispositivo");
    const { count: mine } = await db().from("portraits").select("id", { count: "exact", head: true })
      .eq("device_id", device).is("user_id", null).gte("created_at", dayStartIso());
    if ((mine ?? 0) >= env.freeTryPerDay) throw fail(429, "Ya usaste tus pruebas gratis de hoy. Crea tu cuenta para seguir 🐾");
    const { count: all } = await db().from("portraits").select("id", { count: "exact", head: true })
      .is("user_id", null).gte("created_at", dayStartIso());
    if ((all ?? 0) >= env.tryDailyCap) throw fail(429, "Hoy hubo demasiadas pruebas gratis. Vuelve mañana o crea tu cuenta 🐾");
  }
  const style = tryStyle();
  const p = {
    id: newId(), share_slug: newSlug(), device_id: device || null, user_id: user?.user_id ?? null,
    pet_id: user ? await validatePetId(b.pet_id, user.user_id) : null,
    pet_name: clip(b.pet_name, 40), style, category: "royal", status: "draft",
    price_clp: env.portraitPriceClp, gift_enabled: false,
    frame: STYLE_DEFAULT_FRAME[style] ?? null,
    created_at: isoNow(),
  };
  let { error } = await db().from("portraits").insert(p);
  if (error && missingColumn(error)) {
    const { frame: _f, ...rest } = p;
    ({ error } = await db().from("portraits").insert(rest));
  }
  if (error) throw error;
  trackLater("view_feature", { req, feature: "portrait", userId: user?.user_id ?? null, props: { mode: "try_free", style } });
  return json({ id: p.id, slug: p.share_slug, style });
});
