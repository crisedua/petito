import { handler, json } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { mp, mpEnabled } from "@/lib/server/mercadopago";

// Public troubleshooting view of Mercado Pago setup. Emails are masked; no tokens are returned.
const mask = (e?: string | null) => (e ? e.replace(/^(.{2}).*(@.{3}).*$/, "$1***$2***") : null);

export const GET = handler(async () => {
  const token = env.mpToken;
  const out: Record<string, unknown> = {
    payment_mode: env.paymentMode, enabled: mpEnabled(),
    token_kind: !token ? "missing" : token.startsWith("TEST-") ? "TEST (sandbox)" : token.startsWith("APP_USR-") ? "APP_USR (production)" : "unknown",
    webhook_url: "https://www.petito.pro/api/payments/webhook/mercadopago",
    webhook_secret_set: Boolean(env.mpWebhookSecret),
  };
  try {
    const me: any = await mp("GET", "/users/me");
    out.seller = { id: me.id, site: me.site_id, nickname: me.nickname, email: mask(me.email), test_user: (me.tags ?? []).includes("test_user"),
      status: me.status?.site_status, tags: me.tags };
  } catch (e: any) { out.seller_error = String(e.message).slice(0, 200); }
  const { data: subs } = await db().from("subscriptions").select("mp_id, plan, status, payer_email, created_at")
    .order("created_at", { ascending: false }).limit(3);
  out.latest = await Promise.all((subs ?? []).map(async (s) => {
    let mpState: any = null;
    // courtesy-/admin-/dev- rows are Petito grants, not Mercado Pago subscriptions.
    if (/^(courtesy|admin|dev)-/.test(s.mp_id)) return { plan: s.plan, status: s.status, source: "petito-grant", created_at: s.created_at };
    try {
      const p: any = await mp("GET", `/preapproval/${s.mp_id}`);
      mpState = { status: p.status, payer_id: p.payer_id, payer_email: mask(p.payer_email), collector_id: p.collector_id, amount: p.auto_recurring?.transaction_amount, currency: p.auto_recurring?.currency_id, init_point_host: p.init_point ? new URL(p.init_point).host : null };
    } catch (e: any) { mpState = { error: String(e.message).slice(0, 200) }; }
    return { plan: s.plan, status: s.status, payer_email: mask(s.payer_email), created_at: s.created_at, mp: mpState };
  }));
  // The most recent subscriptions on the Mercado Pago side, and whether each one has its row here.
  try {
    // Newest first; if Mercado Pago ignores the sort, read the last page instead.
    let r: any = await mp("GET", "/preapproval/search?sort=date_created:desc&limit=50");
    const total = Number(r.paging?.total ?? 0);
    const newestFirst = (r.results ?? []).length < 2 || String(r.results[0].date_created) >= String(r.results[r.results.length - 1].date_created);
    if (!newestFirst && total > 50) r = await mp("GET", `/preapproval/search?limit=50&offset=${Math.max(0, total - 50)}`);
    const list = (r.results ?? []).sort((a: any, b: any) => String(b.date_created).localeCompare(String(a.date_created))).slice(0, 8);
    const ids = list.map((x: any) => x.id);
    const { data: known } = ids.length ? await db().from("subscriptions").select("mp_id").in("mp_id", ids) : { data: [] as any[] };
    const have = new Set((known ?? []).map((k: any) => k.mp_id));
    out.mp_recent = list.map((x: any) => ({
      reason: x.reason, status: x.status, amount: x.auto_recurring?.transaction_amount, created_at: x.date_created,
      plan: String(x.external_reference ?? "").split(":")[1] ?? null, in_db: have.has(x.id),
    }));
  } catch (e: any) { out.mp_recent_error = String(e.message).slice(0, 200); }
  const { data: hooks } = await db().from("events").select("props, created_at").eq("name", "mp_webhook")
    .order("created_at", { ascending: false }).limit(5);
  out.recent_webhooks = (hooks ?? []).map((h: any) => ({ at: h.created_at, topic: h.props?.topic ?? null, signature_ok: h.props?.signature_ok ?? null }));
  return json(out);
});
