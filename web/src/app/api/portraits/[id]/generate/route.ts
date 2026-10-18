import { fail, handler, json } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { getPortrait } from "@/lib/server/portraits";
import { retentionIso } from "@/lib/server/jobPhotos";
import { env } from "@/lib/server/env";
import { inngest, EV } from "@/inngest/client";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const p = await getPortrait((await ctx.params).id);
  const { count } = await db().from("portrait_photos").select("id", { count: "exact", head: true }).eq("portrait_id", p.id);
  if (!count) throw fail(400, "Sube una foto primero");
  await db().from("portraits").update({
    status: "generating", progress_step: "Preparando...", progress_pct: 5,
    expires_at: retentionIso(env.retentionDays), error: null, ai_cost_usd: 0,
  }).eq("id", p.id);
  await inngest.send({ name: EV.portraitGenerate, data: { portrait_id: p.id } });
  return json({ status: "generating" });
});
