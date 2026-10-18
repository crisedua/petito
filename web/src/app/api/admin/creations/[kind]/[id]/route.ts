import { fail, handler, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import type { Ctx } from "@/lib/server/route";

const TABLE: Record<string, string> = { story: "stories", portrait: "portraits", video: "videos" };

export const DELETE = handler(async (req: Request, ctx: Ctx<{ kind: string; id: string }>) => {
  await requireAdmin(req);
  const { kind, id } = await ctx.params;
  const table = TABLE[kind];
  if (!table) throw fail(400, "Tipo inválido");
  const { data } = await db().from(table).select("id").eq("id", id).maybeSingle();
  if (!data) throw fail(404, "No encontrado");
  await db().from(table).delete().eq("id", id);
  return json({ ok: true });
});
