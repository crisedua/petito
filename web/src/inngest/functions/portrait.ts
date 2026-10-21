import { isPlus } from "@/lib/server/plus";
import { track } from "@/lib/server/events";
import { inngest, EV } from "../client";
import { awaitFal, progress } from "../helpers";
import { db, logGeneration } from "@/lib/server/db";
import * as fal from "@/lib/server/fal";
import * as storage from "@/lib/server/storage";
import { imageToB64, imageToDataUri } from "@/lib/server/images";
import { photoEditPrompt, portraitPrompt, writePetTitle } from "@/lib/server/prompts";
import { compareImage, namePlate } from "@/lib/render/plate";
import { renderPhotoStyle } from "@/lib/render/photoStyles";
import { loadImage } from "@/lib/server/images";
import * as hf from "@/lib/server/higgsfield";
import { defaultEngine, engineAvailable, photoEngine, submitEditWith, IMAGE_ENGINES } from "@/lib/server/imageEngines";
import { portraitPreview } from "@/lib/render/watermarks";
import { env } from "@/lib/server/env";
import { hex16 } from "@/lib/server/ids";
import { ALL_PORTRAIT_STYLES, BRAND_NAME, PORTRAIT_STYLES, frameFor, styleMode } from "@/lib/catalogs";

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
    const mode = p.category === "memorial" ? "paint" : styleMode(p.style);
    const t0 = Date.now();

    // "render" styles (polaroid, revista, antigua) are drawn by us from the real photo: no AI call.
    let url: string | null = null;
    let usedModel = env.falImageModel, usedProvider: "fal" | "higgsfield" = "fal";
    if (mode === "render") {
      await progress(step, "portraits", id, "40", { progress_step: "Revelando tu foto...", progress_pct: 40 });
    } else {
      await progress(step, "portraits", id, "20", { progress_step: mode === "edit" ? "Preparando tu foto..." : "Preparando el lienzo...", progress_pct: 20 });
      await progress(step, "portraits", id, "45", { progress_step: mode === "edit" ? "Retocando con cuidado..." : "Pintando a tu mascota...", progress_pct: 45 });
      const prompt = mode === "edit"
        ? photoEditPrompt("mascota", style.prompt)
        : portraitPrompt("mascota", p.category === "memorial" ? style.prompt : `${style.prompt}, ${frameFor(p.style, p.frame).prompt}`);
      const sub: { provider: "fal" | "higgsfield"; id: string; model: string } = await step.run("submit", async () => {
        let engine = mode === "edit" ? photoEngine() : await defaultEngine();
        if (!engineAvailable(engine)) engine = IMAGE_ENGINES.nano_banana;
        // Extra photos of the same pet help engines that take several references.
        const refs: Buffer[] = [await loadImage(id, photo)];
        if (p.pet_id) {
          const { data: pet } = await db().from("pets").select("id, photo_file").eq("id", p.pet_id).maybeSingle();
          if (pet?.photo_file) refs.push(await loadImage(pet.id, pet.photo_file));
        }
        return submitEditWith(engine, refs, prompt);
      });
      if (sub.provider === "fal") url = await awaitFal(step, "portrait", sub.model, sub.id, 20);
      else {
        for (let i = 0; i < 40 && !url; i++) {
          const st: hf.HfState = await step.run(`portrait-hf-status-${i}`, () => hf.status(sub.id));
          if (st.state === "COMPLETED") url = st.url!;
          else if (st.state === "FAILED") throw new Error(`Higgsfield: ${st.error ?? "falló"}`);
          else await step.sleep(`portrait-hf-wait-${i}`, "4s");
        }
        if (!url) throw new Error("Higgsfield tardó demasiado");
      }
      usedModel = sub.model; usedProvider = sub.provider;
    }

    await progress(step, "portraits", id, "80", { progress_step: mode === "paint" ? "Poniéndole el marco..." : "Últimos detalles...", progress_pct: 80 });
    // Photo-based styles get a brass name plate with a funny Chilean title ("Michi, Duquesa de Viña").
    const title: string = mode === "edit" && p.category !== "memorial"
      ? await step.run("title", async () => writePetTitle(await imageToB64(id, photo), p.pet_name))
      : "";
    await step.run("save", async () => {
      const sharp = (await import("sharp")).default;
      let clean = url
        ? await sharp(usedProvider === "higgsfield" ? await hf.download(url) : await fal.download(url)).jpeg({ quality: 94 }).toBuffer()
        : await renderPhotoStyle(p.style, await loadImage(id, photo), p.pet_name);
      if (title) clean = await namePlate(clean, title);
      const cleanName = `clean_${hex16()}.jpg`;
      const preview = await portraitPreview(clean, BRAND_NAME);
      await storage.put(id, cleanName, clean, "image/jpeg");
      await storage.put(id, "preview.jpg", preview, "image/jpeg");
      // Before-and-after in one image: the watermarked one for everyone, the clean one once unlocked.
      if (p.category !== "memorial") {
        const original = await loadImage(id, photo);
        await storage.put(id, "compare.jpg", await compareImage(original, preview), "image/jpeg");
        await storage.put(id, `compare_${cleanName}`, await compareImage(original, clean), "image/jpeg");
      }
      await logGeneration({ ownerId: id, step: "portrait", model: url ? usedModel : "petito-renderer", images: 1, costUsd: url ? (Object.values(IMAGE_ENGINES).find((e) => e.model === usedModel)?.costUsd ?? fal.FAL_IMG_COST) : 0, durationMs: Date.now() - t0 });
      // Plus members get it unlocked right away (no watermarked preview shown to them).
      const plus = p.user_id ? await isPlus(p.user_id) : false;
      await db().from("portraits").update({
        status: plus ? "paid" : "preview_ready", ...(plus ? { paid_at: new Date().toISOString() } : {}),
        preview_file: "preview.jpg", clean_file: cleanName, progress_pct: 100, progress_step: "¡Listo!",
      }).eq("id", id);
      await track("result_ready", { feature: p.category === "memorial" ? "memorial" : "portrait", deviceId: p.device_id, userId: p.user_id, props: { style: p.style } });
    });
    return { ok: true };
  },
);
