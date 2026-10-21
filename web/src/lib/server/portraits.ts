import { db } from "./db";
import { fail } from "./http";
import { mediaPath } from "./storage";
import { ALL_PORTRAIT_STYLES, BRAND_URL, PORTRAIT_STYLES } from "@/lib/catalogs";

export type PortraitRow = Record<string, any> & { id: string; share_slug: string; status: string };

export async function getPortrait(id: string): Promise<PortraitRow> {
  const { data } = await db().from("portraits").select("*").eq("id", id).maybeSingle();
  if (!data) throw fail(404, "Retrato no encontrado");
  return data as PortraitRow;
}

export async function getPortraitBySlug(slug: string): Promise<PortraitRow> {
  const { data } = await db().from("portraits").select("*").eq("share_slug", slug).maybeSingle();
  if (!data) throw fail(404, "Retrato no encontrado");
  return data as PortraitRow;
}

export const portraitPublic = (p: PortraitRow) => {
  const paid = p.status === "paid";
  return {
    id: p.id, slug: p.share_slug, pet_name: p.pet_name, style: p.style,
    style_label: ALL_PORTRAIT_STYLES[p.style]?.label ?? p.style, category: p.category,
    status: p.status, progress_step: p.progress_step, progress_pct: p.progress_pct,
    price_clp: p.price_clp, paid, error: p.error,
    gift_enabled: p.gift_enabled, gift_to: p.gift_to, gift_from: p.gift_from, gift_message: p.gift_message,
    brand_url: BRAND_URL, memorial_dates: p.memorial_dates, memorial_caption: p.memorial_caption,
    mode: PORTRAIT_STYLES[p.style]?.mode ?? "paint",
    photo_url: mediaPath(p.id, "orig_0.jpg"), // the uploaded photo (saveJobPhoto stores it as orig_0.jpg)
    preview_url: p.preview_file ? mediaPath(p.id, p.preview_file) : null,
    clean_url: paid && p.clean_file ? mediaPath(p.id, p.clean_file) : null,
  };
};
