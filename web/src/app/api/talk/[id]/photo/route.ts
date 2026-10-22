import { trackLater } from "@/lib/server/events";
import { handler, json } from "@/lib/server/http";
import { getVideo } from "@/lib/server/talk";
import { assertJobOwner } from "@/lib/server/jobAccess";
import { saveJobPhoto } from "@/lib/server/jobPhotos";
import type { Ctx } from "@/lib/server/route";

export const maxDuration = 60;
export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const v = await getVideo((await ctx.params).id);
  await assertJobOwner(v, req);
  await saveJobPhoto(req, "talk_photos", "video_id", v.id);
  trackLater("photo_uploaded", { req, feature: "video", userId: v.user_id, props: { mode: v.mode } });
  return json({ uploaded: 1 });
});
