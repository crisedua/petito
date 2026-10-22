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
    "0007 embudo": await probe("events", "id, name, feature, device_id, user_id, props"),
    "0008 marcos": await probe("portraits", "frame"),
    "0009 videomensaje": await probe("videos", "to_name"),
    "0011 texto en retrato": await probe("portraits", "caption"),
    "0012 planes Plus+": await plusPlusAccepted(),
  };
  return json({ ok: Object.values(checks).every((v) => v === "ok"), checks });
});

/** Insert and remove an inactive Plus+ row: the only way to see whether the plan check allows it. */
let plusPlusOk = false;
async function plusPlusAccepted(): Promise<string> {
  if (plusPlusOk) return "ok";
  const { data: u } = await db().from("app_users").select("user_id").limit(1).maybeSingle();
  if (!u) return "ok";
  const mp_id = `dev-healthcheck-${Date.now()}`;
  const { error } = await db().from("subscriptions").insert({ mp_id, user_id: u.user_id, plan: "pro_monthly", status: "healthcheck", membership_active: false });
  if (error) return `missing: ${error.message.slice(0, 120)}`;
  await db().from("subscriptions").delete().eq("mp_id", mp_id);
  plusPlusOk = true;
  return "ok";
}
