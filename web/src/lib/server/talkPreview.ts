import { defaultVoiceId, ensureVoices } from "@/lib/server/elevenlabs";
import { db } from "./db";
import { dayStartIso, deviceId, fail, originFrom } from "./http";
import { env } from "./env";
import { isoNow, newId, newSlug } from "./ids";
import { retentionIso } from "./jobPhotos";

export async function startPreview(req: Request) {
  await ensureVoices();
  const device = deviceId(req);
  if (device) {
    const { count } = await db().from("videos").select("id", { count: "exact", head: true })
      .eq("device_id", device).eq("mode", "preview_free").gte("created_at", dayStartIso());
    if ((count ?? 0) >= env.freeTalkPerDay) throw fail(429, "Llegaste al límite de adelantos gratis de hoy. ¡Crea el tuyo completo!");
  }
  const v = {
    id: newId(), share_slug: newSlug(), device_id: device || null, mode: "preview_free", price_clp: env.talkPriceClp,
    voice_id: defaultVoiceId(), media_base: originFrom(req), status: "draft", progress_step: "", progress_pct: 0,
    created_at: isoNow(), expires_at: retentionIso(env.retentionDays),
  };
  const { error } = await db().from("videos").insert(v);
  if (error) throw error;
  return v;
}

/** Anonymous preview rows can only be touched by the device that created them, while still a draft. */
export async function previewDraft(id: string, req: Request) {
  const { data } = await db().from("videos").select("*").eq("id", id).eq("mode", "preview_free").maybeSingle();
  if (!data || data.status !== "draft" || (data.device_id && data.device_id !== deviceId(req))) throw fail(404, "Video no encontrado");
  return data;
}
