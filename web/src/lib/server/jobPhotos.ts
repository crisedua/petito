import { fail } from "./http";
import { saveOriginal } from "./images";
import { readUploads } from "./uploads";
import { db } from "./db";
import { newId, isoNow } from "./ids";

/** Single-photo upload into a job (talk video or portrait): orig_0.jpg + one photo row. */
export async function saveJobPhoto(req: Request, table: "talk_photos" | "portrait_photos", fk: "video_id" | "portrait_id", ownerId: string) {
  const [raw] = await readUploads(req, ownerId, 1);
  if (!raw) throw fail(400, "Sube una foto");
  let name: string;
  try {
    name = await saveOriginal(ownerId, 0, raw);
  } catch (e) {
    console.error("job photo failed", e);
    throw fail(400, "No pudimos leer esta foto. Prueba con otra (JPG, PNG o foto de iPhone).");
  }
  await db().from(table).delete().eq(fk, ownerId);
  await db().from(table).insert({ id: newId(), [fk]: ownerId, file: name, created_at: isoNow() });
  return name;
}

export const retentionIso = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();
