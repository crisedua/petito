import { createServiceClient } from "./supabase";
import { env } from "./env";

export const BUCKET = "media";
const key = (owner: string, name: string) => `${owner}/${name}`;

export async function put(owner: string, name: string, data: Buffer | Uint8Array, contentType: string) {
  const { error } = await createServiceClient().storage.from(BUCKET).upload(key(owner, name), data, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`storage put ${owner}/${name}: ${error.message}`);
  return name;
}

export async function get(owner: string, name: string): Promise<{ buf: Buffer; contentType: string }> {
  const { data, error } = await createServiceClient().storage.from(BUCKET).download(key(owner, name));
  if (error || !data) throw new Error(`storage get ${owner}/${name}: ${error?.message ?? "missing"}`);
  return { buf: Buffer.from(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
}

export async function exists(owner: string, name: string): Promise<boolean> {
  const { data } = await createServiceClient().storage.from(BUCKET).list(owner, { search: name, limit: 50 });
  return Boolean(data?.some((o) => o.name === name));
}

export async function remove(owner: string, names: string[]) {
  if (!names.length) return;
  await createServiceClient().storage.from(BUCKET).remove(names.map((n) => key(owner, n)));
}

/** Browser uploads go straight to Storage (Vercel bodies are capped at 4.5 MB). */
export async function createSignedUploadUrl(owner: string, name: string) {
  const { data, error } = await createServiceClient().storage.from(BUCKET).createSignedUploadUrl(key(owner, name), { upsert: true });
  if (error || !data) throw new Error(`signed upload: ${error?.message}`);
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

/** Absolute URL fal.ai (or any third party) can fetch; always goes through our media proxy. */
export const publicMediaUrl = (owner: string, name: string, base = env.publicBaseUrl) =>
  `${base}/api/media/${owner}/${name}`;

export const mediaPath = (owner: string, name: string) => `/api/media/${owner}/${name}`;
