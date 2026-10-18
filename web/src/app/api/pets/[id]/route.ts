import { fail, handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getPet } from "@/lib/server/domain";
import { petPublic } from "@/lib/server/serializers";
import type { Ctx } from "@/lib/server/route";
import { PERSONALITY_LABELS, SPECIES } from "@/lib/catalogs";

type P = Ctx<{ id: string }>;

export const GET = handler(async (req: Request, ctx: P) => {
  const user = await requireUser(req);
  return json(petPublic(await getPet((await ctx.params).id, user.user_id)));
});

export const PUT = handler(async (req: Request, ctx: P) => {
  const user = await requireUser(req);
  const pet = await getPet((await ctx.params).id, user.user_id);
  const b = await readJson<Record<string, any>>(req);
  const upd: Record<string, unknown> = {};
  if (typeof b.name === "string") {
    const n = b.name.trim().slice(0, 40);
    if (!n) throw fail(400, "El nombre no puede quedar vacío");
    upd.name = n;
  }
  if (typeof b.species === "string") upd.species = b.species in SPECIES ? b.species : pet.species;
  if (Array.isArray(b.personality)) upd.personality = b.personality.filter((k: string) => k in PERSONALITY_LABELS).slice(0, 5);
  if (typeof b.personality_text === "string") upd.personality_text = b.personality_text.trim().slice(0, 200) || null;
  if (typeof b.birthday === "string") upd.birthday = b.birthday.trim().slice(0, 10) || null;
  if (typeof b.adoption_date === "string") upd.adoption_date = b.adoption_date.trim().slice(0, 10) || null;
  if (b.public_enabled !== undefined && b.public_enabled !== null) upd.public_enabled = Boolean(b.public_enabled);
  if (Object.keys(upd).length) await db().from("pets").update(upd).eq("id", pet.id);
  return json(petPublic(await getPet(pet.id, user.user_id)));
});

export const DELETE = handler(async (req: Request, ctx: P) => {
  const user = await requireUser(req);
  const pet = await getPet((await ctx.params).id, user.user_id);
  await db().from("memories").delete().eq("pet_id", pet.id).eq("user_id", user.user_id);
  await db().from("pets").delete().eq("id", pet.id);
  return json({ ok: true });
});
