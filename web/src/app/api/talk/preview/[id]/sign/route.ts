import { handler, json } from "@/lib/server/http";
import { previewDraft } from "@/lib/server/talkPreview";
import { signRawUploads } from "@/lib/server/uploads";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const v = await previewDraft((await ctx.params).id, req);
  return json(await signRawUploads(v.id, 1));
});
