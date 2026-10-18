import { fail, handler, json, readJson } from "./http";
import { requireUser } from "./auth";
import { saveOriginal } from "./images";
import { signRawUploads, readUploads } from "./uploads";
import { mediaPath } from "./storage";
import type { Ctx } from "./route";

type Resolver = (id: string, userId: string) => Promise<{ id: string }>;

/** POST …/photo/sign → signed browser-upload URLs for the owning row. */
export const signRoute = (resolve: Resolver) =>
  handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
    const user = await requireUser(req);
    const row = await resolve((await ctx.params).id, user.user_id);
    const { count } = await readJson<{ count?: number }>(req);
    return json(await signRawUploads(row.id, count ?? 1));
  });

/** POST …/photo → process the single uploaded photo into orig_0.jpg and store it on the row. */
export const photoRoute = (resolve: Resolver, save: (id: string, file: string) => Promise<void>) =>
  handler(async (req: Request, ctx: Ctx<{ id: string }>) => {
    const user = await requireUser(req);
    const row = await resolve((await ctx.params).id, user.user_id);
    const [raw] = await readUploads(req, row.id, 1);
    if (!raw) throw fail(400, "Sube una foto");
    let name: string;
    try {
      name = await saveOriginal(row.id, 0, raw);
    } catch (e) {
      console.error("photo processing failed", e);
      throw fail(400, "No pudimos leer esta foto. Prueba con otra (JPG, PNG o foto de iPhone).");
    }
    await save(row.id, name);
    return json({ ok: true, photo_url: mediaPath(row.id, name) });
  });
