import { handler, json } from "@/lib/server/http";
import { db } from "@/lib/server/db";

// Public check that the Amigos de Petito tables exist (yes/no only, no data).
export const GET = handler(async () => {
  const probe = async (table: string, col = "id") => {
    const { error } = await db().from(table).select(col, { head: true, count: "exact" }).limit(1);
    return error ? `missing: ${error.message.slice(0, 120)}` : "ok";
  };
  const checks = {
    friend_code: await probe("app_users", "friend_code"),
    connections: await probe("connections"),
    shares: await probe("shares"),
    share_reactions: await probe("share_reactions", "share_id"),
    share_comments: await probe("share_comments"),
  };
  return json({ ok: Object.values(checks).every((v) => v === "ok"), checks });
});
