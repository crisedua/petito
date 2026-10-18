import { fail, handler, json } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import * as storage from "@/lib/server/storage";
import { ensureVoices, generateNarration, validVoice } from "@/lib/server/elevenlabs";
import type { Ctx } from "@/lib/server/route";
import { VOICE_SAMPLE_TEXT } from "@/lib/catalogs";

export const maxDuration = 60;

export const GET = handler(async (_req: Request, ctx: Ctx<{ id: string }>) => {
  await ensureVoices();
  const vid = validVoice((await ctx.params).id);
  const name = `${vid}.mp3`;
  if (!(await storage.exists("voicesamples", name))) {
    if (!env.narrationEnabled) throw fail(503, "Voces no disponibles");
    try {
      const audio = await generateNarration(VOICE_SAMPLE_TEXT, vid, 1.0);
      await storage.put("voicesamples", name, audio, "audio/mpeg");
    } catch (e) {
      console.error("voice sample failed", e);
      throw fail(502, "No se pudo generar la muestra");
    }
  }
  return json({ url: storage.mediaPath("voicesamples", name) });
});
