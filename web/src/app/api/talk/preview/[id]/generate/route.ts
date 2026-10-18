import { fail, handler, json } from "@/lib/server/http";
import { previewDraft } from "@/lib/server/talkPreview";
import { db } from "@/lib/server/db";
import { inngest, EV } from "@/inngest/client";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const v = await previewDraft((await ctx.params).id, req);
  const { count } = await db().from("talk_photos").select("id", { count: "exact", head: true }).eq("video_id", v.id);
  if (!count) throw fail(400, "Sube una foto");
  await db().from("videos").update({ status: "generating", progress_step: "Preparando...", progress_pct: 5 }).eq("id", v.id);
  await inngest.send({ name: EV.talkGenerate, data: { video_id: v.id } });
  return json({ id: v.id, slug: v.share_slug });
});
