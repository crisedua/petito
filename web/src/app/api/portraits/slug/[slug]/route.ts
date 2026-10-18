import { handler, json } from "@/lib/server/http";
import { getPortraitBySlug, portraitPublic } from "@/lib/server/portraits";
import type { Ctx } from "@/lib/server/route";

export const GET = handler(async (_req: Request, ctx: Ctx<{ slug: string }>) => json(portraitPublic(await getPortraitBySlug((await ctx.params).slug))));
