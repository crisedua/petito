import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

const BASE = "https://api.mercadopago.com";

export const mpEnabled = () => env.paymentMode === "mercadopago" && Boolean(env.mpToken);

export class MpHttpError extends Error {
  constructor(public status: number, body: string) {
    super(`Mercado Pago ${status}: ${body.slice(0, 300)}`);
  }
}

export async function mp<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.mpToken}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new MpHttpError(res.status, await res.text());
  return res.json() as Promise<T>;
}

/** Petipop Plus recurring subscription (preapproval without a plan). */
export async function createPreapproval(ref: string, reason: string, amount: number, frequency: number, payerEmail: string, backUrl: string) {
  const d = await mp("POST", "/preapproval", {
    reason,
    external_reference: ref,
    payer_email: payerEmail,
    auto_recurring: { frequency, frequency_type: "months", transaction_amount: amount, currency_id: "CLP" },
    back_url: backUrl,
    status: "pending",
  });
  return { id: d.id as string, init_point: d.init_point as string, status: d.status as string | undefined, next_payment_date: d.next_payment_date as string | undefined };
}

export const getPreapproval = (id: string) => mp("GET", `/preapproval/${id}`);
export const cancelPreapproval = (id: string) => mp("PUT", `/preapproval/${id}`, { status: "canceled" });
export const getAuthorizedPayment = (id: string) => mp("GET", `/authorized_payments/${id}`);
export const getPayment = (id: string) => mp("GET", `/v1/payments/${id}`);

/**
 * x-signature HMAC check (manifest `id:{data_id};request-id:{x_request_id};ts:{ts};`).
 * With no secret configured the check is skipped; every status is re-fetched from MP anyway.
 */
export function validSignature(xSignature: string | null, xRequestId: string | null, dataId: string | null): boolean {
  if (!env.mpWebhookSecret) return true;
  if (!xSignature || !xRequestId || !dataId) return false;
  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => p.trim()).filter((p) => p.includes("=")).map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]),
  );
  const { ts, v1 } = parts as { ts?: string; v1?: string };
  if (!ts || !v1 || !/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", env.mpWebhookSecret).update(manifest).digest("hex");
  return expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

let sellerEmail: string | null | undefined;
/** Email of the Mercado Pago account that owns the access token (cached). */
export async function getSellerEmail(): Promise<string | null> {
  if (sellerEmail !== undefined) return sellerEmail;
  try {
    sellerEmail = String((await mp<any>("GET", "/users/me")).email || "").toLowerCase() || null;
  } catch {
    return null;
  }
  return sellerEmail;
}
