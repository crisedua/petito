import { inngest, EV } from "../client";
import { awaitFal, progress } from "../helpers";
import { db, logGeneration } from "@/lib/server/db";
import * as fal from "@/lib/server/fal";
import * as storage from "@/lib/server/storage";
import { imageToB64, imageToDataUri, loadImage } from "@/lib/server/images";
import { bonusScenePrompt, selectPhotos, writeCaptions } from "@/lib/server/prompts";
import { llmCost, llmModel } from "@/lib/server/llm";
import { generateNarration } from "@/lib/server/elevenlabs";
import { addSlide } from "@/lib/server/stories";
import { decode, toJpeg } from "@/lib/render/core";
import { closingSlide, photoSlide, titleSlide } from "@/lib/render/slides";
import { env } from "@/lib/server/env";
import { BONUS_ORDER_BASE, BRAND_NAME, BRAND_URL, CLOSING_ORDER, SPECIES, THEMES, validVoice } from "@/lib/catalogs";

const loadStory = async (id: string) => (await db().from("stories").select("*").eq("id", id).single()).data!;

/** One narration mp3 per slide. Concurrency 3 across all runs (ElevenLabs BYOK limits). Best-effort. */
export const narrateSlide = inngest.createFunction(
  { id: "story-narrate-slide", concurrency: { limit: 3 }, retries: 2 },
  async ({ event, step }) => {
    const { story_id, ord, text, voice_id } = event.data as { story_id: string; ord: number; text: string; voice_id: string };
    if (!env.narrationEnabled || !text?.trim()) return { ok: false };
    return step.run("narrate", async () => {
      try {
        const audio = await generateNarration(text, validVoice(voice_id));
        const file = `narration_${ord}.mp3`;
        await storage.put(story_id, file, audio, "audio/mpeg");
        await db().from("slides").update({ audio_file: file }).eq("story_id", story_id).eq("ord", ord);
        return { ok: true };
      } catch (e) {
        console.warn(`Narration slide ${ord} skipped`, e);
        return { ok: false };
      }
    });
  },
);

const narrateAll = (step: any, storyId: string, voiceId: string, items: Array<{ ord: number; text: string }>) =>
  Promise.all(items.map((it) =>
    step.invoke(`narrate-${it.ord}`, { function: narrateSlide, data: { story_id: storyId, ord: it.ord, text: it.text, voice_id: voiceId } })));

/** Magic scenes (fal image edit) streamed into the live story; then narrated. */
export const generateBonusScenes = inngest.createFunction(
  { id: "story-bonus-scenes", retries: 1 },
  async ({ event, step }) => {
    const { story_id, best_file } = event.data as { story_id: string; best_file: string };
    const story = await step.run("load", () => loadStory(story_id));
    const scenes = (THEMES[story.theme] ?? Object.values(THEMES)[0]).bonus_scenes.slice(0, env.bonusScenesCount);
    const species = SPECIES[story.species] ?? "mascota";
    const t0 = Date.now();

    const submitScene = (i: number, attempt: number): Promise<string> =>
      step.run(`submit-${i}-${attempt}`, async () =>
        fal.submitEdit(await imageToDataUri(story_id, best_file), bonusScenePrompt(species, scenes[i].prompt), "9:16"));

    // all scenes in parallel at fal; one retry for any that fail
    const ids: string[] = await Promise.all(scenes.map((_, i) => submitScene(i, 0)));
    const urls = await Promise.all(scenes.map(async (_, i) => {
      try {
        return await awaitFal(step, `bonus-${i}`, env.falImageModel, ids[i], 4);
      } catch {
        try {
          return await awaitFal(step, `bonus-${i}-retry`, env.falImageModel, await submitScene(i, 1), 4);
        } catch (e) {
          console.warn(`Bonus scene ${i} skipped`, e);
          return null;
        }
      }
    }));

    const created: Array<{ ord: number; text: string }> = [];
    for (let i = 0; i < scenes.length; i++) {
      const url = urls[i];
      if (!url) continue;
      const cap = scenes[i].caption.replaceAll("{name}", story.pet_name);
      const ord = BONUS_ORDER_BASE + i;
      await step.run(`render-bonus-${i}`, async () => {
        const img = await decode(await fal.download(url));
        await addSlide(story_id, "bonus", await toJpeg(photoSlide(img, cap, scenes[i].sticker, story.pet_name, BRAND_NAME, story.theme, i), 90), ord, cap);
      });
      created.push({ ord, text: cap });
    }
    await step.run("finish", async () => {
      if (created.length) {
        await logGeneration({ ownerId: story_id, step: "bonus_scenes", model: env.falImageModel, images: created.length, costUsd: fal.FAL_IMG_COST * created.length, durationMs: Date.now() - t0 });
      }
      await db().from("stories").update({ bonus_pending: false, progress_step: "¡Tu historia está lista!" }).eq("id", story_id);
    });
    if (env.narrationEnabled && created.length) await narrateAll(step, story_id, story.voice_id, created);
    return { created: created.length };
  },
);

/** Port of run_pipeline: select photos → captions → render + publish → narration ‖ bonus scenes. */
export const generateStory = inngest.createFunction(
  {
    id: "story-generate",
    triggers: [{ event: EV.storyGenerate }],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const id = (event.data as any).event?.data?.story_id;
      if (id) await db().from("stories").update({ status: "failed", error: String(error?.message ?? error), progress_step: "Algo salió mal", progress_pct: 0, bonus_pending: false, narration_pending: false }).eq("id", id);
    },
  },
  async ({ event, step }) => {
    const id: string = (event.data as any).story_id;
    const story = await step.run("load", () => loadStory(id));
    const photos: Array<{ idx: number; file: string }> = await step.run("photos", async () =>
      (await db().from("story_photos").select("idx, file").eq("story_id", id).order("idx", { ascending: true })).data ?? []);
    if (!photos.length) throw new Error("No hay fotos");
    const theme = THEMES[story.theme] ?? Object.values(THEMES)[0];
    const species = SPECIES[story.species] ?? "mascota";

    await progress(step, "stories", id, "25", { progress_step: "Eligiendo tus mejores fotos...", progress_pct: 25 });
    const sel = await step.run("select-photos", async () => {
      const t0 = Date.now();
      const b64s = await Promise.all(photos.map((p) => imageToB64(id, p.file)));
      const r = await selectPhotos(b64s, story.pet_name, species, story.traits ?? [], theme.label);
      await logGeneration({ ownerId: id, step: "selection", model: llmModel(), usage: r.usage, costUsd: llmCost(r.usage), durationMs: Date.now() - t0 });
      return { selected: r.selected, best: r.best };
    });

    await progress(step, "stories", id, "55", { progress_step: "Escribiendo tu historia con humor chileno...", progress_pct: 55 });
    const copy = await step.run("write-captions", async () => {
      const t0 = Date.now();
      const r = await writeCaptions(story.pet_name, species, story.traits ?? [], theme.label, sel.selected.map((s: any) => s.scene_description ?? ""));
      await logGeneration({ ownerId: id, step: "captions", model: llmModel(), usage: r.usage, costUsd: llmCost(r.usage), durationMs: Date.now() - t0 });
      return { title: r.title, captions: r.captions, stickers: r.stickers };
    });
    const bestFile = (photos[sel.best] ?? photos[0]).file;

    await progress(step, "stories", id, "85", { progress_step: "Diseñando tus diapositivas...", progress_pct: 85 });
    await step.run("delete-slides", async () => { await db().from("slides").delete().eq("story_id", id); });
    await step.run("render-title", async () => {
      const cover = await decode(await loadImage(id, bestFile));
      await addSlide(id, "title", await toJpeg(titleSlide(copy.title, story.pet_name, theme.label, BRAND_NAME, cover, story.theme), 90), 0, "", false);
    });
    for (let i = 0; i < sel.selected.length; i++) {
      await step.run(`render-photo-${i}`, async () => {
        const file = photos[Number(sel.selected[i].photo_index)]?.file ?? photos[0].file;
        const src = await decode(await loadImage(id, file));
        const cap = copy.captions[i] ?? "";
        await addSlide(id, "photo", await toJpeg(photoSlide(src, cap, copy.stickers[i] ?? "", story.pet_name, BRAND_NAME, story.theme, i), 90), 1 + i, cap);
      });
    }
    await step.run("render-closing", async () => {
      await addSlide(id, "closing", await toJpeg(closingSlide(BRAND_NAME, BRAND_URL, story.theme), 90), CLOSING_ORDER);
    });

    const bonus = Boolean(story.bonus_enabled && env.bonusEnabled);
    const narrate = env.narrationEnabled;
    await step.run("publish", async () => {
      await db().from("stories").update({
        status: "preview_ready", title: copy.title, progress_pct: 100, bonus_pending: bonus, narration_pending: narrate,
        progress_step: bonus ? "Agregando escenas mágicas..." : "¡Tu historia está lista!",
      }).eq("id", id);
    });

    // Narration and magic scenes stream in while the person already watches the story.
    const work: Promise<unknown>[] = [];
    if (narrate) {
      work.push(narrateAll(step, id, story.voice_id, [{ ord: 0, text: copy.title }, ...copy.captions.map((c: string, i: number) => ({ ord: 1 + i, text: c }))]));
    }
    if (bonus) work.push(step.invoke("bonus-scenes", { function: generateBonusScenes, data: { story_id: id, best_file: bestFile } }).catch((e: unknown) => console.warn("bonus failed", e)));
    await Promise.all(work);
    if (narrate) await step.run("narration-done", async () => { await db().from("stories").update({ narration_pending: false }).eq("id", id); });
    if (bonus) await step.run("bonus-done", async () => { await db().from("stories").update({ bonus_pending: false }).eq("id", id); });
    return { ok: true };
  },
);
