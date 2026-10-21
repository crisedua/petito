import { ensureVoices, validVoice } from "@/lib/server/elevenlabs";
import { deviceId, handler, json, originFrom, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { validatePetId } from "@/lib/server/domain";
import { isoNow, newId, newSlug } from "@/lib/server/ids";
import { env } from "@/lib/server/env";
import { TALK_MESSAGE_MAX, TALK_SCENARIOS } from "@/lib/catalogs";
import { missingColumn } from "@/lib/server/admin";

export const POST = handler(async (req: Request) => {
  const user = await requireUser(req);
  await ensureVoices();
  const b = await readJson<{ pet_name?: string; voice_id?: string; pet_id?: string; scenario?: string; message?: string; to_name?: string }>(req);
  const v = {
    id: newId(), share_slug: newSlug(), device_id: deviceId(req), user_id: user.user_id, mode: "full",
    price_clp: env.talkPriceClp, status: "draft",
    pet_name: (b.pet_name ?? "").trim().slice(0, 40) || null,
    pet_id: await validatePetId(b.pet_id, user.user_id),
    scenario: b.scenario && b.scenario in TALK_SCENARIOS ? b.scenario : null,
    message: (b.message ?? "").trim().slice(0, TALK_MESSAGE_MAX) || null,
    voice_id: validVoice(b.voice_id), media_base: originFrom(req), created_at: isoNow(),
    to_name: (b.to_name ?? "").trim().slice(0, 40) || null,
  };
  let { error } = await db().from("videos").insert(v);
  // Before the 0009 SQL runs there is no to_name column: save without it.
  if (error && missingColumn(error)) {
    const { to_name: _t, ...rest } = v;
    ({ error } = await db().from("videos").insert(rest));
  }
  if (error) throw error;
  return json({ id: v.id, slug: v.share_slug });
});
