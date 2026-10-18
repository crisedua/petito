import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { toggleHeart } from "@/lib/server/social";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) =>
  json(await toggleHeart(await requireUser(req), (await ctx.params).id)));
