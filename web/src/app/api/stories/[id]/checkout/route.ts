import { handler, json, readJson } from "@/lib/server/http";
import { trackLater } from "@/lib/server/events";
import { db } from "@/lib/server/db";
import { getStory } from "@/lib/server/stories";
import { isPlus } from "@/lib/server/plus";
import { isoNow } from "@/lib/server/ids";
import { env } from "@/lib/server/env";
import type { Ctx } from "@/lib/server/route";

/** Subscription-only: the clean story is unlocked solely by Petipop Plus. */
export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const s = await getStory((await ctx.params).id);
  if (s.status === "paid") return json({ mode: env.paymentMode, already_paid: true });
  if (s.user_id && (await isPlus(s.user_id))) {
    await db().from("stories").update({ status: "paid", paid_at: isoNow() }).eq("id", s.id).neq("status", "paid");
    await db().from("slides").update({ locked: false }).eq("story_id", s.id);
    return json({ mode: "plus", already_paid: true });
  }
  // Free user tapped "unlock": they hit the Plus paywall from this feature (silent auto-checks don't count).
  if (!(await readJson<{ auto?: boolean }>(req)).auto) trackLater("paywall", { req, feature: "story", userId: s.user_id });
  return json({ mode: "plus_required" });
});
