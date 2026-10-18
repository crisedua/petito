import { fail, handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { cancelPreapproval, mpEnabled } from "@/lib/server/mercadopago";
import { db, iso } from "@/lib/server/db";

export const PUT = handler(async (req: Request) => {
  const user = await requireUser(req);
  const { data: sub } = await db().from("subscriptions").select("*").eq("user_id", user.user_id).eq("membership_active", true)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!sub?.mp_id) throw fail(404, "No tienes una suscripción activa");
  if (mpEnabled() && !/^(dev|admin|courtesy)-/.test(sub.mp_id)) {
    try { await cancelPreapproval(sub.mp_id); } catch (e) { console.error("plus cancel failed", e); }
  }
  // Keep access until plus_until (period already paid), but stop renewal.
  await db().from("subscriptions").update({ status: "canceled" }).eq("mp_id", sub.mp_id);
  return json({ ok: true, plus_until: sub.plus_until ? iso(sub.plus_until) : null });
});
