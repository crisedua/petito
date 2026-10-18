import { handler, json } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { getStory } from "@/lib/server/stories";
import { isPlus } from "@/lib/server/plus";
import { isoNow } from "@/lib/server/ids";
import { env } from "@/lib/server/env";
import type { Ctx } from "@/lib/server/route";

/** Subscription-only: the clean story is unlocked solely by Petito Plus. */
export const POST = handler(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  const s = await getStory((await ctx.params).id);
  if (s.status === "paid") return json({ mode: env.paymentMode, already_paid: true });
  if (s.user_id && (await isPlus(s.user_id))) {
    await db().from("stories").update({ status: "paid", paid_at: isoNow() }).eq("id", s.id).neq("status", "paid");
    await db().from("slides").update({ locked: false }).eq("story_id", s.id);
    return json({ mode: "plus", already_paid: true });
  }
  return json({ mode: "plus_required" });
});
