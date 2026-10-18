import { inngest, EV } from "../client";
import { awaitFal, progress } from "../helpers";
import { db, logGeneration } from "@/lib/server/db";
import * as fal from "@/lib/server/fal";
import * as storage from "@/lib/server/storage";
import { imageToB64, loadImage } from "@/lib/server/images";
import { writePetLine } from "@/lib/server/prompts";
import { llmCost, llmModel } from "@/lib/server/llm";
import { generateNarration } from "@/lib/server/elevenlabs";
import { talkSource } from "@/lib/render/watermarks";
import { env } from "@/lib/server/env";
import { hex16 } from "@/lib/server/ids";
import { BRAND_NAME, TALK_MESSAGE_MAX, TALK_SCENARIOS, validVoice } from "@/lib/catalogs";

const loadVideo = async (id: string) => (await db().from("videos").select("*").eq("id", id).single()).data!;
const firstPhoto = async (id: string) =>
  (await db().from("talk_photos").select("file").eq("video_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.file as string | undefined;

/** Port of run_talk_pipeline: line → voice → watermarked 9:16 source → lipsync video preview. */
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
    const v = await step.run("load", () => loadVideo(id));
    const long = v.mode === "full";
    const photo: string | null = await step.run("photo", async () => (await firstPhoto(id)) ?? null);
    if (!photo) throw new Error("No hay foto");

    await progress(step, "videos", id, "20", { progress_step: "Escuchando a tu mascota...", progress_pct: 20 });
    const line: string = await step.run("line", async () => {
      let text: string, species: string, usage = null;
      if (v.message) {
        text = String(v.message).trim().slice(0, TALK_MESSAGE_MAX);
        species = v.species || "otro";
      } else {
        const hint = v.scenario ? TALK_SCENARIOS[v.scenario]?.hint : null;
        const b64 = await imageToB64(id, photo, 512);
        ({ line: text, species, usage } = await writePetLine(b64, v.pet_name, long ? "long" : "mini", hint));
      }
      await db().from("videos").update({ line: text, species }).eq("id", id);
      if (usage) await logGeneration({ ownerId: id, step: "talk_line", model: llmModel(), usage, costUsd: llmCost(usage) });
      return text;
    });

    await progress(step, "videos", id, "40", { progress_step: "Buscando la voz perfecta...", progress_pct: 40 });
    await step.run("tts", async () => {
      const audio = await generateNarration(line, validVoice(v.voice_id), 1.0);
      await storage.put(id, "audio.mp3", audio, "audio/mpeg");
    });

    await progress(step, "videos", id, "60", { progress_step: "Dándole voz a tu mascota...", progress_pct: 60 });
    await step.run("source", async () => {
      const src = await talkSource(await loadImage(id, photo), true, long ? 720 : 384, BRAND_NAME);
      await storage.put(id, "source.jpg", src, "image/jpeg");
    });
    const base = (v.media_base || env.publicBaseUrl).replace(/\/$/, "");
    const t0 = Date.now();
    const requestId: string = await step.run("submit", () =>
      fal.submitLipsync(storage.publicMediaUrl(id, "source.jpg", base), storage.publicMediaUrl(id, "audio.mp3", base)));
    const url = await awaitFal(step, "lipsync", env.falTalkModel, requestId, 6);
    await step.run("save", async () => {
      await storage.put(id, "preview.mp4", await fal.download(url), "video/mp4");
      await logGeneration({ ownerId: id, step: "talk_video", model: env.falTalkModel, costUsd: fal.FAL_VIDEO_COST_PER_SEC * (long ? 8 : 3), durationMs: Date.now() - t0 });
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
    const v = await step.run("load", () => loadVideo(id));
    if (v.clean_file) return { skipped: true };
    const photo: string | null = await step.run("photo", async () => (await firstPhoto(id)) ?? null);
    const hasAudio: boolean = await step.run("audio", () => storage.exists(id, "audio.mp3"));
    if (!photo || !hasAudio) return { error: "Faltan recursos para la versión HD" };
    await progress(step, "videos", id, "50", { progress_step: "Creando tu versión HD...", progress_pct: 50 });
    await step.run("source-hd", async () => {
      const src = await talkSource(await loadImage(id, photo), false, 1080, BRAND_NAME, 95);
      await storage.put(id, "source_hd.jpg", src, "image/jpeg");
    });
    const base = (v.media_base || env.publicBaseUrl).replace(/\/$/, "");
    const t0 = Date.now();
    const requestId: string = await step.run("submit", () =>
      fal.submitLipsync(storage.publicMediaUrl(id, "source_hd.jpg", base), storage.publicMediaUrl(id, "audio.mp3", base)));
    const url = await awaitFal(step, "lipsync-hd", env.falTalkModel, requestId, 6);
    await step.run("save", async () => {
      const name = `clean_${hex16()}.mp4`;
      await storage.put(id, name, await fal.download(url), "video/mp4");
      await logGeneration({ ownerId: id, step: "talk_video_hd", model: env.falTalkModel, costUsd: fal.FAL_VIDEO_COST_PER_SEC * 8, durationMs: Date.now() - t0 });
      await db().from("videos").update({ clean_file: name, progress_pct: 100, progress_step: "¡HD listo!" }).eq("id", id);
    });
    return { ok: true };
  },
);
