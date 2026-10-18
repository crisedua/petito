import { fail, handler, json } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { mediaPath } from "@/lib/server/storage";
import { emotionLabels } from "@/lib/server/serializers";
import type { Ctx } from "@/lib/server/route";

export const GET = handler(async (_req: Request, ctx: Ctx<{ slug: string }>) => {
  const { slug } = await ctx.params;
  const { data: pet } = await db().from("pets").select("*").eq("share_slug", slug).eq("public_enabled", true).maybeSingle();
  if (!pet) throw fail(404, "Álbum no encontrado o privado");
  const { data: mems } = await db().from("memories").select("*").eq("pet_id", pet.id).eq("shared", true).order("created_at", { ascending: false }).limit(200);
  return json({
    name: pet.name, species: pet.species, intro_text: pet.intro_text,
    photo_url: pet.photo_file ? mediaPath(pet.id, pet.photo_file) : null,
    memories: (mems ?? []).map((m) => ({
      title: m.title,
      happened_on: m.date_unknown ? null : m.happened_on,
      date_unknown: m.date_unknown ?? false,
      feeling_text: m.feeling_text,
      emotion_labels: emotionLabels(m.emotions),
      photo_url: m.photo_file ? mediaPath(m.id, m.photo_file) : null,
    })),
  });
});
