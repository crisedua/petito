import { handler, json } from "@/lib/server/http";
import { isAdmin, requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { adminUserRow } from "@/lib/server/admin";

export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  let query = db().from("app_users").select("*");
  if (q) {
    const safe = q.replace(/[%_,()]/g, " ");
    query = query.or(`email.ilike.%${safe}%,name.ilike.%${safe}%`);
  }
  const { data } = await query.order("created_at", { ascending: false }).limit(1000);
  return json(await Promise.all((data ?? []).map((d) => adminUserRow(d, isAdmin))));
});
