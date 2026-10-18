import { handler, json, readJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { PLUS_PLANS, grantPlus, type PlanKey } from "@/lib/server/plus";

/** Admin-only: Plus on the admin's own account to verify the full experience. */
export const POST = handler(async (req: Request) => {
  const user = await requireAdmin(req);
  const { plan: raw } = await readJson<{ plan?: string }>(req);
  const plan = (raw && raw in PLUS_PLANS ? raw : "monthly") as PlanKey;
  await grantPlus(user.user_id, plan, "admin");
  return json({ active: true, plan });
});
