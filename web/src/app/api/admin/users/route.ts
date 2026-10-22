import { fail, handler, json, readJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { adminUserRows } from "@/lib/server/admin";
import { isoNow, newUserId } from "@/lib/server/ids";
import { grantPlus } from "@/lib/server/plus";
import { plusUntil, type PlusDuration } from "@/lib/server/adminPlus";

const FILTERS = new Set(["plus", "pro", "free", "admin", "suspended"]);

/** Users, newest first. `q` searches email/name; `filter` = plus | pro | free | admin | suspended. */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const filter = url.searchParams.get("filter") ?? "";
  let query = db().from("app_users").select("*");
  if (q) {
    const safe = q.replace(/[%_,()]/g, " ");
    query = query.or(`email.ilike.%${safe}%,name.ilike.%${safe}%`);
  }
  const { data } = await query.order("created_at", { ascending: false }).limit(1000);
  let rows = await adminUserRows(data ?? []);
  if (FILTERS.has(filter)) {
    rows = rows.filter((r) => (filter === "plus" ? r.tier === "plus" : filter === "pro" ? r.tier === "pro" : filter === "free" ? !r.is_plus : filter === "admin" ? r.is_admin : r.suspended));
  }
  return json(rows);
});

/**
 * Add someone by email before they ever sign in (e.g. to give them Plus ahead of time). Their first
 * Google sign-in with that email links to this account.
 */
export const POST = handler(async (req: Request) => {
  await requireAdmin(req);
  const b = await readJson<{ email?: string; name?: string; plus?: PlusDuration; until?: string }>(req);
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, "Correo no válido");
  const { data: existing } = await db().from("app_users").select("user_id").ilike("email", email).maybeSingle();
  if (existing) throw fail(409, "Ya existe un usuario con ese correo");
  const row = { user_id: newUserId(), auth_user_id: null, email, name: String(b.name ?? "").trim().slice(0, 80) || null, picture: null, created_at: isoNow() };
  const { error } = await db().from("app_users").insert(row);
  if (error) throw error;
  if (b.plus) await grantPlus(row.user_id, b.plus === "year" ? "annual" : "monthly", "courtesy", { until: plusUntil(b.plus, b.until) });
  return json({ user_id: row.user_id });
});
