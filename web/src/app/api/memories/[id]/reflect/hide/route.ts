import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getMemory } from "@/lib/server/domain";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser(req);
  const m = await getMemory((await ctx.params).id, user.user_id);
  await db().from("memories").update({ ai_reflection: null }).eq("id", m.id);
  return json({ ok: true });
});
