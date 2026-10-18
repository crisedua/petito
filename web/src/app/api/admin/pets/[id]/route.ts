import { fail, handler, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { deletePetCascade } from "@/lib/server/admin";
import type { Ctx } from "@/lib/server/route";

export const DELETE = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  await requireAdmin(req);
  const petId = (await ctx.params).id;
  const { data } = await db().from("pets").select("id").eq("id", petId).maybeSingle();
  if (!data) throw fail(404, "Mascota no encontrada");
  await deletePetCascade(petId);
  return json({ ok: true });
});
