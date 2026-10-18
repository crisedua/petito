import { handler, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export const POST = handler(async (req: Request) => {
  const user = await requireAdmin(req);
  await db().from("subscriptions").delete().eq("user_id", user.user_id);
  return json({ active: false });
});
