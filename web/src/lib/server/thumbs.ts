/**
 * Which picture to show for a portrait or talking video: the clean one once it's unlocked (owner
 * has Plus, or the item was paid), otherwise the watermarked preview.
 */
import { mediaPath } from "./storage";
import { isPlus } from "./plus";

type P = { id: string; status?: string | null; clean_file?: string | null };

export function portraitThumb(p: P, ownerPlus: boolean) {
  const unlocked = ownerPlus || p.status === "paid";
  return mediaPath(p.id, unlocked && p.clean_file ? p.clean_file : "preview.jpg");
}

/** HD frame once the clean video exists; before that the original photo (no watermark) when unlocked. */
export function videoThumb(v: P, ownerPlus: boolean) {
  const unlocked = ownerPlus || v.status === "paid";
  if (!unlocked) return mediaPath(v.id, "source.jpg");
  return mediaPath(v.id, v.clean_file ? "source_hd.jpg" : "orig_0.jpg");
}

/** isPlus for several owners at once (memoized per call). */
export async function plusByOwner(userIds: (string | null | undefined)[]) {
  const ids = [...new Set(userIds.filter(Boolean))] as string[];
  const entries = await Promise.all(ids.map(async (id) => [id, await isPlus(id)] as const));
  return new Map(entries);
}
