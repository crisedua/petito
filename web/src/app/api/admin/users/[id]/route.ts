import { fail, handler, json } from "@/lib/server/http";
import { isAdmin, requireAdmin } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";
import { isPlus, latestSubscription } from "@/lib/server/plus";
import { mediaPath } from "@/lib/server/storage";
import { deleteUserCascade } from "@/lib/server/admin";
import type { Ctx } from "@/lib/server/route";

type P = Ctx<{ id: string }>;

export const GET = handler(async (req: Request, ctx: P) => {
  await requireAdmin(req);
  const userId = (await ctx.params).id;
  const { data: d } = await db().from("app_users").select("*").eq("user_id", userId).maybeSingle();
  if (!d) throw fail(404, "Usuario no encontrado");
  const { data: pets } = await db().from("pets").select("*").eq("user_id", userId).limit(200);
  const petOut = await Promise.all((pets ?? []).map(async (p) => ({
    id: p.id, name: p.name, species: p.species,
    photo_url: p.photo_file ? mediaPath(p.id, p.photo_file) : null,
    memory_count: (await db().from("memories").select("id", { count: "exact", head: true }).eq("pet_id", p.id)).count ?? 0,
  })));
  const [s, pt, v] = await Promise.all([
    db().from("stories").select("id, share_slug, pet_name, status, created_at").eq("user_id", userId).neq("status", "draft").limit(300),
    db().from("portraits").select("id, share_slug, pet_name, status, created_at").eq("user_id", userId).limit(300),
    db().from("videos").select("id, share_slug, pet_name, status, created_at").eq("user_id", userId).limit(300),
  ]);
  const creations = [
    ...(s.data ?? []).map((x) => ({ kind: "story", id: x.id, slug: x.share_slug, title: x.pet_name || "Historia", status: x.status, view_path: `/h/${x.share_slug}`, created_at: iso(x.created_at) })),
    ...(pt.data ?? []).map((x) => ({ kind: "portrait", id: x.id, slug: x.share_slug, title: x.pet_name || "Retrato", status: x.status, view_path: `/r/${x.share_slug}`, created_at: iso(x.created_at) })),
    ...(v.data ?? []).map((x) => ({ kind: "video", id: x.id, slug: x.share_slug, title: x.pet_name || "Video", status: x.status, view_path: `/v/${x.share_slug}`, created_at: iso(x.created_at) })),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const sub = await latestSubscription(userId);
  return json({
    user_id: userId, email: d.email, name: d.name, picture: d.picture, is_admin: isAdmin(d.email),
    is_plus: await isPlus(userId), plus_status: sub?.status ?? null, pets: petOut, creations,
  });
});

export const DELETE = handler(async (req: Request, ctx: P) => {
  await requireAdmin(req);
  const userId = (await ctx.params).id;
  const { data } = await db().from("app_users").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) throw fail(404, "Usuario no encontrado");
  await deleteUserCascade(userId);
  return json({ ok: true });
});
