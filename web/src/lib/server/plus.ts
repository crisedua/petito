import { db } from "./db";
import { isoNow, newId } from "./ids";
import { env } from "./env";
import { cancelPreapproval, mpEnabled } from "./mercadopago";

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

/**
 * Upsert a synthetic (non-Mercado-Pago) subscription: dev-, admin- or courtesy-.
 * `length` overrides the plan length: a number of days, an exact ISO end `{ until }`, or `null` for no end date.
 */
export async function grantPlus(userId: string, plan: PlanKey, prefix: "dev" | "admin" | "courtesy", length?: number | null | { until: string | null }) {
  const until = length === null ? null
    : typeof length === "object" ? length.until
    : new Date(Date.now() + (length ?? PLUS_PLANS[plan].days) * 86400_000).toISOString();
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

const SYNTHETIC = /^(dev|admin|courtesy)-/;
export const plusSource = (mpId: string) => (mpId.startsWith("courtesy-") ? "courtesy" : mpId.startsWith("admin-") ? "admin" : mpId.startsWith("dev-") ? "dev" : "mercadopago");

/** What an admin needs to see about someone's Plus: the active row (if any) and the full history. */
export async function plusInfo(userId: string) {
  const active = await isPlus(userId);
  const { data } = await db().from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  const rows = (data ?? []).map((s) => ({
    id: s.mp_id, source: plusSource(s.mp_id), plan: s.plan, status: s.status, active: Boolean(s.membership_active),
    until: s.plus_until ? new Date(s.plus_until).toISOString() : null, next_payment_date: s.next_payment_date ?? null,
    payer_email: s.payer_email ?? null, created_at: s.created_at ? new Date(s.created_at).toISOString() : null,
  }));
  const current = active ? rows.find((r) => r.active) ?? null : null;
  return { active, current, history: rows };
}

/**
 * Take Plus away: removes courtesy/admin/dev grants and cancels live Mercado Pago subscriptions there
 * too, so the person stops being charged. Returns the Mercado Pago ids it couldn't cancel.
 */
export async function revokePlus(userId: string): Promise<{ canceled: string[]; failed: string[] }> {
  const { data } = await db().from("subscriptions").select("mp_id, status, membership_active").eq("user_id", userId);
  const canceled: string[] = [];
  const failed: string[] = [];
  for (const s of data ?? []) {
    if (SYNTHETIC.test(s.mp_id)) {
      await db().from("subscriptions").delete().eq("mp_id", s.mp_id);
      continue;
    }
    const live = s.membership_active || ["authorized", "pending", "paused"].includes(String(s.status));
    if (!live) continue;
    if (mpEnabled()) {
      try {
        await cancelPreapproval(s.mp_id);
        canceled.push(s.mp_id);
      } catch (e) {
        console.error("revokePlus: Mercado Pago cancel failed", s.mp_id, e);
        failed.push(s.mp_id);
      }
    }
    await db().from("subscriptions").update({ status: "canceled", membership_active: false }).eq("mp_id", s.mp_id);
  }
  return { canceled, failed };
}
