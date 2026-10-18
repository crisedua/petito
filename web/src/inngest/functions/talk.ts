import { NonRetriableError } from "inngest";
import { inngest, EV } from "../client";
import { awaitElevenVideo, awaitFal, creepingProgress } from "../helpers";
import { db, logGeneration } from "@/lib/server/db";
import * as fal from "@/lib/server/fal";
import * as eleven from "@/lib/server/elevenvideo";
import * as storage from "@/lib/server/storage";
import { imageToB64, loadImage } from "@/lib/server/images";
import { writePetLine } from "@/lib/server/prompts";
import { llmCost, llmModel } from "@/lib/server/llm";
import { generateNarration, validVoice } from "@/lib/server/elevenlabs";
import { talkSource } from "@/lib/render/watermarks";
import { env } from "@/lib/server/env";
import { hex16 } from "@/lib/server/ids";
import { BRAND_NAME, TALK_MESSAGE_MAX, TALK_SCENARIOS } from "@/lib/catalogs";

const loadVideo = async (id: string) => (await db().from("videos").select("*").eq("id", id).single()).data!;
const firstPhoto = async (id: string) =>
  (await db().from("talk_photos").select("file").eq("video_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.file as string | undefined;

const WAIT_TEXT = "Moviéndole la boquita... casi listo";

type Provider = "fal" | "elevenlabs";
const providerOrder = (): Provider[] => {
  const all: Provider[] = env.talkVideoProvider === "fal" ? ["fal", "elevenlabs"] : ["elevenlabs", "fal"];
  return all.filter((p) => env.mockAi || (p === "fal" ? Boolean(env.falKey) : Boolean(env.elevenKey)));
};

/**
 * Photo (already cropped to 9:16) + audio.mp3 → MP4 stored as `outFile`. Uses the preferred lip-sync
 * provider (fal VEED Fabric by default — the fastest) and, if it refuses for a configuration reason,
 * the other one. Inputs are sent to the provider directly, so no public URL on our side is needed.
 */
async function lipsyncToStorage(step: any, key: string, id: string, sourceFile: string, outFile: string, hd: boolean, progressFrom: number) {
  const t0 = Date.now();
  const tick = creepingProgress("videos", id, WAIT_TEXT, progressFrom, 95);
  const errors: string[] = [];
  for (const provider of providerOrder()) {
    const sub: { id?: string; model?: string; error?: string } = await step.run(`${key}-${provider}-submit`, async () => {
      await db().from("videos").update({ progress_step: WAIT_TEXT, progress_pct: progressFrom }).eq("id", id);
      const [image, audio] = await Promise.all([loadImage(id, sourceFile), storage.get(id, "audio.mp3").then((r) => r.buf)]);
      try {
        if (provider === "fal") {
          const r = await fal.submitLipsync(image, audio, hd);
          return { id: r.requestId, model: r.model };
        }
        return { id: await eleven.submitLipsync(image, audio, hd ? "720p" : "480p"), model: `elevenlabs/${eleven.ELEVEN_VIDEO_MODEL}` };
      } catch (e) {
        if (e instanceof fal.PermanentFalError || e instanceof eleven.PermanentVideoError) return { error: e.message };
        throw e;
      }
    });
    if (!sub.id) {
      errors.push(sub.error ?? `${provider} rechazó la solicitud`);
      console.warn(`talk ${id}: ${sub.error} — trying next lip-sync provider`);
      continue;
    }
    const url = provider === "fal"
      ? await awaitFal(step, `${key}-fal`, sub.model!, sub.id, 40, tick)
      : await awaitElevenVideo(step, `${key}-eleven`, sub.id, 60, tick);
    await step.run(`${key}-${provider}-save`, async () => {
      const bytes = provider === "fal" ? await fal.download(url) : await eleven.download(url);
      await storage.put(id, outFile, bytes, "video/mp4");
    });
    return { model: sub.model!, ms: Date.now() - t0 };
  }
  throw new NonRetriableError(errors.join(" · ") || "No hay proveedor de video configurado (FAL_KEY o ELEVENLABS_API_KEY)");
}

/** Port of run_talk_pipeline: line → voice → watermarked 9:16 source → lip-synced video preview. */
export const generateTalk = inngest.createFunction(
  {
    id: "talk-generate",
    triggers: [{ event: EV.talkGenerate }],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const id = (event.data as any).event?.data?.video_id;
      if (id) await db().from("videos").update({ status: "failed", error: String(error?.message ?? error), progress_step: "Algo salió mal", progress_pct: 0 }).eq("id", id);
    },
  },
  async ({ event, step }) => {
    const id: string = (event.data as any).video_id;
    const { v, photo } = await step.run("load", async () => ({ v: await loadVideo(id), photo: (await firstPhoto(id)) ?? null }));
    if (!photo) throw new Error("No hay foto");
    const long = v.mode === "full";

    // The voice (line + speech) and the watermarked frame don't depend on each other: run them together.
    await Promise.all([
      step.run("line-and-voice", async () => {
        await db().from("videos").update({ progress_step: "Escuchando a tu mascota...", progress_pct: 20 }).eq("id", id);
        let text: string, species: string, usage = null;
        if (v.message) {
          text = String(v.message).trim().slice(0, TALK_MESSAGE_MAX);
          species = v.species || "otro";
        } else {
          const hint = v.scenario ? TALK_SCENARIOS[v.scenario]?.hint : null;
          const b64 = await imageToB64(id, photo, 512);
          ({ line: text, species, usage } = await writePetLine(b64, v.pet_name, long ? "long" : "mini", hint));
        }
        await db().from("videos").update({ line: text, species, progress_step: "Buscando la voz perfecta...", progress_pct: 40 }).eq("id", id);
        if (usage) await logGeneration({ ownerId: id, step: "talk_line", model: llmModel(true), usage, costUsd: llmCost(usage, true) });
        const audio = await generateNarration(text, validVoice(v.voice_id), 1.0, env.talkVoiceModel);
        await storage.put(id, "audio.mp3", audio, "audio/mpeg");
      }),
      step.run("source", async () => {
        const src = await talkSource(await loadImage(id, photo), true, long ? 720 : 480, BRAND_NAME);
        await storage.put(id, "source.jpg", src, "image/jpeg");
      }),
    ]);

    const gen = await lipsyncToStorage(step, "lipsync", id, "source.jpg", "preview.mp4", false, 60);
    await step.run("done", async () => {
      await logGeneration({ ownerId: id, step: "talk_video", model: gen.model, costUsd: env.talkVideoCostPerSec * (long ? 5 : 3), durationMs: gen.ms });
      await db().from("videos").update({ status: "preview_ready", preview_file: "preview.mp4", progress_pct: 100, progress_step: "¡Listo!" }).eq("id", id);
    });
    return { ok: true };
  },
);

/** Port of run_talk_clean: after a Plus unlock, regenerate an HD video without watermark, same audio. */
export const talkClean = inngest.createFunction(
  { id: "talk-clean", triggers: [{ event: EV.talkClean }], retries: 2 },
  async ({ event, step }) => {
    const id: string = (event.data as any).video_id;
    const { v, photo, hasAudio } = await step.run("load", async () => ({
      v: await loadVideo(id), photo: (await firstPhoto(id)) ?? null, hasAudio: await storage.exists(id, "audio.mp3"),
    }));
    if (v.clean_file) return { skipped: true };
    if (!photo || !hasAudio) return { error: "Faltan recursos para la versión HD" };
    await step.run("source-hd", async () => {
      await db().from("videos").update({ progress_step: "Creando tu versión HD...", progress_pct: 50 }).eq("id", id);
      const src = await talkSource(await loadImage(id, photo), false, 1080, BRAND_NAME, 95);
      await storage.put(id, "source_hd.jpg", src, "image/jpeg");
    });
    const name = `clean_${hex16()}.mp4`;
    const gen = await lipsyncToStorage(step, "lipsync-hd", id, "source_hd.jpg", name, true, 52);
    await step.run("done", async () => {
      await logGeneration({ ownerId: id, step: "talk_video_hd", model: gen.model, costUsd: env.talkVideoCostPerSec * 5, durationMs: gen.ms });
      await db().from("videos").update({ clean_file: name, progress_pct: 100, progress_step: "¡HD listo!" }).eq("id", id);
    });
    return { ok: true };
  },
);
