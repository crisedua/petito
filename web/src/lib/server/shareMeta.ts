/**
 * Link previews (WhatsApp, Instagram, Facebook, X, iMessage) for shared creations: the pet's name
 * and the creation's own image instead of the generic Petipop card. Anything missing or private falls
 * back to the site-wide preview.
 */
import type { Metadata } from "next";
import { db } from "./db";
import { mediaPath } from "./storage";
import * as storage from "./storage";
import { isPlus } from "./plus";
import { portraitThumb, videoThumb } from "./thumbs";
import { ALL_PORTRAIT_STYLES } from "@/lib/catalogs";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

const READY = ["preview_ready", "paid"];

function meta(path: string, title: string, description: string, image?: { url: string; width?: number; height?: number } | null): Metadata {
  const images = [image ?? OG_IMAGE];
  return {
    title, description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "Petipop", locale: "es_CL", url: path, title, description, images },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
  };
}
const fallback = (path: string) => meta(path, SITE_TITLE, SITE_DESCRIPTION);
const quote = (s?: string | null, n = 120) => (s ? `“${s.length > n ? s.slice(0, n - 1) + "…" : s}”` : "");

export async function videoMeta(slug: string): Promise<Metadata> {
  const path = `/v/${slug}`;
  try {
    const { data: v } = await db().from("videos").select("id, user_id, pet_name, line, status, clean_file, to_name, mode").eq("share_slug", slug).maybeSingle();
    if (!v || !READY.includes(v.status)) return fallback(path);
    const name = v.pet_name || "Esta mascota";
    const song = v.mode === "song", motion = v.mode === "motion";
    return meta(path,
      motion ? `${name} en acción 🎬` : song ? (v.to_name ? `${name} le canta a ${v.to_name} 🎤` : `${name} te canta 🎤`) : v.to_name ? `${name} tiene un mensaje para ${v.to_name} 🐾` : `${name} tiene algo que decirte 🐾`,
      motion ? `Mira a ${name} ${String(v.line || "").toLowerCase()}. Hecho con su foto real en Petipop.` : song ? `Una canción original cantada por ${name}. Haz que tu mascota cante en Petipop.` : `${quote(v.line)} Mira el video y haz que tu mascota hable en Petipop.`.trim(),
      { url: videoThumb(v, await isPlus(v.user_id)) });
  } catch { return fallback(path); }
}

export async function portraitMeta(slug: string): Promise<Metadata> {
  const path = `/r/${slug}`;
  try {
    const { data: p } = await db().from("portraits").select("id, user_id, pet_name, style, category, status, preview_file, clean_file").eq("share_slug", slug).maybeSingle();
    if (!p || !READY.includes(p.status) || !p.preview_file) return fallback(path);
    const name = p.pet_name || "Mi mascota";
    const style = ALL_PORTRAIT_STYLES[p.style]?.label ?? "retrato";
    // The before-and-after reads best as a link preview; older portraits only have the result.
    const plus = await isPlus(p.user_id);
    const compareName = plus || p.status === "paid" ? `compare_${p.clean_file}` : "compare.jpg";
    const img = p.category !== "memorial" && p.clean_file && (await storage.exists(p.id, compareName))
      ? { url: mediaPath(p.id, compareName), width: 1200, height: 860 }
      : { url: portraitThumb(p, plus) };
    return p.category === "memorial"
      ? meta(path, `Un homenaje a ${name} 🕊️`, "Un recuerdo lleno de cariño, hecho en Petipop.", img)
      : meta(path, `${name}, en versión ${style.toLowerCase()} 👑`, "Mira su retrato y crea el de tu mascota en Petipop.", img);
  } catch { return fallback(path); }
}

export async function storyMeta(slug: string): Promise<Metadata> {
  const path = `/h/${slug}`;
  try {
    const { data: s } = await db().from("stories").select("id, pet_name, title, status").eq("share_slug", slug).maybeSingle();
    if (!s || !READY.includes(s.status)) return fallback(path);
    const name = s.pet_name || "mi mascota";
    return meta(path, s.title ? `${s.title} 🐾` : `La historia de ${name} 🐾`,
      `Una historia ilustrada de ${name}. Crea la de tu mascota en Petipop.`, { url: mediaPath(s.id, "slide_0.jpg"), width: 1080, height: 1920 });
  } catch { return fallback(path); }
}

export async function albumMeta(slug: string): Promise<Metadata> {
  const path = `/u/${slug}`;
  try {
    const { data: pet } = await db().from("pets").select("id, name, intro_text, photo_file").eq("share_slug", slug).eq("public_enabled", true).maybeSingle();
    if (!pet) return fallback(path);
    return meta(path, `El álbum de ${pet.name} 🐾`, pet.intro_text || `Recuerdos de ${pet.name}, guardados en Petipop.`,
      pet.photo_file ? { url: mediaPath(pet.id, pet.photo_file) } : null);
  } catch { return fallback(path); }
}

export async function inviteMeta(code: string): Promise<Metadata> {
  const path = `/amigos/conectar/${code}`;
  try {
    if (!/^[a-f0-9]{8,32}$/.test(code)) return fallback(path);
    const { data: u } = await db().from("app_users").select("user_id, name").eq("friend_code", code).maybeSingle();
    if (!u) return fallback(path);
    const { data: pets } = await db().from("pets").select("id, name, photo_file").eq("user_id", u.user_id).order("created_at", { ascending: true }).limit(3);
    const first = (u.name ?? "").trim().split(/\s+/)[0] || "Un amigo";
    const names = (pets ?? []).map((p) => p.name);
    const withPet = pets?.find((p) => p.photo_file);
    return meta(path, `${first} te invita a Petipop 🐾`,
      names.length ? `Conecta para ver las historias de ${names.join(" y ")} y compartir las de tu mascota.` : "Conecta para compartir las historias de sus mascotas.",
      withPet ? { url: mediaPath(withPet.id, withPet.photo_file!) } : null);
  } catch { return fallback(path); }
}
