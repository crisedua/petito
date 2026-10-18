import { handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { addComment, listComments } from "@/lib/server/social";
import type { Ctx } from "@/lib/server/route";

export const GET = handler(async (req: Request, ctx: Ctx<{ id: string }>) =>
  json(await listComments(await requireUser(req), (await ctx.params).id)));

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const me = await requireUser(req);
  const { id } = await ctx.params;
  await addComment(me, id, (await readJson<{ body?: string }>(req)).body);
  return json(await listComments(me, id));
});
