import { handler, json, readJson } from "@/lib/server/http";
import { trackLater } from "@/lib/server/events";
import { getVideo } from "@/lib/server/talk";
import { isPlus } from "@/lib/server/plus";
import { talkMarkPaidAndFinalize } from "@/lib/server/domain";
import { env } from "@/lib/server/env";
import type { Ctx } from "@/lib/server/route";

/** Subscription-only: the HD video is unlocked solely by Petipo Plus. */
export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const v = await getVideo((await ctx.params).id);
  if (v.status === "paid") return json({ mode: env.paymentMode, already_paid: true });
  if (v.user_id && (await isPlus(v.user_id))) {
    await talkMarkPaidAndFinalize(v.id);
    return json({ mode: "plus", already_paid: true });
  }
  // Free user tapped "unlock": they hit the Plus paywall from this feature (silent auto-checks don't count).
  if (!(await readJson<{ auto?: boolean }>(req)).auto) trackLater("paywall", { req, feature: "video", userId: v.user_id });
  return json({ mode: "plus_required" });
});
