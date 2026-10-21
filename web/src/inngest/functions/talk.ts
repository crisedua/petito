import { isPlus } from "@/lib/server/plus";
import { track } from "@/lib/server/events";
import { NonRetriableError } from "inngest";
import { inngest, EV } from "../client";
import { awaitElevenVideo, awaitFal, creepingProgress, progress } from "../helpers";
import { db, logGeneration } from "@/lib/server/db";
import * as fal from "@/lib/server/fal";
import * as hf from "@/lib/server/higgsfield";
import { danceSourceUrl } from "@/lib/server/dances";
import * as eleven from "@/lib/server/elevenvideo";
import * as storage from "@/lib/server/storage";
import { imageToB64, loadImage } from "@/lib/server/images";
import { writePetLine, writePetSong } from "@/lib/server/prompts";
import { composeSong, SONG_COST_USD, SONG_MODEL } from "@/lib/server/elevenmusic";
import { llmCost, llmModel } from "@/lib/server/llm";
import { ensureVoices, generateNarration, validVoice } from "@/lib/server/elevenlabs";
import { talkSource } from "@/lib/render/watermarks";
import { env } from "@/lib/server/env";
import { hex16 } from "@/lib/server/ids";
import { BRAND_NAME, DANCE_SECONDS, MOTION_SCENES, MOTION_SECONDS, PERSONALITY_LABELS, SONG_SECONDS, SONG_STYLES, TALK_MESSAGE_MAX, TALK_SCENARIOS } from "@/lib/catalogs";

const loadVideo = async (id: string) => (await db().from("videos").select("*").eq("id", id).single()).data!;
const firstPhoto = async (id: string) =>
  (await db().from("talk_photos").select("file").eq("video_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.file as string | undefined;

const WAIT_TEXT = "Moviéndole la boquita... casi listo";

/** Who the message is for, the pet's personality and one real memory, so the line is unmistakably this pet's. */
async function lineContext(v: any) {
  const ctx: { toName?: string | null; personality?: string[]; memory?: string | null } = { toName: v.to_name ?? null };
  if (!v.pet_id) return ctx;
  try {
    const { data: pet } = await db().from("pets").select("personality").eq("id", v.pet_id).maybeSingle();
    ctx.personality = (pet?.personality ?? []).map((k: string) => PERSONALITY_LABELS[k] ?? k).slice(0, 3);
    const { data: mems } = await db().from("memories").select("title").eq("pet_id", v.pet_id).order("created_at", { ascending: false }).limit(5);
    const titles = (mems ?? []).map((m) => String(m.title || "").trim()).filter((t) => t.length >= 4);
    if (titles.length) ctx.memory = titles[Math.floor(Math.random() * titles.length)];
  } catch { /* the line still works without it */ }
  return ctx;
}

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
    const { v, photo, plus } = await step.run("load", async () => {
      const v = await loadVideo(id);
      // Plus members get the clean video directly: no watermark, no second HD pass.
      return { v, photo: (await firstPhoto(id)) ?? null, plus: v.user_id ? await isPlus(v.user_id) : false };
    });
    if (!photo) throw new Error("No hay foto");
    const long = v.mode === "full" || v.mode === "song";
    const song = v.mode === "song";

    // "Que se mueva": the real pet in a short scene (Kling reference-to-video). Plus-only, so the clip
    // is delivered clean right away (no watermarked preview).
    if (v.mode === "motion") {
      const scene = MOTION_SCENES[v.scenario] ?? MOTION_SCENES.baile;
      await progress(step, "videos", id, "20", { progress_step: "Estudiando a tu mascota...", progress_pct: 20 });
      const t0 = Date.now();
      const WAIT = "Grabando la escena (1 a 3 minutos)...";
      // Higgsfield (Seedance 2.5) when configured, otherwise / if it refuses: fal (Kling O1).
      const sub: { provider: "higgsfield" | "fal"; id: string; note?: string; dance?: boolean } = await step.run("motion-submit", async () => {
        const photoBuf = await loadImage(id, photo);
        // Thumbnails and the HD frame use the real photo (no watermark: Plus-only).
        await storage.put(id, "source.jpg", photoBuf, "image/jpeg");
        await storage.put(id, "source_hd.jpg", photoBuf, "image/jpeg");
        await db().from("videos").update({ progress_step: WAIT, progress_pct: 35 }).eq("id", id);
        const errors: string[] = [];
        if (hf.higgsfieldEnabled()) {
          try {
            // Dances: real choreography (our source video) transferred onto the pet.
            const choreo = scene.choreo ? await danceSourceUrl(v.scenario) : null;
            if (choreo) return { provider: "higgsfield" as const, dance: true, id: await hf.submitMotionTransfer(choreo, photoBuf, scene.prompt) };
            return { provider: "higgsfield" as const, id: await hf.submitMotion(photoBuf, scene.prompt, MOTION_SECONDS) };
          } catch (e) {
            if (!(e instanceof hf.PermanentHiggsfieldError)) throw e;
            errors.push(e.message);
          }
        }
        try {
          return { provider: "fal" as const, id: await fal.submitMotion(photoBuf, scene.prompt, MOTION_SECONDS), note: errors.join(" · ") || undefined };
        } catch (e) {
          // A refused key or empty balance won't fix itself on retry: fail now instead of after minutes.
          if (e instanceof fal.PermanentFalError) throw new NonRetriableError([...errors, e.message].join(" · "));
          throw e;
        }
      });
      const tick = creepingProgress("videos", id, WAIT, 35, 95);
      let url = "";
      let used: { provider: "higgsfield" | "fal"; dance?: boolean } = sub;
      let hfFailure: string | null = null;
      if (sub.provider === "higgsfield") {
        for (let i = 0; i < 72 && !url && !hfFailure; i++) {
          const st: hf.HfState = await step.run(`motion-hf-status-${i}`, async () => { await tick(i * 5); return hf.status(sub.id); });
          if (st.state === "COMPLETED") url = st.url!;
          else if (st.state === "FAILED") hfFailure = st.error ?? "falló";
          else await step.sleep(`motion-hf-wait-${i}`, "5s");
        }
        if (!url && !hfFailure) hfFailure = "tardó demasiado";
        // Higgsfield blocked or lost the clip (e.g. its content-safety filter): try fal's Kling before giving up.
        if (hfFailure) {
          const falId: string | null = await step.run("motion-fal-fallback-submit", async () => {
            await db().from("videos").update({ progress_step: "Probando con otro estudio...", progress_pct: 40 }).eq("id", id);
            try {
              return await fal.submitMotion(await loadImage(id, photo), scene.prompt, MOTION_SECONDS);
            } catch (e) {
              if (e instanceof fal.PermanentFalError) return null;
              throw e;
            }
          });
          if (!falId) throw new NonRetriableError(`Higgsfield: ${hfFailure}`);
          url = await awaitFal(step, "motion-fal-fallback", fal.FAL_MOTION_MODEL, falId, 60, creepingProgress("videos", id, WAIT, 40, 95));
          used = { provider: "fal" };
        }
      } else {
        url = await awaitFal(step, "motion-fal", fal.FAL_MOTION_MODEL, sub.id, 60, tick);
      }
      await step.run("motion-save", async () => {
        const bytes = used.provider === "higgsfield" ? await hf.download(url) : await fal.download(url);
        await storage.put(id, "preview.mp4", bytes, "video/mp4");
        const model = used.dance ? `higgsfield/${hf.HF_GENJUTSU_MODEL}` : used.provider === "higgsfield" ? `higgsfield/${hf.HF_MOTION_MODEL}` : fal.FAL_MOTION_MODEL;
        const cost = used.dance ? hf.HF_GENJUTSU_COST_PER_SEC * DANCE_SECONDS : (used.provider === "higgsfield" ? hf.HF_MOTION_COST_PER_SEC : fal.FAL_MOTION_COST_PER_SEC) * MOTION_SECONDS;
        await logGeneration({ ownerId: id, step: "motion_video", model: hfFailure ? `${model} (Higgsfield: ${hfFailure.slice(0, 80)})` : model, costUsd: cost, durationMs: Date.now() - t0 });
        await db().from("videos").update({ status: "paid", paid_at: new Date().toISOString(), preview_file: "preview.mp4", clean_file: "preview.mp4", line: scene.label, progress_pct: 100, progress_step: "¡Listo!" }).eq("id", id);
        await track("result_ready", { feature: "video", deviceId: v.device_id, userId: v.user_id, props: { mode: "motion", scene: v.scenario } });
      });
      return { ok: true };
    }

    // The voice (line + speech) and the watermarked frame don't depend on each other: run them together.
    await Promise.all([
      step.run("line-and-voice", async () => {
        await db().from("videos").update({ progress_step: song ? "Componiendo su canción..." : "Escuchando a tu mascota...", progress_pct: 20 }).eq("id", id);
        let text: string, species: string, usage = null;
        const tLine = Date.now();
        if (song) {
          const style = SONG_STYLES[v.scenario] ?? SONG_STYLES.pop;
          const b64 = await imageToB64(id, photo, 512);
          ({ lyrics: text, species, usage } = await writePetSong(b64, v.pet_name, style.feel, await lineContext(v)));
          await db().from("videos").update({ line: text, species, progress_step: "Grabando la canción (esto toma un minuto)...", progress_pct: 35 }).eq("id", id);
          const tMusic = Date.now();
          const audio = await composeSong(text, style.styles, SONG_SECONDS * 1000);
          await storage.put(id, "audio.mp3", audio, "audio/mpeg");
          await logGeneration({ ownerId: id, step: "song_lyrics", model: llmModel(true), usage, costUsd: usage ? llmCost(usage, true) : 0, durationMs: tMusic - tLine });
          await logGeneration({ ownerId: id, step: "song_music", model: SONG_MODEL, costUsd: SONG_COST_USD, durationMs: Date.now() - tMusic });
          return;
        }
        if (v.message) {
          text = String(v.message).trim().slice(0, TALK_MESSAGE_MAX);
          species = v.species || "otro";
        } else {
          const hint = v.scenario ? TALK_SCENARIOS[v.scenario]?.hint : null;
          const b64 = await imageToB64(id, photo, 512);
          ({ line: text, species, usage } = await writePetLine(b64, v.pet_name, long ? "long" : "mini", hint, await lineContext(v)));
        }
        await db().from("videos").update({ line: text, species, progress_step: "Buscando la voz perfecta...", progress_pct: 40 }).eq("id", id);
        const lineMs = Date.now() - tLine;
        await ensureVoices();
        const tVoice = Date.now();
        const audio = await generateNarration(text, validVoice(v.voice_id), 1.0, env.talkVoiceModel);
        const voiceMs = Date.now() - tVoice;
        await storage.put(id, "audio.mp3", audio, "audio/mpeg");
        await logGeneration({ ownerId: id, step: "talk_line", model: v.message ? "owner-message" : llmModel(true), usage, costUsd: usage ? llmCost(usage, true) : 0, durationMs: lineMs });
        await logGeneration({ ownerId: id, step: "talk_voice", model: env.talkVoiceModel, durationMs: voiceMs });
      }),
      step.run("source", async () => {
        const src = await talkSource(await loadImage(id, photo), !plus, long ? 720 : 480, BRAND_NAME);
        await storage.put(id, "source.jpg", src, "image/jpeg");
      }),
    ]);

    const gen = await lipsyncToStorage(step, "lipsync", id, "source.jpg", "preview.mp4", false, 60);
    await step.run("done", async () => {
      await logGeneration({ ownerId: id, step: "talk_video", model: gen.model, costUsd: env.talkVideoCostPerSec * (song ? SONG_SECONDS : long ? 5 : 3), durationMs: gen.ms });
      await db().from("videos").update(plus
        ? { status: "paid", paid_at: new Date().toISOString(), preview_file: "preview.mp4", clean_file: "preview.mp4", progress_pct: 100, progress_step: "¡Listo!" }
        : { status: "preview_ready", preview_file: "preview.mp4", progress_pct: 100, progress_step: "¡Listo!" }).eq("id", id);
      await track("result_ready", { feature: "video", deviceId: v.device_id, userId: v.user_id, props: { mode: v.mode } });
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
