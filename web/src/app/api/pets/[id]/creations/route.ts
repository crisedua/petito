import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";
import { getPet } from "@/lib/server/domain";
import { mediaPath } from "@/lib/server/storage";
import type { Ctx } from "@/lib/server/route";
import { ALL_PORTRAIT_STYLES } from "@/lib/catalogs";

export const GET = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser(req);
  const pet = await getPet((await ctx.params).id, user.user_id);
  const [stories, portraits, videos] = await Promise.all([
    db().from("stories").select("id, share_slug, title, created_at").eq("pet_id", pet.id).eq("user_id", user.user_id).neq("status", "draft").order("created_at", { ascending: false }).limit(100),
    db().from("portraits").select("id, share_slug, style, category, created_at").eq("pet_id", pet.id).eq("user_id", user.user_id).in("status", ["preview_ready", "paid"]).order("created_at", { ascending: false }).limit(100),
    db().from("videos").select("id, share_slug, created_at").eq("pet_id", pet.id).eq("user_id", user.user_id).in("status", ["preview_ready", "paid"]).order("created_at", { ascending: false }).limit(100),
  ]);
  const out = [
    ...(stories.data ?? []).map((d) => ({ kind: "historia", id: d.id, slug: d.share_slug, title: d.title || "Historia", thumb_url: mediaPath(d.id, "slide_0.jpg"), view_path: `/h/${d.share_slug}`, created_at: iso(d.created_at) })),
    ...(portraits.data ?? []).map((d) => ({ kind: d.category === "memorial" ? "recuerdo" : "retrato", id: d.id, slug: d.share_slug, title: ALL_PORTRAIT_STYLES[d.style]?.label ?? d.style, thumb_url: mediaPath(d.id, "preview.jpg"), view_path: `/r/${d.share_slug}`, created_at: iso(d.created_at) })),
    ...(videos.data ?? []).map((d) => ({ kind: "video", id: d.id, slug: d.share_slug, title: "Video que habla", thumb_url: mediaPath(d.id, "source.jpg"), view_path: `/v/${d.share_slug}`, created_at: iso(d.created_at) })),
  ];
  out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return json(out);
});
