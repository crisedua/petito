import { dayStartIso, deviceId, fail, handler, json } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { getStory } from "@/lib/server/stories";
import { retentionIso } from "@/lib/server/jobPhotos";
import { isoNow } from "@/lib/server/ids";
import { env } from "@/lib/server/env";
import { inngest, EV } from "@/inngest/client";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const s = await getStory((await ctx.params).id);
  if ((s.photo_count ?? 0) < 1) throw fail(400, "Sube al menos una foto");
  const device = deviceId(req) || s.device_id || "";
  if (device) {
    const { count } = await db().from("stories").select("id", { count: "exact", head: true }).eq("device_id", device).gte("generated_at", dayStartIso());
    if ((count ?? 0) >= env.freePerDay) throw fail(429, `Límite de ${env.freePerDay} historias gratis por día alcanzado. Vuelve mañana 🐾`);
  }
  await db().from("stories").update({
    status: "generating", progress_step: "Preparando...", progress_pct: 5, generated_at: isoNow(),
    expires_at: retentionIso(env.retentionDays), error: null, ai_cost_usd: 0,
  }).eq("id", s.id);
  await inngest.send({ name: EV.storyGenerate, data: { story_id: s.id } });
  return json({ status: "generating" });
});
