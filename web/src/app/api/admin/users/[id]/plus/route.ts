import { fail, handler, json, readJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { grantPlus, isPlus } from "@/lib/server/plus";
import type { Ctx } from "@/lib/server/route";

/** Courtesy Plus (10 years) on or off for any user. */
export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  await requireAdmin(req);
  const userId = (await ctx.params).id;
  const { data } = await db().from("app_users").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) throw fail(404, "Usuario no encontrado");
  const { active } = await readJson<{ active?: boolean }>(req);
  if (active) await grantPlus(userId, "monthly", "courtesy", 3650);
  else await db().from("subscriptions").delete().eq("user_id", userId);
  return json({ is_plus: await isPlus(userId) });
});
