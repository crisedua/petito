import { ensureVoices, validVoice } from "@/lib/server/elevenlabs";
import { deviceId, fail, handler, json, originFrom, readJson } from "@/lib/server/http";
import { isAdmin, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { validatePetId } from "@/lib/server/domain";
import { isoNow, newId, newSlug } from "@/lib/server/ids";
import { env } from "@/lib/server/env";
import { MOTION_SCENES, SONG_STYLES, TALK_MESSAGE_MAX, TALK_SCENARIOS } from "@/lib/catalogs";
import { assertVideoAllowed } from "@/lib/server/plus";
import { trackLater } from "@/lib/server/events";
import { missingColumn } from "@/lib/server/admin";

export const POST = handler(async (req: Request) => {
  const user = await requireUser(req);
  await ensureVoices();
  const b = await readJson<{ pet_name?: string; voice_id?: string; pet_id?: string; scenario?: string; message?: string; to_name?: string; kind?: string; song_style?: string; scene?: string }>(req);
  const song = b.kind === "song";
  const motion = b.kind === "motion";
  try {
    await assertVideoAllowed(user.user_id, isAdmin(user), song ? "song" : motion ? "motion" : "full");
  } catch (e: any) {
    if (e?.status === 402) trackLater("paywall", { req, feature: "video", userId: user.user_id, props: { kind: b.kind } });
    throw e;
  }
  const v = {
    id: newId(), share_slug: newSlug(), device_id: deviceId(req), user_id: user.user_id, mode: song ? "song" : motion ? "motion" : "full",
    price_clp: env.talkPriceClp, status: "draft",
    pet_name: (b.pet_name ?? "").trim().slice(0, 40) || null,
    pet_id: await validatePetId(b.pet_id, user.user_id),
    // For songs, `scenario` holds the music style; the occasion rides in `message` is not used (lyrics are written by the AI).
    scenario: song ? (b.song_style && b.song_style in SONG_STYLES ? b.song_style : "pop")
      : motion ? (b.scene && b.scene in MOTION_SCENES ? b.scene : "viral")
      : b.scenario && b.scenario in TALK_SCENARIOS ? b.scenario : null,
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
