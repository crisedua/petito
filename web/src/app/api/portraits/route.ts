import { clip, deviceId, fail, handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { validatePetId } from "@/lib/server/domain";
import { isoNow, newId, newSlug } from "@/lib/server/ids";
import { env } from "@/lib/server/env";
import { MEMORIAL_STYLES, PORTRAIT_FRAMES, PORTRAIT_STYLES } from "@/lib/catalogs";
import { missingColumn } from "@/lib/server/admin";

export const POST = handler(async (req: Request) => {
  const user = await requireUser(req);
  const b = await readJson<Record<string, any>>(req);
  const category = b.category === "memorial" ? "memorial" : "royal";
  const valid = category === "memorial" ? MEMORIAL_STYLES : PORTRAIT_STYLES;
  if (!b.style || !(b.style in valid)) throw fail(400, "Estilo inválido");
  const p = {
    id: newId(), share_slug: newSlug(), device_id: deviceId(req), user_id: user.user_id,
    pet_id: await validatePetId(b.pet_id, user.user_id),
    pet_name: clip(b.pet_name, 40), style: b.style, category, status: "draft",
    price_clp: env.portraitPriceClp,
    gift_enabled: Boolean(b.gift_enabled) && category === "royal",
    gift_to: clip(b.gift_to, 60), gift_from: clip(b.gift_from, 60), gift_message: clip(b.gift_message, 280),
    memorial_dates: clip(b.memorial_dates, 40), memorial_caption: clip(b.memorial_caption, 80),
    frame: category === "royal" && typeof b.frame === "string" && b.frame in PORTRAIT_FRAMES ? b.frame : null,
    caption: clip(b.caption, 60),
    created_at: isoNow(),
  };
  let { error } = await db().from("portraits").insert(p);
  // Before the 0008/0011 SQL runs there is no frame/caption column: save without them.
  if (error && missingColumn(error)) {
    const { frame: _f, caption: _c, ...rest } = p;
    ({ error } = await db().from("portraits").insert(rest));
  }
  if (error) throw error;
  return json({ id: p.id, slug: p.share_slug });
});
