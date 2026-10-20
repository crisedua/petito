import { fail, handler, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

/** Funnel per feature for the last `days` (7, 30 or 90): visitors → photo → result → sign-in → paywall → paid. */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const d = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const days = [7, 30, 90].includes(d) ? d : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await db().rpc("funnel_stats", { since });
  if (error) {
    if (/funnel_stats|function .* does not exist|schema cache/i.test(error.message)) throw fail(500, "Falta correr el SQL del embudo (0007_events.sql) en Supabase.");
    throw error;
  }
  return json({ days, ...(data as object) });
});
