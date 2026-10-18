import { randomBytes } from "node:crypto";
import * as storage from "./storage";
import { fail } from "./http";
import { MAX_UPLOAD_BYTES } from "./env";

const RAW_RE = /^raw_[a-f0-9]{12}_\d{1,2}$/;

/**
 * Step 1 of a browser upload: signed URLs so the browser PUTs raw files straight into Storage
 * (Vercel caps request bodies at 4.5 MB; photos can be up to 20 MB each).
 */
export async function signRawUploads(owner: string, count: number) {
  const n = Math.max(1, Math.min(20, Math.floor(count) || 1));
  const tag = randomBytes(6).toString("hex");
  const uploads = [];
  for (let i = 0; i < n; i++) {
    const name = `raw_${tag}_${i}`;
    const s = await storage.createSignedUploadUrl(owner, name);
    uploads.push({ name, path: s.path, token: s.token });
  }
  return { uploads };
}

/**
 * Step 2: collect the uploaded bytes. Accepts either `{raw: [names]}` (browser flow) or a multipart
 * body with `files` (small uploads, scripts and the legacy HTTP tests). Raw objects are deleted after reading.
 */
export async function readUploads(req: Request, owner: string, max = 20): Promise<Buffer[]> {
  const type = req.headers.get("content-type") ?? "";
  const out: Buffer[] = [];
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const f of form.getAll("files").slice(0, max)) {
      if (typeof f === "string") continue;
      if (f.size > MAX_UPLOAD_BYTES) throw fail(413, "La foto es muy pesada. Usa una de menos de 20 MB.");
      const buf = Buffer.from(await f.arrayBuffer());
      if (buf.length) out.push(buf);
    }
    return out;
  }
  let body: { raw?: unknown } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const names = Array.isArray(body.raw) ? body.raw.filter((n): n is string => typeof n === "string" && RAW_RE.test(n)).slice(0, max) : [];
  for (const name of names) {
    try {
      const { buf } = await storage.get(owner, name);
      if (buf.length > MAX_UPLOAD_BYTES) throw fail(413, "La foto es muy pesada. Usa una de menos de 20 MB.");
      if (buf.length) out.push(buf);
    } finally {
      await storage.remove(owner, [name]).catch(() => {});
    }
  }
  return out;
}
