import { deviceId, fail, handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { validatePetId } from "@/lib/server/domain";
import { getPortrait, portraitPublic } from "@/lib/server/portraits";
import { isPlus } from "@/lib/server/plus";
import { isoNow } from "@/lib/server/ids";
import type { Ctx } from "@/lib/server/route";

/**
 * After signing in, the free try made on this device becomes the owner's portrait (and their pet's,
 * if they already have one). Plus members get it unlocked right away.
 */
export const POST = handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser(req);
  const p = await getPortrait((await ctx.params).id);
  if (p.user_id && p.user_id !== user.user_id) throw fail(404, "Retrato no encontrado");
  if (!p.user_id && p.device_id && p.device_id !== deviceId(req)) throw fail(404, "Retrato no encontrado");
  const b = await readJson<{ pet_id?: string }>(req);
  let petId = await validatePetId(b.pet_id, user.user_id);
  if (!petId && !p.pet_id) {
    const { data: first } = await db().from("pets").select("id").eq("user_id", user.user_id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    petId = first?.id ?? null;
  }
  const upd: Record<string, unknown> = { user_id: user.user_id, ...(petId ? { pet_id: petId } : {}) };
  if (p.status === "preview_ready" && (await isPlus(user.user_id))) { upd.status = "paid"; upd.paid_at = isoNow(); }
  await db().from("portraits").update(upd).eq("id", p.id);
  return json(portraitPublic({ ...p, ...upd }));
});
