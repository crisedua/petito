import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { deleteComment } from "@/lib/server/social";
import type { Ctx } from "@/lib/server/route";

export const DELETE = handler(async (req: Request, ctx: Ctx<{ id: string; cid: string }>) => {
  const { id, cid } = await ctx.params;
  await deleteComment(await requireUser(req), id, cid);
  return json({ ok: true });
});
