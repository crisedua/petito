import { handler, json } from "@/lib/server/http";
import { isAdmin, requireUser } from "@/lib/server/auth";
import { isPlus, latestSubscription } from "@/lib/server/plus";
import { iso } from "@/lib/server/db";
import { env } from "@/lib/server/env";

export const GET = handler(async (req: Request) => {
  const user = await requireUser(req);
  const sub = await latestSubscription(user.user_id);
  return json({
    active: await isPlus(user.user_id),
    plan: sub?.plan ?? null,
    status: sub?.status ?? null,
    plus_until: sub?.plus_until ? iso(sub.plus_until) : null,
    mp_id: sub?.mp_id ?? null,
    monthly_clp: env.plusMonthlyClp,
    annual_clp: env.plusAnnualClp,
    free_mode: env.freeMode,
    is_admin: isAdmin(user.email),
  });
});
