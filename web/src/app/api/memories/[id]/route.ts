import { fail, handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getMemory } from "@/lib/server/domain";
import { isoNow } from "@/lib/server/ids";
import { memoryPublic } from "@/lib/server/serializers";
import type { Ctx } from "@/lib/server/route";
import { EMOTION_LABELS } from "@/lib/catalogs";

type P = Ctx<{ id: string }>;

export const GET = handler(async (req: Request, ctx: P) => {
  const user = await requireUser(req);
  return json(memoryPublic(await getMemory((await ctx.params).id, user.user_id)));
});

export const PUT = handler(async (req: Request, ctx: P) => {
  const user = await requireUser(req);
  const m = await getMemory((await ctx.params).id, user.user_id);
  const b = await readJson<Record<string, any>>(req);
  const upd: Record<string, unknown> = {};
  if (typeof b.title === "string") {
    const t = b.title.trim().slice(0, 80);
    if (!t) throw fail(400, "El título no puede quedar vacío");
    upd.title = t;
  }
  if (typeof b.happened_on === "string") upd.happened_on = b.happened_on.trim().slice(0, 40) || null;
  if (b.date_unknown !== undefined && b.date_unknown !== null) upd.date_unknown = Boolean(b.date_unknown);
  if (typeof b.feeling_text === "string") upd.feeling_text = b.feeling_text.trim().slice(0, 1500) || null;
  if (Array.isArray(b.emotions)) upd.emotions = b.emotions.filter((e: string) => e in EMOTION_LABELS).slice(0, 6);
  upd.updated_at = isoNow();
  await db().from("memories").update(upd).eq("id", m.id);
  return json(memoryPublic(await getMemory(m.id, user.user_id)));
});

export const DELETE = handler(async (req: Request, ctx: P) => {
  const user = await requireUser(req);
  const m = await getMemory((await ctx.params).id, user.user_id);
  await db().from("memories").delete().eq("id", m.id);
  return json({ ok: true });
});
