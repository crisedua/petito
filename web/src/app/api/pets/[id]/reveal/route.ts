import { fail, handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db, logGeneration } from "@/lib/server/db";
import { getPet } from "@/lib/server/domain";
import { imageToB64 } from "@/lib/server/images";
import { petIntroFallback, writePetIntro } from "@/lib/server/prompts";
import { claudeCost } from "@/lib/server/anthropic";
import { env } from "@/lib/server/env";
import type { Ctx } from "@/lib/server/route";
import { PERSONALITY_LABELS } from "@/lib/catalogs";

export const maxDuration = 60;

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser(req);
  const pet = await getPet((await ctx.params).id, user.user_id);
  if (!pet.photo_file) throw fail(400, "Falta la foto de tu mascota");
  let labels = (pet.personality ?? []).map((k) => PERSONALITY_LABELS[k] ?? k).join(", ");
  if (pet.personality_text) labels = labels + (labels ? "; " : "") + pet.personality_text;
  let intro: string;
  let usage = null;
  try {
    const b64 = await imageToB64(pet.id, pet.photo_file, 512);
    ({ intro, usage } = await writePetIntro(b64, pet.name, pet.species, labels, pet.favorite_memory));
  } catch (e) {
    console.error("pet reveal failed", e);
    intro = petIntroFallback(pet.name);
  }
  await db().from("pets").update({ intro_text: intro }).eq("id", pet.id);
  if (usage) await logGeneration({ ownerId: pet.id, step: "pet_intro", model: env.claudeModel, usage, costUsd: claudeCost(usage) });
  return json({ intro_text: intro });
});
