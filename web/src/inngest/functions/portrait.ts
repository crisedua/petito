import { inngest, EV } from "../client";
import { awaitFal, progress } from "../helpers";
import { db, logGeneration } from "@/lib/server/db";
import * as fal from "@/lib/server/fal";
import * as storage from "@/lib/server/storage";
import { imageToDataUri } from "@/lib/server/images";
import { portraitPrompt } from "@/lib/server/prompts";
import { portraitPreview } from "@/lib/render/watermarks";
import { env } from "@/lib/server/env";
import { hex16 } from "@/lib/server/ids";
import { ALL_PORTRAIT_STYLES, BRAND_NAME, PORTRAIT_STYLES } from "@/lib/catalogs";

/** Port of run_portrait_pipeline: photo → fal oil/watercolour portrait → clean HD + watermarked preview. */
export const generatePortrait = inngest.createFunction(
  {
    id: "portrait-generate",
    triggers: [{ event: EV.portraitGenerate }],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const id = (event.data as any).event?.data?.portrait_id;
      if (id) await db().from("portraits").update({ status: "failed", error: String(error?.message ?? error), progress_step: "Algo salió mal", progress_pct: 0 }).eq("id", id);
    },
  },
  async ({ event, step }) => {
    const id: string = (event.data as any).portrait_id;
    const p = await step.run("load", async () => (await db().from("portraits").select("*").eq("id", id).single()).data!);
    const photo: string | null = await step.run("photo", async () =>
      (await db().from("portrait_photos").select("file").eq("portrait_id", id).limit(1).maybeSingle()).data?.file ?? null);
    if (!photo) throw new Error("No hay foto");
    const style = ALL_PORTRAIT_STYLES[p.style] ?? Object.values(PORTRAIT_STYLES)[0];

    await progress(step, "portraits", id, "20", { progress_step: "Preparando el lienzo...", progress_pct: 20 });
    await progress(step, "portraits", id, "45", { progress_step: "Pintando a tu mascota...", progress_pct: 45 });
    const t0 = Date.now();
    const requestId: string = await step.run("submit", async () =>
      fal.submitEdit(await imageToDataUri(id, photo), portraitPrompt("mascota", style.prompt), "3:4"));
    const url = await awaitFal(step, "portrait", env.falImageModel, requestId, 4);

    await progress(step, "portraits", id, "80", { progress_step: "Poniéndole el marco dorado...", progress_pct: 80 });
    await step.run("save", async () => {
      const sharp = (await import("sharp")).default;
      const clean = await sharp(await fal.download(url)).jpeg({ quality: 94 }).toBuffer();
      const cleanName = `clean_${hex16()}.jpg`;
      await storage.put(id, cleanName, clean, "image/jpeg");
      await storage.put(id, "preview.jpg", await portraitPreview(clean, BRAND_NAME), "image/jpeg");
      await logGeneration({ ownerId: id, step: "portrait", model: env.falImageModel, images: 1, costUsd: fal.FAL_IMG_COST, durationMs: Date.now() - t0 });
      await db().from("portraits").update({
        status: "preview_ready", preview_file: "preview.jpg", clean_file: cleanName, progress_pct: 100, progress_step: "¡Listo!",
      }).eq("id", id);
    });
    return { ok: true };
  },
);
