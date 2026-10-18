import { handler, json } from "@/lib/server/http";
import { getStory, storyPublic } from "@/lib/server/stories";
import type { Ctx } from "@/lib/server/route";

export const GET = handler(async (_req: Request, ctx: Ctx<{ id: string }>) => json(await storyPublic(await getStory((await ctx.params).id))));
