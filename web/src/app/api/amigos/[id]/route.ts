import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { endConnection } from "@/lib/server/social";
import type { Ctx } from "@/lib/server/route";

/** Decline a request, cancel mine, or remove a friend. */
export const DELETE = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  await endConnection(await requireUser(req), (await ctx.params).id);
  return json({ ok: true });
});
