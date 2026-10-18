import { handler, json } from "@/lib/server/http";
import { getStoryBySlug, storyPublic } from "@/lib/server/stories";
import type { Ctx } from "@/lib/server/route";

export const GET = handler(async (_req: Request, ctx: Ctx<{ slug: string }>) => json(await storyPublic(await getStoryBySlug((await ctx.params).slug))));
