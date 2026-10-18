import { fail, handler, json } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { getStory } from "@/lib/server/stories";
import { readUploads } from "@/lib/server/uploads";
import { saveOriginal } from "@/lib/server/images";
import { isoNow, newId } from "@/lib/server/ids";
import type { Ctx } from "@/lib/server/route";

export const maxDuration = 120;

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const s = await getStory((await ctx.params).id);
  const raws = await readUploads(req, s.id, 20);
  await db().from("story_photos").delete().eq("story_id", s.id);
  const saved: Array<{ id: string; story_id: string; idx: number; file: string; created_at: string }> = [];
  for (let i = 0; i < raws.length; i++) {
    try {
      const file = await saveOriginal(s.id, i, raws[i]);
      saved.push({ id: newId(), story_id: s.id, idx: i, file, created_at: isoNow() });
    } catch (e) {
      console.warn("story photo skipped", e);
    }
  }
  if (!saved.length) throw fail(400, "No se pudieron procesar las fotos");
  await db().from("story_photos").insert(saved);
  await db().from("stories").update({ photo_count: saved.length }).eq("id", s.id);
  return json({ uploaded: saved.length });
});
