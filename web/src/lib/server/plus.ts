import { db } from "./db";
import { isoNow, newId } from "./ids";
import { env } from "./env";

export const PLUS_PLANS = {
  monthly: { reason: "Petito Plus mensual", amount: env.plusMonthlyClp, frequency: 1, days: 31 },
  annual: { reason: "Petito Plus anual", amount: env.plusAnnualClp, frequency: 12, days: 366 },
} as const;
export type PlanKey = keyof typeof PLUS_PLANS;

/** Port of server.py is_plus(): any active row whose plus_until is null or in the future. */
export async function isPlus(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await db()
    .from("subscriptions")
    .select("mp_id, plus_until")
    .eq("user_id", userId)
    .eq("membership_active", true)
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  if (data.plus_until && new Date(data.plus_until).toISOString() < isoNow()) {
    await db().from("subscriptions").update({ membership_active: false }).eq("user_id", userId);
    return false;
  }
  return true;
}

/** Upsert a synthetic (non-Mercado-Pago) subscription: dev-, admin- or courtesy-. */
export async function grantPlus(userId: string, plan: PlanKey, prefix: "dev" | "admin" | "courtesy", days?: number) {
  const until = new Date(Date.now() + (days ?? PLUS_PLANS[plan].days) * 86400_000).toISOString();
  await db().from("subscriptions").delete().eq("user_id", userId).like("mp_id", `${prefix}-%`);
  await db().from("subscriptions").insert({
    mp_id: `${prefix}-${newId()}`,
    user_id: userId,
    plan,
    external_reference: `${userId}:${plan}:${newId()}`,
    status: "authorized",
    membership_active: true,
    plus_until: until,
    courtesy: prefix === "courtesy",
    created_at: isoNow(),
  });
  return until;
}

/** Port of `_activate_plus`: update a local subscription from a real Mercado Pago preapproval status. */
export async function activatePlus(preapprovalId: string, status: string | undefined, nextPaymentDate?: string | null) {
  const { data: sub } = await db().from("subscriptions").select("plan").eq("mp_id", preapprovalId).maybeSingle();
  if (!sub) return;
  const active = status === "authorized";
  const days = (PLUS_PLANS[sub.plan as PlanKey] ?? PLUS_PLANS.monthly).days;
  const upd: Record<string, unknown> = { status, membership_active: active, next_payment_date: nextPaymentDate ?? null };
  if (active) upd.plus_until = new Date(Date.now() + days * 86400_000).toISOString();
  await db().from("subscriptions").update(upd).eq("mp_id", preapprovalId);
}

export async function latestSubscription(userId: string) {
  const { data } = await db().from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}
