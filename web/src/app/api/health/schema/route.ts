import { handler, json } from "@/lib/server/http";
import { db } from "@/lib/server/db";

// Public check that every SQL migration has been run in Supabase (yes/no only, no data).
export const GET = handler(async () => {
  const probe = async (table: string, cols: string) => {
    const { error } = await db().from(table).select(cols, { head: true, count: "exact" }).limit(1);
    return error ? `missing: ${error.message.slice(0, 120)}` : "ok";
  };
  const checks = {
    "0001-0004 base": await probe("app_users", "user_id, email"),
    "0005 amigos": await probe("connections", "id"),
    "0006 admin users": await probe("app_users", "is_admin, suspended_at, admin_note"),
  };
  return json({ ok: Object.values(checks).every((v) => v === "ok"), checks });
});
