import { fail, handler, json, originFrom, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { PLUS_PLANS, isPlus, type PlanKey } from "@/lib/server/plus";
import { createPreapproval, mpEnabled, MpHttpError } from "@/lib/server/mercadopago";
import { db } from "@/lib/server/db";
import { isoNow, newId } from "@/lib/server/ids";
import { env } from "@/lib/server/env";

export const POST = handler(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson<{ plan?: string; email?: string }>(req);
  if (!body.plan || !(body.plan in PLUS_PLANS)) throw fail(400, "Plan inválido");
  const plan = body.plan as PlanKey;
  if (await isPlus(user.user_id)) throw fail(400, "Ya tienes Petito Plus activo");
  if (!mpEnabled()) throw fail(503, "Pagos no disponibles");
  // Mercado Pago requires the payer email to match the account that pays; the user confirms it.
  const payerEmail = (body.email || user.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) throw fail(400, "Ingresa un correo válido de tu cuenta de Mercado Pago");
  const p = PLUS_PLANS[plan];
  const ref = `${user.user_id}:${plan}:${newId()}`;
  const backUrl = `${(originFrom(req) || env.publicBaseUrl).replace(/\/$/, "")}/plus?pago=success`;
  let mp;
  try {
    mp = await createPreapproval(ref, p.reason, p.amount, p.frequency, payerEmail, backUrl);
  } catch (e) {
    console.error("preapproval create failed", e);
    if (e instanceof MpHttpError && e.status === 400) {
      throw fail(400, "Mercado Pago no aceptó estos datos. Revisa que el correo sea exactamente el de tu cuenta de Mercado Pago.");
    }
    throw fail(502, "No se pudo iniciar la suscripción");
  }
  await db().from("subscriptions").insert({
    mp_id: mp.id, user_id: user.user_id, plan, external_reference: ref, payer_email: payerEmail,
    status: mp.status ?? "pending", membership_active: false, plus_until: null, created_at: isoNow(),
  });
  return json({ init_point: mp.init_point, mp_id: mp.id });
});
