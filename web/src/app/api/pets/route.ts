import { clip, fail, handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { isPlus } from "@/lib/server/plus";
import { isoNow, newId, newSlug } from "@/lib/server/ids";
import { petPublic, type PetRow } from "@/lib/server/serializers";
import { PERSONALITY_LABELS, SPECIES } from "@/lib/catalogs";

export const GET = handler(async (req: Request) => {
  const user = await requireUser(req);
  const { data } = await db().from("pets").select("*").eq("user_id", user.user_id).order("created_at", { ascending: true }).limit(50);
  return json((data ?? []).map((p) => petPublic(p as PetRow)));
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson<{ name?: string; species?: string; personality?: string[]; personality_text?: string; favorite_memory?: string }>(req);
  const name = (body.name ?? "").trim().slice(0, 40);
  if (!name) throw fail(400, "Ponle un nombre a tu mascota");
  const { count } = await db().from("pets").select("id", { count: "exact", head: true }).eq("user_id", user.user_id);
  if ((count ?? 0) >= 1 && !(await isPlus(user.user_id))) {
    throw fail(402, "El plan gratis incluye 1 mascota. ¡Hazte Plus para crear universos ilimitados!");
  }
  const pet: PetRow = {
    id: newId(), share_slug: newSlug(), user_id: user.user_id, name,
    species: body.species && body.species in SPECIES ? body.species : "perro",
    personality: (body.personality ?? []).filter((k) => k in PERSONALITY_LABELS).slice(0, 5),
    personality_text: clip(body.personality_text, 200),
    favorite_memory: clip(body.favorite_memory, 400),
    photo_file: null, intro_text: null, birthday: null, adoption_date: null, public_enabled: false,
    created_at: isoNow(),
  };
  const { error } = await db().from("pets").insert(pet);
  if (error) throw error;
  // Their first pet adopts anything they made before having one (the free try on the landing).
  if (!count) {
    for (const t of ["portraits", "videos", "stories"]) {
      await db().from(t).update({ pet_id: pet.id }).eq("user_id", user.user_id).is("pet_id", null);
    }
  }
  return json(petPublic(pet));
});
