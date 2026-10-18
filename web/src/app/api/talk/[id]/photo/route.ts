import { handler, json } from "@/lib/server/http";
import { getVideo } from "@/lib/server/talk";
import { saveJobPhoto } from "@/lib/server/jobPhotos";
import type { Ctx } from "@/lib/server/route";

export const maxDuration = 60;
export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const v = await getVideo((await ctx.params).id);
  await saveJobPhoto(req, "talk_photos", "video_id", v.id);
  return json({ uploaded: 1 });
});
