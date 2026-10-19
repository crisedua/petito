import { fail, handler, json, readJson } from "@/lib/server/http";
import { isAdmin, isOwnerAdmin, requireAdmin, type AppUser } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";
import { plusInfo } from "@/lib/server/plus";
import { mediaPath } from "@/lib/server/storage";
import { createServiceClient } from "@/lib/server/supabase";
import { deleteUserCascade, MIGRATION_HINT, missingColumn } from "@/lib/server/admin";
import { isoNow } from "@/lib/server/ids";
import type { Ctx } from "@/lib/server/route";

type P = Ctx<{ id: string }>;

async function target(userId: string): Promise<AppUser & { auth_user_id: string | null }> {
  const { data } = await db().from("app_users").select("*").eq("user_id", userId).maybeSingle();
  if (!data) throw fail(404, "Usuario no encontrado");
  return data as any;
}

export const GET = handler(async (req: Request, ctx: P) => {
  const me = await requireAdmin(req);
  const userId = (await ctx.params).id;
  const d = await target(userId);
  const { data: pets } = await db().from("pets").select("*").eq("user_id", userId).limit(200);
  const petOut = await Promise.all((pets ?? []).map(async (p) => ({
    id: p.id, name: p.name, species: p.species,
    photo_url: p.photo_file ? mediaPath(p.id, p.photo_file) : null,
    memory_count: (await db().from("memories").select("id", { count: "exact", head: true }).eq("pet_id", p.id)).count ?? 0,
  })));
  const [s, pt, v, plus, friends, lastSignIn] = await Promise.all([
    db().from("stories").select("id, share_slug, pet_name, status, created_at").eq("user_id", userId).neq("status", "draft").limit(300),
    db().from("portraits").select("id, share_slug, pet_name, status, created_at").eq("user_id", userId).limit(300),
    db().from("videos").select("id, share_slug, pet_name, status, created_at").eq("user_id", userId).limit(300),
    plusInfo(userId),
    db().from("connections").select("id", { count: "exact", head: true }).eq("status", "accepted").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .then((r) => (r.error ? null : r.count ?? 0)),
    d.auth_user_id
      ? createServiceClient().auth.admin.getUserById(d.auth_user_id).then((r) => r.data.user?.last_sign_in_at ?? null).catch(() => null)
      : Promise.resolve(null),
  ]);
  const creations = [
    ...(s.data ?? []).map((x) => ({ kind: "story", id: x.id, slug: x.share_slug, title: x.pet_name || "Historia", status: x.status, view_path: `/h/${x.share_slug}`, created_at: iso(x.created_at) })),
    ...(pt.data ?? []).map((x) => ({ kind: "portrait", id: x.id, slug: x.share_slug, title: x.pet_name || "Retrato", status: x.status, view_path: `/r/${x.share_slug}`, created_at: iso(x.created_at) })),
    ...(v.data ?? []).map((x) => ({ kind: "video", id: x.id, slug: x.share_slug, title: x.pet_name || "Video", status: x.status, view_path: `/v/${x.share_slug}`, created_at: iso(x.created_at) })),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return json({
    user_id: userId, email: d.email, name: d.name, picture: d.picture, created_at: iso(d.created_at),
    linked: Boolean(d.auth_user_id), last_sign_in_at: lastSignIn,
    is_admin: isAdmin(d), owner_admin: isOwnerAdmin(d.email), is_self: me.user_id === userId,
    suspended: Boolean(d.suspended_at), suspended_at: iso(d.suspended_at ?? null), admin_note: d.admin_note ?? "",
    is_plus: plus.active, plus_status: plus.current?.status ?? null, plus,
    friend_count: friends, pets: petOut, creations,
  });
});

/** Edit name, email, admin role, suspension and the private note. */
export const PATCH = handler(async (req: Request, ctx: P) => {
  const me = await requireAdmin(req);
  const userId = (await ctx.params).id;
  const d = await target(userId);
  const b = await readJson<{ name?: string | null; email?: string; is_admin?: boolean; suspended?: boolean; admin_note?: string | null }>(req);
  const self = me.user_id === userId;
  const patch: Record<string, unknown> = {};

  if (b.name !== undefined) patch.name = String(b.name ?? "").trim().slice(0, 80) || null;
  if (b.email !== undefined) {
    const email = String(b.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, "Correo no válido");
    if (email !== d.email.toLowerCase()) {
      if (isOwnerAdmin(d.email)) throw fail(400, "Este correo está en ADMIN_EMAILS (Vercel). Cámbialo allí primero.");
      const { data: taken } = await db().from("app_users").select("user_id").ilike("email", email).neq("user_id", userId).maybeSingle();
      if (taken) throw fail(409, "Otro usuario ya usa ese correo");
      patch.email = email;
    }
  }
  if (b.admin_note !== undefined) patch.admin_note = String(b.admin_note ?? "").trim().slice(0, 2000) || null;
  if (b.is_admin !== undefined) {
    if (!b.is_admin && isOwnerAdmin(d.email)) throw fail(400, "Este admin está fijo en ADMIN_EMAILS (Vercel). Quítalo de ahí.");
    if (!b.is_admin && self) throw fail(400, "No puedes quitarte tu propio acceso de admin");
    if (b.is_admin && d.suspended_at) throw fail(400, "Reactiva la cuenta antes de hacerla admin");
    patch.is_admin = Boolean(b.is_admin);
  }
  if (b.suspended !== undefined) {
    if (b.suspended && self) throw fail(400, "No puedes suspender tu propia cuenta");
    if (b.suspended && (isAdmin(d) && patch.is_admin !== false)) throw fail(400, "Quita primero el rol de admin");
    patch.suspended_at = b.suspended ? d.suspended_at ?? isoNow() : null;
  }
  if (!Object.keys(patch).length) throw fail(400, "Nada que cambiar");

  const { error } = await db().from("app_users").update(patch).eq("user_id", userId);
  if (error) {
    if (missingColumn(error)) throw fail(500, MIGRATION_HINT);
    if (error.code === "23505") throw fail(409, "Otro usuario ya usa ese correo");
    throw error;
  }
  const u = await target(userId);
  return json({
    user_id: userId, name: u.name, email: u.email, is_admin: isAdmin(u), owner_admin: isOwnerAdmin(u.email),
    suspended: Boolean(u.suspended_at), suspended_at: iso(u.suspended_at ?? null), admin_note: u.admin_note ?? "",
  });
});

/** Delete the account and everything in it (Mercado Pago billing is canceled first). */
export const DELETE = handler(async (req: Request, ctx: P) => {
  const me = await requireAdmin(req);
  const userId = (await ctx.params).id;
  const d = await target(userId);
  if (me.user_id === userId) throw fail(400, "No puedes eliminar tu propia cuenta desde aquí");
  if (isOwnerAdmin(d.email)) throw fail(400, "Este admin está fijo en ADMIN_EMAILS (Vercel). Quítalo de ahí primero.");
  await deleteUserCascade(userId);
  return json({ ok: true });
});
