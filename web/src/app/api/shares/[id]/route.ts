import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { deleteShare } from "@/lib/server/social";
import type { Ctx } from "@/lib/server/route";

/** Stop sharing (the creation itself is untouched). */
export const DELETE = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  await deleteShare(await requireUser(req), (await ctx.params).id);
  return json({ ok: true });
});
