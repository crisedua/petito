import { fail, handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db, logGeneration } from "@/lib/server/db";
import { getMemory } from "@/lib/server/domain";
import { isPlus } from "@/lib/server/plus";
import { imageToB64 } from "@/lib/server/images";
import { reflectionFallback, writeMemoryReflection } from "@/lib/server/prompts";
import { llmCost, llmModel } from "@/lib/server/llm";
import type { Ctx } from "@/lib/server/route";
import { EMOTION_LABELS } from "@/lib/catalogs";

export const maxDuration = 60;

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser(req);
  const m = await getMemory((await ctx.params).id, user.user_id);
  if (!m.ai_reflection && !(await isPlus(user.user_id))) {
    // Legacy quota: memories created this month that already have a reflection.
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const { count } = await db().from("memories").select("id", { count: "exact", head: true })
      .eq("user_id", user.user_id).not("ai_reflection", "is", null).gte("created_at", start.toISOString());
    if ((count ?? 0) >= 3) throw fail(402, "Llegaste a tus 3 pensamientos de Petito gratis del mes. ¡Hazte Plus para tenerlos sin límite!");
  }
  const { data: pet } = await db().from("pets").select("name").eq("id", m.pet_id).eq("user_id", user.user_id).maybeSingle();
  const petName = pet?.name ?? "tu mascota";
  const labels = (m.emotions ?? []).map((k) => EMOTION_LABELS[k] ?? k).join(", ");
  let reflection: string;
  let usage = null;
  try {
    const b64 = m.photo_file ? await imageToB64(m.id, m.photo_file, 512) : null;
    ({ reflection, usage } = await writeMemoryReflection(petName, m.title, m.feeling_text, labels, b64));
  } catch (e) {
    console.error("memory reflection failed", e);
    reflection = reflectionFallback(petName);
  }
  await db().from("memories").update({ ai_reflection: reflection }).eq("id", m.id);
  if (usage) await logGeneration({ ownerId: m.id, step: "memory_reflection", model: llmModel(), usage, costUsd: llmCost(usage) });
  return json({ ai_reflection: reflection });
});
