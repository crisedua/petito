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
    try {
      const p: any = await mp("GET", `/preapproval/${s.mp_id}`);
      mpState = { status: p.status, payer_id: p.payer_id, payer_email: mask(p.payer_email), collector_id: p.collector_id, amount: p.auto_recurring?.transaction_amount, currency: p.auto_recurring?.currency_id, init_point_host: p.init_point ? new URL(p.init_point).host : null };
    } catch (e: any) { mpState = { error: String(e.message).slice(0, 200) }; }
    return { plan: s.plan, status: s.status, payer_email: mask(s.payer_email), created_at: s.created_at, mp: mpState };
  }));
  return json(out);
});
