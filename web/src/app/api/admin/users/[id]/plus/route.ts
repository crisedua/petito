import { fail, handler, json, readJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { grantPlus, plusInfo, revokePlus } from "@/lib/server/plus";
import { plusUntil, type PlusDuration } from "@/lib/server/adminPlus";
import type { Ctx } from "@/lib/server/route";

/**
 * Give or take away Plus.
 * - `{active: true, duration: "month" | "year" | "lifetime" | "until", until?: "YYYY-MM-DD"}` (default lifetime)
 * - `{active: false}` removes courtesy grants and cancels live Mercado Pago subscriptions.
 */
export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  await requireAdmin(req);
  const userId = (await ctx.params).id;
  const { data } = await db().from("app_users").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) throw fail(404, "Usuario no encontrado");
  const b = await readJson<{ active?: boolean; duration?: PlusDuration; until?: string }>(req);
  let mp: { canceled: string[]; failed: string[] } | null = null;
  if (b.active) await grantPlus(userId, b.duration === "year" ? "annual" : "monthly", "courtesy", { until: plusUntil(b.duration, b.until) });
  else mp = await revokePlus(userId);
  const info = await plusInfo(userId);
  return json({ is_plus: info.active, plus: info, mp_canceled: mp?.canceled ?? [], mp_failed: mp?.failed ?? [] });
});
