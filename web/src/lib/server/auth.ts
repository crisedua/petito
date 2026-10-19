import { createServiceClient, createSessionClient } from "./supabase";
import { env } from "./env";
import { fail } from "./http";
import { isoNow, newUserId } from "./ids";

export type AppUser = {
  user_id: string;
  auth_user_id: string | null;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: string;
  is_admin?: boolean;
  suspended_at?: string | null;
  admin_note?: string | null;
};

/** Admins listed in ADMIN_EMAILS (Vercel). They can't be demoted, suspended or deleted from the panel. */
export const isOwnerAdmin = (email: string | null | undefined) => env.adminEmails.has((email ?? "").toLowerCase());

/** Admin either from ADMIN_EMAILS or made admin in the panel (app_users.is_admin). */
export const isAdmin = (u: string | { email: string | null; is_admin?: boolean | null } | null | undefined) =>
  !u ? false : typeof u === "string" ? isOwnerAdmin(u) : isOwnerAdmin(u.email) || Boolean(u.is_admin);

export const SUSPENDED_DETAIL = "Tu cuenta está suspendida. Escríbenos por WhatsApp si crees que es un error.";

export const userPublic = (u: AppUser) => ({
  user_id: u.user_id,
  email: u.email,
  name: u.name,
  picture: u.picture,
  is_admin: isAdmin(u),
  suspended: Boolean(u.suspended_at),
});

async function findOrCreateByEmail(email: string, name: string | null, picture: string | null, authUserId: string | null) {
  const sb = createServiceClient();
  const lower = email.trim().toLowerCase();
  const { data: existing } = await sb.from("app_users").select("*").ilike("email", lower).limit(1).maybeSingle();
  if (existing) {
    // Migrated users get linked to their Google identity here; name/picture refresh on every login (legacy behaviour).
    const patch: Partial<AppUser> = { name: name ?? existing.name, picture: picture ?? existing.picture };
    if (authUserId && existing.auth_user_id !== authUserId) patch.auth_user_id = authUserId;
    const { data } = await sb.from("app_users").update(patch).eq("user_id", existing.user_id).select("*").single();
    return (data ?? { ...existing, ...patch }) as AppUser;
  }
  const row: AppUser = { user_id: newUserId(), auth_user_id: authUserId, email: lower, name, picture, created_at: isoNow() };
  const { data, error } = await sb.from("app_users").insert(row).select("*").single();
  if (error) throw error;
  return data as AppUser;
}

/** Test-only bypass so the legacy HTTP test suites can run: `Authorization: Bearer <token>`. */
async function testUser(req: Request): Promise<AppUser | null> {
  if (!env.allowTestTokens || !env.testSessionTokens) return null;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  const map = Object.fromEntries(env.testSessionTokens.split(",").map((p) => p.split("=").map((s) => s.trim())));
  const email = map[token];
  if (!email) return null;
  return findOrCreateByEmail(email, null, null, null);
}

/** The signed-in app user, or null. Links Supabase Auth identities to app_users rows by email. */
export async function getCurrentUser(req: Request): Promise<AppUser | null> {
  const t = await testUser(req);
  if (t) return t;
  const session = await createSessionClient();
  const { data } = await session.auth.getUser();
  const u = data.user;
  if (!u?.email) return null;
  const sb = createServiceClient();
  const { data: byAuth } = await sb.from("app_users").select("*").eq("auth_user_id", u.id).maybeSingle();
  if (byAuth) return byAuth as AppUser;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta.full_name as string) || (meta.name as string) || null;
  const picture = (meta.avatar_url as string) || (meta.picture as string) || null;
  return findOrCreateByEmail(u.email, name, picture, u.id);
}

export async function requireUser(req: Request): Promise<AppUser> {
  const u = await getCurrentUser(req);
  if (!u) throw fail(401, "Inicia sesión para continuar");
  if (u.suspended_at) throw fail(403, SUSPENDED_DETAIL);
  return u;
}

export async function requireAdmin(req: Request): Promise<AppUser> {
  const u = await requireUser(req);
  if (!isAdmin(u)) throw fail(403, "No autorizado");
  return u;
}
