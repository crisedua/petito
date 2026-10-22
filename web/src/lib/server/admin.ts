import { db, iso } from "./db";
import { planTier, revokePlus } from "./plus";
import { isAdmin, isOwnerAdmin } from "./auth";
import { createServiceClient } from "./supabase";

async function deleteStories(filter: { col: string; val: string }) {
  // slides cascade from stories via FK
  await db().from("stories").delete().eq(filter.col, filter.val);
}

export async function deletePetCascade(petId: string) {
  await db().from("memories").delete().eq("pet_id", petId);
  await deleteStories({ col: "pet_id", val: petId });
  await db().from("portraits").delete().eq("pet_id", petId);
  await db().from("videos").delete().eq("pet_id", petId);
  await db().from("pets").delete().eq("id", petId);
}

export async function deleteUserCascade(userId: string) {
  const { data: u } = await db().from("app_users").select("auth_user_id").eq("user_id", userId).maybeSingle();
  // Stop any Mercado Pago billing before the subscription rows disappear with the account.
  await revokePlus(userId);
  await deleteStories({ col: "user_id", val: userId });
  await db().from("portraits").delete().eq("user_id", userId);
  await db().from("videos").delete().eq("user_id", userId);
  // memories, pets and subscriptions cascade from app_users
  await db().from("app_users").delete().eq("user_id", userId);
  if (u?.auth_user_id) await createServiceClient().auth.admin.deleteUser(u.auth_user_id).catch(() => {});
}

/** All rows of a filtered select, past PostgREST's 1000-row cap. */
async function fetchAll<T = any>(build: () => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** List rows for many users with a handful of batched queries (instead of five per user). */
export async function adminUserRows(users: any[]) {
  const counts = new Map<string, { pets: number; creations: number }>();
  const plus = new Map<string, string | null>(); // user_id -> plus_until (null = no end)
  const pro = new Set<string>(); // users whose active plan is Plus+
  const bump = (uid: string, k: "pets" | "creations") => {
    const c = counts.get(uid) ?? { pets: 0, creations: 0 };
    c[k]++;
    counts.set(uid, c);
  };
  for (const ids of chunks(users.map((u) => u.user_id), 150)) {
    const [pets, stories, portraits, videos, subs] = await Promise.all([
      fetchAll(() => db().from("pets").select("user_id").in("user_id", ids).order("id")),
      fetchAll(() => db().from("stories").select("user_id").in("user_id", ids).neq("status", "draft").order("id")),
      fetchAll(() => db().from("portraits").select("user_id").in("user_id", ids).order("id")),
      fetchAll(() => db().from("videos").select("user_id").in("user_id", ids).order("id")),
      fetchAll(() => db().from("subscriptions").select("user_id, plan, plus_until").in("user_id", ids).eq("membership_active", true).order("mp_id")),
    ]);
    pets.forEach((r: any) => bump(r.user_id, "pets"));
    [...stories, ...portraits, ...videos].forEach((r: any) => bump(r.user_id, "creations"));
    const now = Date.now();
    subs.forEach((r: any) => {
      if (!r.plus_until || new Date(r.plus_until).getTime() > now) {
        plus.set(r.user_id, r.plus_until ? new Date(r.plus_until).toISOString() : null);
        if (planTier(r.plan) === "pro") pro.add(r.user_id);
      }
    });
  }
  return users.map((d) => ({
    user_id: d.user_id, email: d.email, name: d.name, picture: d.picture,
    is_admin: isAdmin(d), owner_admin: isOwnerAdmin(d.email), suspended: Boolean(d.suspended_at),
    is_plus: plus.has(d.user_id) || isAdmin(d),
    tier: pro.has(d.user_id) || isAdmin(d) ? "pro" : plus.has(d.user_id) ? "plus" : "none",
    plus_until: plus.get(d.user_id) ?? null, linked: Boolean(d.auth_user_id),
    pet_count: counts.get(d.user_id)?.pets ?? 0, creation_count: counts.get(d.user_id)?.creations ?? 0, created_at: iso(d.created_at),
  }));
}

/** Postgres "column does not exist" (the 0006 SQL hasn't been run yet). */
export const missingColumn = (e: any) => e?.code === "42703" || e?.code === "PGRST204" || /column .* does not exist|schema cache/i.test(String(e?.message ?? ""));
export const MIGRATION_HINT = "Falta correr el SQL de administración de usuarios (0006_admin_users.sql) en Supabase.";
