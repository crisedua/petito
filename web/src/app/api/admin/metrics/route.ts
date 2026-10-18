import { handler, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";

export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const { data } = await db().rpc("admin_metrics");
  const row = (Array.isArray(data) ? data[0] : data) ?? { total_stories: 0, paid_stories: 0, total_cost_usd: 0 };
  const total = Number(row.total_stories), paid = Number(row.paid_stories), cost = Number(row.total_cost_usd);
  return json({
    total_stories: total, paid_stories: paid,
    conversion_rate: total ? Math.round((paid / total) * 1000) / 10 : 0,
    revenue_clp: paid * env.priceClp,
    total_ai_cost_usd: Math.round(cost * 10000) / 10000,
    total_ai_cost_clp: Math.round(cost * env.usdToClp),
    avg_cost_clp: total ? Math.round((cost * env.usdToClp) / total) : 0,
    usd_to_clp: env.usdToClp, cost_guardrail_clp: 600,
  });
});
