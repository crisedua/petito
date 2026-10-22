import { handler, json, readJson } from "@/lib/server/http";
import { trackLater } from "@/lib/server/events";
import { db } from "@/lib/server/db";
import { getPortrait } from "@/lib/server/portraits";
import { isPlus } from "@/lib/server/plus";
import { isoNow } from "@/lib/server/ids";
import { env } from "@/lib/server/env";
import type { Ctx } from "@/lib/server/route";

/** Subscription-only: the clean HD portrait is unlocked solely by Petipo Plus. */
export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const p = await getPortrait((await ctx.params).id);
  if (p.status === "paid") return json({ mode: env.paymentMode, already_paid: true });
  if (p.user_id && (await isPlus(p.user_id))) {
    await db().from("portraits").update({ status: "paid", paid_at: isoNow() }).eq("id", p.id).neq("status", "paid");
    return json({ mode: "plus", already_paid: true });
  }
  // Free user tapped "unlock": they hit the Plus paywall from this feature (silent auto-checks don't count).
  if (!(await readJson<{ auto?: boolean }>(req)).auto) trackLater("paywall", { req, feature: p.category === "memorial" ? "memorial" : "portrait", userId: p.user_id });
  return json({ mode: "plus_required" });
});
