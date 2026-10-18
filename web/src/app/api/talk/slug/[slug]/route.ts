import { handler, json } from "@/lib/server/http";
import { getVideoBySlug, talkPublic } from "@/lib/server/talk";
import type { Ctx } from "@/lib/server/route";

export const GET = handler(async (_req: Request, ctx: Ctx<{ slug: string }>) => json(talkPublic(await getVideoBySlug((await ctx.params).slug))));
