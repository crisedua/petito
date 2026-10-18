import { handler, json, readJson } from "@/lib/server/http";
import { getStory } from "@/lib/server/stories";
import { signRawUploads } from "@/lib/server/uploads";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const s = await getStory((await ctx.params).id);
  const { count } = await readJson<{ count?: number }>(req);
  return json(await signRawUploads(s.id, count ?? 1));
});
