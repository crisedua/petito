import { trackLater } from "@/lib/server/events";
import { handler, json } from "@/lib/server/http";
import { startPreview } from "@/lib/server/talkPreview";
import { saveJobPhoto } from "@/lib/server/jobPhotos";
import { db } from "@/lib/server/db";
import { inngest, EV } from "@/inngest/client";

export const maxDuration = 60;

/** Legacy one-shot anonymous preview (multipart `files`), kept for scripts and the HTTP test-suite. */
export const POST = handler(async (req: Request) => {
  const v = await startPreview(req);
  await saveJobPhoto(req, "talk_photos", "video_id", v.id);
  trackLater("photo_uploaded", { req, feature: "video", props: { mode: "preview_free" } });
  await db().from("videos").update({ status: "generating", progress_step: "Preparando...", progress_pct: 5 }).eq("id", v.id);
  await inngest.send({ name: EV.talkGenerate, data: { video_id: v.id } });
  return json({ id: v.id, slug: v.share_slug });
});
