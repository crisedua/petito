import { handler, json, readJson } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import type { Ctx } from "@/lib/server/route";

export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const { email } = await readJson<{ email?: string }>(req);
  await db().from("stories").update({ email: String(email ?? "").trim().slice(0, 120) }).eq("id", (await ctx.params).id);
  return json({ ok: true });
});
