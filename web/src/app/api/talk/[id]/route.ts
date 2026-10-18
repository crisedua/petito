import { handler, json } from "@/lib/server/http";
import { getVideo, talkPublic } from "@/lib/server/talk";
import type { Ctx } from "@/lib/server/route";

export const GET = handler(async (_req: Request, ctx: Ctx<{ id: string }>) => json(talkPublic(await getVideo((await ctx.params).id))));
