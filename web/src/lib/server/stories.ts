import { db } from "./db";
import { fail } from "./http";
import { env } from "./env";
import * as storage from "./storage";
import { mediaPath } from "./storage";
import { makeLocked } from "@/lib/render/watermarks";
import { BRAND_URL, THEMES } from "@/lib/catalogs";
import { newId, isoNow } from "./ids";

export type StoryRow = Record<string, any> & { id: string; share_slug: string; status: string };
export type SlideRow = { id: string; story_id: string; ord: number; caption: string; kind: string; image_file: string; audio_file: string; locked_file: string; locked: boolean };

export async function getStory(id: string): Promise<StoryRow> {
  const { data } = await db().from("stories").select("*").eq("id", id).maybeSingle();
  if (!data) throw fail(404, "Historia no encontrada");
  return data as StoryRow;
}

export async function getStoryBySlug(slug: string): Promise<StoryRow> {
  const { data } = await db().from("stories").select("*").eq("share_slug", slug).maybeSingle();
  if (!data) throw fail(404, "Historia no encontrada");
  return data as StoryRow;
}

export async function storyPublic(story: StoryRow) {
  const { data } = await db().from("slides").select("*").eq("story_id", story.id).order("ord", { ascending: true });
  const paid = story.status === "paid" || env.freeMode;
  const slides = ((data ?? []) as SlideRow[]).map((s) => {
    const locked = s.locked && !paid;
    const fname = locked ? s.locked_file : s.image_file;
    return {
      order: s.ord, kind: s.kind, caption: s.caption, locked,
      image_url: fname ? mediaPath(story.id, fname) : null,
      audio_url: s.audio_file && !locked ? mediaPath(story.id, s.audio_file) : null,
    };
  });
  const theme = THEMES[story.theme];
  return {
    id: story.id, slug: story.share_slug, pet_name: story.pet_name, species: story.species, traits: story.traits,
    theme: story.theme, theme_label: theme?.label ?? story.theme, music: theme?.music ?? "alegre",
    status: story.status, progress_step: story.progress_step, progress_pct: story.progress_pct,
    bonus_pending: story.bonus_pending, narration_pending: story.narration_pending, voice_id: story.voice_id,
    title: story.title, price_clp: story.price_clp, paid, email: story.email, error: story.error,
    slides, brand_url: BRAND_URL, retention_days: env.retentionDays,
  };
}

/** Port of `_add_slide`: store slide_{ord}.jpg (+ blurred locked variant when paywalled) and upsert the row. */
export async function addSlide(storyId: string, kind: string, jpeg: Buffer, ord: number, caption = "", lockable = true) {
  const file = `slide_${ord}.jpg`;
  await storage.put(storyId, file, jpeg, "image/jpeg");
  const locked = !env.freeMode && lockable && ord >= 2;
  let lockedFile = "";
  if (locked) {
    lockedFile = `slide_${ord}_locked.jpg`;
    await storage.put(storyId, lockedFile, await makeLocked(jpeg), "image/jpeg");
  }
  await db().from("slides").upsert(
    { id: newId(), story_id: storyId, ord, kind, caption, image_file: file, locked_file: lockedFile, locked, audio_file: "", created_at: isoNow() },
    { onConflict: "story_id,ord" },
  );
}
