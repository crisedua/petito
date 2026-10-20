import { trackLater } from "@/lib/server/events";
import { handler, json } from "@/lib/server/http";
import { getPortrait } from "@/lib/server/portraits";
import { saveJobPhoto } from "@/lib/server/jobPhotos";
import type { Ctx } from "@/lib/server/route";

export const maxDuration = 60;
export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const p = await getPortrait((await ctx.params).id);
  await saveJobPhoto(req, "portrait_photos", "portrait_id", p.id);
  trackLater("photo_uploaded", { req, feature: p.category === "memorial" ? "memorial" : "portrait", userId: p.user_id, props: { style: p.style } });
  return json({ uploaded: 1 });
});
