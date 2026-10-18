import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { acceptRequest } from "@/lib/server/social";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const c = await acceptRequest(await requireUser(req), (await ctx.params).id);
  return json({ status: c.status });
});
