import { trackLater } from "@/lib/server/events";
import { handler, json } from "@/lib/server/http";
import { previewDraft } from "@/lib/server/talkPreview";
import { saveJobPhoto } from "@/lib/server/jobPhotos";
import type { Ctx } from "@/lib/server/route";

export const maxDuration = 60;
export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const v = await previewDraft((await ctx.params).id, req);
  await saveJobPhoto(req, "talk_photos", "video_id", v.id);
  trackLater("photo_uploaded", { req, feature: "video", props: { mode: "preview_free" } });
  return json({ uploaded: 1 });
});
