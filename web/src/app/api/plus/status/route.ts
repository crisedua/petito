import { handler, json } from "@/lib/server/http";
import { isAdmin, requireUser } from "@/lib/server/auth";
import { PREMIUM_VIDEO_MODES, TALK_VIDEO_MODES, latestSubscription, monthlyVideoCount, planTier, plusTier, refreshFromMercadoPago } from "@/lib/server/plus";
import { db } from "@/lib/server/db";
import { iso } from "@/lib/server/db";
import { env } from "@/lib/server/env";

export const GET = handler(async (req: Request) => {
  const user = await requireUser(req);
  await refreshFromMercadoPago(user.user_id);
  const sub = await latestSubscription(user.user_id);
  const tier = await plusTier(user.user_id);
  // The subscription that gives the current tier (an upgrade may sit next to the plan it replaced).
  const { data: activeRows } = await db().from("subscriptions").select("*").eq("user_id", user.user_id).eq("membership_active", true).order("created_at", { ascending: false });
  const cur = (activeRows ?? []).find((r) => planTier(r.plan) === tier) ?? (activeRows ?? [])[0] ?? sub;
  const admin = isAdmin(user);
  return json({
    active: tier !== "none",
    tier,
    plan: cur?.plan ?? null,
    status: cur?.status ?? null,
    plus_until: cur?.plus_until ? iso(cur.plus_until) : null,
    mp_id: cur?.mp_id ?? null,
    monthly_clp: env.plusMonthlyClp,
    annual_clp: env.plusAnnualClp,
    pro_monthly_clp: env.plusProMonthlyClp,
    pro_annual_clp: env.plusProAnnualClp,
    free_mode: env.freeMode,
    is_admin: admin,
    // Plus that comes from being an administrator, not from a subscription.
    via_admin: admin && !(activeRows ?? []).length,
    allowance: {
      premium_limit: env.plusProMonthlyVideos,
      premium_used: tier === "pro" ? await monthlyVideoCount(user.user_id, PREMIUM_VIDEO_MODES) : 0,
      talk_limit: env.plusMonthlyTalks,
      talk_used: tier !== "none" && env.plusMonthlyTalks > 0 ? await monthlyVideoCount(user.user_id, TALK_VIDEO_MODES) : 0,
      unlimited: admin,
    },
  });
});
