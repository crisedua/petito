import { handler, json } from "@/lib/server/http";
import { getPortrait, portraitPublic } from "@/lib/server/portraits";
import type { Ctx } from "@/lib/server/route";

export const GET = handler(async (_req: Request, ctx: Ctx<{ id: string }>) => json(portraitPublic(await getPortrait((await ctx.params).id))));
