import { db } from "./db";
import { isoNow, newId } from "./ids";
import { env } from "./env";
import { cancelPreapproval, getPreapproval, mpEnabled } from "./mercadopago";
import { lastCheckoutFeature, track } from "./events";

export const PLUS_PLANS = {
  monthly: { tier: "plus", reason: "Petito Plus mensual", amount: env.plusMonthlyClp, frequency: 1, days: 31 },
  annual: { tier: "plus", reason: "Petito Plus anual", amount: env.plusAnnualClp, frequency: 12, days: 366 },
  pro_monthly: { tier: "pro", reason: "Petito Plus+ mensual", amount: env.plusProMonthlyClp, frequency: 1, days: 31 },
  pro_annual: { tier: "pro", reason: "Petito Plus+ anual", amount: env.plusProAnnualClp, frequency: 12, days: 366 },
} as const;
export type PlanKey = keyof typeof PLUS_PLANS;
/** "plus" = Plus (talking videos, portraits, stories); "pro" = Plus+ (also songs and motion videos). */
export type Tier = "none" | "plus" | "pro";
export const planTier = (plan?: string | null): "plus" | "pro" => (PLUS_PLANS as Record<string, { tier: "plus" | "pro" }>)[plan ?? ""]?.tier ?? "plus";
export const tierLabel = (t: Tier) => (t === "pro" ? "Petito Plus+" : t === "plus" ? "Petito Plus" : "Gratis");

/** First instant of the current month in Chile, when monthly allowances start over. */
export function monthStartIso(): string {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).format(new Date()); // "YYYY-MM"
  for (const off of ["-03:00", "-04:00"]) {
    const d = new Date(`${ymd}-01T00:00:00${off}`);
    if (new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", hour: "2-digit", hour12: false }).format(d) === "00") return d.toISOString();
  }
  return new Date(`${ymd}-01T00:00:00-03:00`).toISOString();
}

/** Videos of these kinds this person started this month (failed and abandoned ones don't count). */
export async function monthlyVideoCount(userId: string, modes: string[]): Promise<number> {
  const { count } = await db().from("videos").select("id", { count: "exact", head: true })
    .eq("user_id", userId).in("mode", modes).in("status", ["generating", "preview_ready", "paid"]).gte("created_at", monthStartIso());
  return count ?? 0;
}
export const PREMIUM_VIDEO_MODES = ["song", "motion"];
export const TALK_VIDEO_MODES = ["full"];

/** Administrators (ADMIN_EMAILS or made admin in the panel) always have Plus, without a subscription. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await db().from("app_users").select("*").eq("user_id", userId).maybeSingle();
  return Boolean(data && (env.adminEmails.has(String(data.email ?? "").toLowerCase()) || data.is_admin));
}

/** Port of server.py is_plus(): any active row whose plus_until is null or in the future — or an admin. */
export async function isPlus(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  if ((await activePlans(userId)).length) return true;
  return isAdminUser(userId);
}

/** none / plus / pro. Administrators always get the top tier. */
export async function plusTier(userId: string | null | undefined): Promise<Tier> {
  if (!userId) return "none";
  const plans = await activePlans(userId);
  if (plans.some((p) => planTier(p) === "pro")) return "pro";
  if (await isAdminUser(userId)) return "pro";
  return plans.length ? "plus" : "none";
}

/** Plan keys of this person's subscriptions that are active right now. */
async function activePlans(userId: string): Promise<string[]> {
  const { data } = await db()
    .from("subscriptions")
    .select("mp_id, plan, plus_until")
    .eq("user_id", userId)
    .eq("membership_active", true);
  const now = isoNow();
  const active: string[] = [];
  for (const s of data ?? []) {
    if (!s.plus_until || new Date(s.plus_until).toISOString() >= now) { active.push(s.plan); continue; }
    // Expired on our side. A Mercado Pago subscription may still be live there (a renewal webhook we
    // missed), so ask before taking Plus away; Petito grants simply end.
    if (!SYNTHETIC.test(s.mp_id) && mpEnabled()) {
      try {
        const fresh: any = await getPreapproval(s.mp_id);
        if (fresh.status === "authorized") { await activatePlus(s.mp_id, "authorized", fresh.next_payment_date); active.push(s.plan); continue; }
      } catch (e) {
        console.error("activePlans: Mercado Pago check failed, keeping Plus for now", s.mp_id, e);
        active.push(s.plan);
        continue;
      }
    }
    await db().from("subscriptions").update({ membership_active: false }).eq("mp_id", s.mp_id);
  }
  return active;
}

/**
 * Ask Mercado Pago about this person's recent subscriptions that we still have as not active.
 * Covers a lost webhook and a buyer who never came back through the checkout return page.
 */
export async function refreshFromMercadoPago(userId: string): Promise<void> {
  if (!mpEnabled()) return;
  const since = new Date(Date.now() - 45 * 86400_000).toISOString();
  const { data } = await db().from("subscriptions").select("mp_id, status")
    .eq("user_id", userId).eq("membership_active", false).gte("created_at", since)
    .order("created_at", { ascending: false }).limit(3);
  for (const s of data ?? []) {
    if (SYNTHETIC.test(s.mp_id) || ["canceled", "cancelled"].includes(String(s.status))) continue;
    try {
      const fresh: any = await getPreapproval(s.mp_id);
      if (fresh.status && fresh.status !== s.status) await activatePlus(s.mp_id, fresh.status, fresh.next_payment_date);
    } catch (e) {
      console.error("refreshFromMercadoPago failed", s.mp_id, e);
    }
  }
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
  const { data: sub } = await db().from("subscriptions").select("plan, user_id, membership_active").eq("mp_id", preapprovalId).maybeSingle();
  if (!sub) return;
  const active = status === "authorized";
  const days = (PLUS_PLANS[sub.plan as PlanKey] ?? PLUS_PLANS.monthly).days;
  const upd: Record<string, unknown> = { status, membership_active: active, next_payment_date: nextPaymentDate ?? null };
  if (active) upd.plus_until = new Date(Date.now() + days * 86400_000).toISOString();
  await db().from("subscriptions").update(upd).eq("mp_id", preapprovalId);
  if (active && !sub.membership_active) {
    await recordPayment(preapprovalId, sub.user_id, sub.plan, "new");
    if (planTier(sub.plan) === "pro") await retireReplacedPlus(sub.user_id, preapprovalId);
  }
}

/** After an upgrade to Plus+, cancel the person's Plus subscription so they aren't charged twice. */
async function retireReplacedPlus(userId: string, keepMpId: string) {
  const { data } = await db().from("subscriptions").select("mp_id, plan, status, membership_active").eq("user_id", userId).neq("mp_id", keepMpId);
  for (const s of data ?? []) {
    if (planTier(s.plan) !== "plus") continue;
    const live = s.membership_active || ["authorized", "pending", "paused"].includes(String(s.status));
    if (!live) continue;
    if (!SYNTHETIC.test(s.mp_id) && mpEnabled()) {
      try { await cancelPreapproval(s.mp_id); } catch (e) { console.error("upgrade: could not cancel the old Plus subscription", s.mp_id, e); }
    }
    await db().from("subscriptions").update({ status: "canceled", membership_active: false }).eq("mp_id", s.mp_id);
  }
}

/**
 * Funnel: a Mercado Pago subscription became active ("new", charged the plan price), or a later
 * monthly/annual charge went through ("renewal"). Credited to the feature where the person last hit
 * the paywall. Deduplicated, since webhooks and the return-from-checkout sync can both fire.
 */
export async function recordPayment(mpId: string, userId: string, plan: string, kind: "new" | "renewal", charge?: { id: string; amount: number }) {
  try {
    const key = kind === "new" ? ["props->>mp_id", mpId] : ["props->>payment_id", charge!.id];
    const { data: dup } = await db().from("events").select("id").eq("name", "paid").eq(key[0], key[1]).limit(1).maybeSingle();
    if (dup) return;
    const amount = charge?.amount ?? (PLUS_PLANS[plan as PlanKey] ?? PLUS_PLANS.monthly).amount;
    await track("paid", {
      userId, feature: (await lastCheckoutFeature(userId)) ?? "plus",
      props: { mp_id: mpId, plan, kind, amount, ...(charge ? { payment_id: charge.id } : {}) },
    });
  } catch (e) {
    console.warn("recordPayment failed", e);
  }
}

/** A charge on a subscription that was already active for a week or more counts as a renewal. */
export async function recordRenewalIfAny(mpId: string, charge: { id: string; amount: number }) {
  const { data: sub } = await db().from("subscriptions").select("plan, user_id").eq("mp_id", mpId).maybeSingle();
  if (!sub) return;
  const { data: first } = await db().from("events").select("created_at").eq("name", "paid").eq("props->>mp_id", mpId)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!first || Date.now() - new Date(first.created_at).getTime() < 7 * 86_400_000) return; // that's the first charge
  await recordPayment(mpId, sub.user_id, sub.plan, "renewal", charge);
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
  const current = active ? rows.find((r) => r.active && planTier(r.plan) === "pro") ?? rows.find((r) => r.active) ?? null : null;
  return { active, tier: await plusTier(userId), current, history: rows };
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
