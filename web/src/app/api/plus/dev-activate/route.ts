import { fail, handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { PLUS_PLANS, grantPlus, type PlanKey } from "@/lib/server/plus";
import { env } from "@/lib/server/env";

/** Preview-only: activate Plus without a real charge (gated by FREE_MODE). */
export const POST = handler(async (req: Request) => {
  const user = await requireUser(req);
  if (!env.freeMode) throw fail(403, "No disponible");
  const { plan: raw } = await readJson<{ plan?: string }>(req);
  const plan = (raw && raw in PLUS_PLANS ? raw : "monthly") as PlanKey;
  await grantPlus(user.user_id, plan, "dev");
  return json({ active: true, plan });
});
