import { handler, json } from "@/lib/server/http";
import { getPortrait } from "@/lib/server/portraits";
import { assertJobOwner } from "@/lib/server/jobAccess";
import { signRawUploads } from "@/lib/server/uploads";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const p = await getPortrait((await ctx.params).id);
  await assertJobOwner(p, req);
  return json(await signRawUploads(p.id, 1));
});
