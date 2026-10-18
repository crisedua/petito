import { handler, json } from "@/lib/server/http";
import { getCurrentUser, requireUser } from "@/lib/server/auth";
import { connectionBetween, connectByCode, ownerByCode, ownerCards } from "@/lib/server/social";
import type { Ctx } from "@/lib/server/route";

/** Who sent this invite (name, picture, pets). Public, so a new visitor sees who invited them. */
export const GET = handler(async (req: Request, ctx: Ctx<{ code: string }>) => {
  const owner = await ownerByCode((await ctx.params).code);
  const card = (await ownerCards([owner])).get(owner);
  const me = await getCurrentUser(req);
  let status: "anon" | "self" | "friends" | "none" = "anon";
  if (me) status = me.user_id === owner ? "self" : (await connectionBetween(me.user_id, owner))?.status === "accepted" ? "friends" : "none";
  return json({ owner: card, status });
});

export const POST = handler(async (req: Request, ctx: Ctx<{ code: string }>) => {
  const me = await requireUser(req);
  const { owner } = await connectByCode(me, (await ctx.params).code);
  return json({ ok: true, owner: (await ownerCards([owner])).get(owner) });
});
