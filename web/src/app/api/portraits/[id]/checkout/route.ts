import { handler, json } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { getPortrait } from "@/lib/server/portraits";
import { isPlus } from "@/lib/server/plus";
import { isoNow } from "@/lib/server/ids";
import { env } from "@/lib/server/env";
import type { Ctx } from "@/lib/server/route";

/** Subscription-only: the clean HD portrait is unlocked solely by Petito Plus. */
export const POST = handler(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const p = await getPortrait((await ctx.params).id);
  if (p.status === "paid") return json({ mode: env.paymentMode, already_paid: true });
  if (p.user_id && (await isPlus(p.user_id))) {
    await db().from("portraits").update({ status: "paid", paid_at: isoNow() }).eq("id", p.id).neq("status", "paid");
    return json({ mode: "plus", already_paid: true });
  }
  return json({ mode: "plus_required" });
});
