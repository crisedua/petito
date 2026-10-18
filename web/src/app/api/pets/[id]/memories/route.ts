import { clip, fail, handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getPet } from "@/lib/server/domain";
import { isoNow, newId } from "@/lib/server/ids";
import { memoryPublic, type MemoryRow } from "@/lib/server/serializers";
import type { Ctx } from "@/lib/server/route";
import { EMOTION_LABELS } from "@/lib/catalogs";

type P = Ctx<{ id: string }>;

export const GET = handler(async (req: Request, ctx: P) => {
  const user = await requireUser(req);
  const pet = await getPet((await ctx.params).id, user.user_id);
  const { data } = await db().from("memories").select("*").eq("pet_id", pet.id).eq("user_id", user.user_id).order("created_at", { ascending: false }).limit(500);
  return json((data ?? []).map((m) => memoryPublic(m as MemoryRow)));
});

export const POST = handler(async (req: Request, ctx: P) => {
  const user = await requireUser(req);
  const pet = await getPet((await ctx.params).id, user.user_id);
  const b = await readJson<{ title?: string; happened_on?: string; date_unknown?: boolean; feeling_text?: string; emotions?: string[] }>(req);
  const title = (b.title ?? "").trim().slice(0, 80);
  if (!title) throw fail(400, "Ponle un título a este recuerdo");
  const now = isoNow();
  const m: MemoryRow = {
    id: newId(), pet_id: pet.id, user_id: user.user_id, title,
    happened_on: clip(b.happened_on, 40), date_unknown: Boolean(b.date_unknown),
    feeling_text: clip(b.feeling_text, 1500),
    emotions: (b.emotions ?? []).filter((e) => e in EMOTION_LABELS).slice(0, 6),
    photo_file: null, ai_reflection: null, shared: false, created_at: now, updated_at: now,
  };
  const { error } = await db().from("memories").insert(m);
  if (error) throw error;
  return json(memoryPublic(m));
});
