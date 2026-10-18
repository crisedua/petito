import { handler, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const { count: total } = await db().from("survey_responses").select("id", { count: "exact", head: true });
  const { count: yes } = await db().from("survey_responses").select("id", { count: "exact", head: true }).eq("answer", "yes");
  const t = total ?? 0, y = yes ?? 0;
  return json({ total: t, yes: y, no: t - y, yes_pct: t ? Math.round((y / t) * 1000) / 10 : 0, price_clp: 9900 });
});
