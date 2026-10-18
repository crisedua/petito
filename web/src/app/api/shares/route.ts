import { handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { createShare } from "@/lib/server/social";

export const POST = handler(async (req: Request) => {
  const me = await requireUser(req);
  const b = await readJson<{ kind?: string; item_id?: string; note?: string }>(req);
  const { share, created } = await createShare(me, String(b.kind ?? ""), String(b.item_id ?? ""), b.note);
  return json({ id: share.id, created });
});
