import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { activatePlus, isPlus, latestSubscription } from "@/lib/server/plus";
import { getPreapproval, mpEnabled } from "@/lib/server/mercadopago";

/** Called on return from Mercado Pago to confirm the status server-side. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser(req);
  const sub = await latestSubscription(user.user_id);
  if (sub?.mp_id && mpEnabled() && !/^(dev|admin|courtesy)-/.test(sub.mp_id)) {
    try {
      const fresh = await getPreapproval(sub.mp_id);
      await activatePlus(sub.mp_id, fresh.status, fresh.next_payment_date);
    } catch (e) {
      console.error("plus sync failed", e);
    }
  }
  return json({ active: await isPlus(user.user_id) });
});
