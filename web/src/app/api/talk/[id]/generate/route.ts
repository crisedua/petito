import { fail, handler, json, originFrom } from "@/lib/server/http";
import { isAdmin, requireUser } from "@/lib/server/auth";
import { assertJobOwner, assertStartable } from "@/lib/server/jobAccess";
import { assertVideoAllowed } from "@/lib/server/plus";
import { db } from "@/lib/server/db";
import { getVideo } from "@/lib/server/talk";
import { retentionIso } from "@/lib/server/jobPhotos";
import { env } from "@/lib/server/env";
import { inngest, EV } from "@/inngest/client";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser(req);
  const v = await getVideo((await ctx.params).id);
  await assertJobOwner(v, req);
  assertStartable(v);
  await assertVideoAllowed(user.user_id, isAdmin(user), v.mode);
  const { count } = await db().from("talk_photos").select("id", { count: "exact", head: true }).eq("video_id", v.id);
  if (!count) throw fail(400, "Sube una foto primero");
  await db().from("videos").update({
    status: "generating", progress_step: "Preparando...", progress_pct: 5, error: null,
    media_base: originFrom(req), expires_at: retentionIso(env.retentionDays),
  }).eq("id", v.id);
  await inngest.send({ name: EV.talkGenerate, data: { video_id: v.id } });
  return json({ status: "generating" });
});
