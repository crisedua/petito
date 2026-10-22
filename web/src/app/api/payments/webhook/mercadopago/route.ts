import { fail, handler, json } from "@/lib/server/http";
import { getAuthorizedPayment, getPayment, getPreapproval, mpEnabled, validSignature } from "@/lib/server/mercadopago";
import { activatePlus, recordRenewalIfAny } from "@/lib/server/plus";
import { db } from "@/lib/server/db";
import { isoNow } from "@/lib/server/ids";
import { talkMarkPaidAndFinalize } from "@/lib/server/domain";
import { track } from "@/lib/server/events";

const approvedFor = (p: any, price: number) =>
  p.status === "approved" && p.currency_id === "CLP" && Number(p.transaction_amount ?? 0) === Number(price);

export const POST = handler(async (req: Request) => {
  if (!mpEnabled()) return json({ received: true });
  const q = new URL(req.url).searchParams;
  const dataId = q.get("data.id") || q.get("data_id");
  const eventType = q.get("type");
  const signed = validSignature(req.headers.get("x-signature"), req.headers.get("x-request-id"), dataId);
  // Keep a trace of every notification so /api/health/payments can show whether Mercado Pago reaches us.
  const recentUnsigned = signed ? null : (await db().from("events").select("id").eq("name", "mp_webhook").eq("props->>signature_ok", "false")
    .gte("created_at", new Date(Date.now() - 60_000).toISOString()).limit(1).maybeSingle()).data;
  if (!recentUnsigned) await track("mp_webhook", { props: { topic: eventType || null, id: dataId ? String(dataId).slice(0, 40) : null, signature_ok: signed } });
  if (!signed) throw fail(401, "Firma inválida");
  let body: any = {};
  try { body = await req.json(); } catch { /* MP sometimes sends an empty body */ }
  const resId = String(dataId || body?.data?.id || "");
  const topic = eventType || body?.type;

  // ---- Petipop Plus subscription events ----
  if (topic === "subscription_preapproval" && resId) {
    try {
      const sub = await getPreapproval(resId);
      await activatePlus(resId, sub.status, sub.next_payment_date, sub);
    } catch (e) { console.error("webhook preapproval fetch failed", e); }
    return json({ received: true });
  }
  if (topic === "subscription_authorized_payment" && resId) {
    try {
      const inv = await getAuthorizedPayment(resId);
      const preId = inv.preapproval_id;
      if (preId) {
        const sub = await getPreapproval(preId);
        if (sub.status === "authorized" && ["approved", "authorized", "processed"].includes(inv.status)) {
          await activatePlus(preId, "authorized", sub.next_payment_date, sub);
          await recordRenewalIfAny(preId, { id: String(inv.id ?? resId), amount: Number(inv.transaction_amount ?? 0) });
        }
      }
    } catch (e) { console.error("webhook authorized_payment failed", e); }
    return json({ received: true });
  }

  // ---- legacy one-off payments (no checkout creates these anymore; kept for in-flight orders) ----
  if (eventType !== null && eventType !== "payment") return json({ received: true });
  if (!resId) return json({ received: true });
  let payment: any;
  try { payment = await getPayment(resId); } catch (e) { console.error("webhook payment fetch failed", e); return json({ received: true }); }
  const orderId = payment.external_reference;
  if (!orderId) return json({ received: true });
  const { data: story } = await db().from("stories").select("id, price_clp").eq("id", orderId).maybeSingle();
  if (story) {
    if (approvedFor(payment, story.price_clp)) {
      await db().from("stories").update({ status: "paid", paid_at: isoNow() }).eq("id", orderId).neq("status", "paid");
      await db().from("slides").update({ locked: false }).eq("story_id", orderId);
    }
    return json({ received: true });
  }
  const { data: portrait } = await db().from("portraits").select("id, price_clp").eq("id", orderId).maybeSingle();
  if (portrait) {
    if (approvedFor(payment, portrait.price_clp)) {
      await db().from("portraits").update({ status: "paid", paid_at: isoNow() }).eq("id", orderId).neq("status", "paid");
    }
    return json({ received: true });
  }
  const { data: video } = await db().from("videos").select("id, price_clp").eq("id", orderId).maybeSingle();
  if (video && approvedFor(payment, video.price_clp)) await talkMarkPaidAndFinalize(orderId);
  return json({ received: true });
});
