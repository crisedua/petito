import { handler, json } from "@/lib/server/http";
import { startPreview } from "@/lib/server/talkPreview";

export const POST = handler(async (req: Request) => {
  const v = await startPreview(req);
  return json({ id: v.id, slug: v.share_slug });
});
