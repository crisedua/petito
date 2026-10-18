import { ensureVoices, validVoice } from "@/lib/server/elevenlabs";
import { deviceId, fail, handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { validatePetId } from "@/lib/server/domain";
import { isoNow, newId, newSlug } from "@/lib/server/ids";
import { env } from "@/lib/server/env";
import { SPECIES, THEMES, TRAITS } from "@/lib/catalogs";

export const POST = handler(async (req: Request) => {
  const user = await requireUser(req);
  await ensureVoices();
  const b = await readJson<{ pet_name?: string; species?: string; traits?: string[]; theme?: string; email?: string; voice_id?: string; pet_id?: string }>(req);
  if (!b.theme || !(b.theme in THEMES)) throw fail(400, "Tema inválido");
  const s = {
    id: newId(), share_slug: newSlug(), device_id: deviceId(req), user_id: user.user_id,
    pet_id: await validatePetId(b.pet_id, user.user_id),
    pet_name: (b.pet_name ?? "").trim().slice(0, 40) || "Mi mascota",
    species: b.species && b.species in SPECIES ? b.species : "otro",
    traits: (b.traits ?? []).filter((t) => TRAITS.includes(t)).slice(0, 3),
    theme: b.theme, email: b.email ?? null, status: "draft",
    price_clp: env.priceClp, bonus_enabled: env.bonusEnabled, voice_id: validVoice(b.voice_id), created_at: isoNow(),
  };
  const { error } = await db().from("stories").insert(s);
  if (error) throw error;
  return json({ id: s.id, slug: s.share_slug });
});
