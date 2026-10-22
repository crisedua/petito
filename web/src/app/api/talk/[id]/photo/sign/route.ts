import { handler, json, readJson } from "@/lib/server/http";
import { getVideo } from "@/lib/server/talk";
import { assertJobOwner } from "@/lib/server/jobAccess";
import { signRawUploads } from "@/lib/server/uploads";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const v = await getVideo((await ctx.params).id);
  await assertJobOwner(v, req);
  return json(await signRawUploads(v.id, 1));
});
