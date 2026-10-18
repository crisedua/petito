import { env } from "@/lib/server/env";
import { BUCKET } from "@/lib/server/storage";

/**
 * Serves private Storage objects at the same URL shape the legacy app used (/api/media/{owner}/{name}),
 * so every stored thumb/preview/clean URL keeps working and fal.ai gets plain public HTTPS inputs.
 * Byte-range requests are forwarded so <video> seeking works on iOS Safari.
 */
export async function GET(req: Request, ctx: { params: Promise<{ owner: string; name: string }> }) {
  const { owner, name } = await ctx.params;
  if (!owner || !name || name.includes("..") || name.includes("/") || owner.includes("..") || owner.includes("/")) {
    return Response.json({ detail: "Nombre inválido" }, { status: 400 });
  }
  const lower = name.toLowerCase();
  const upstream = `${env.supabaseUrl}/storage/v1/object/${BUCKET}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${env.supabaseServiceKey}`, apikey: env.supabaseServiceKey };
  const range = req.headers.get("range");
  if (range) headers.Range = range;
  const res = await fetch(upstream, { headers, cache: "no-store" });
  if (res.status === 404 || res.status === 400) return Response.json({ detail: "No encontrado" }, { status: 404 });
  if (!res.ok && res.status !== 206) return Response.json({ detail: "No encontrado" }, { status: 404 });

  const mime = lower.endsWith(".mp3") ? "audio/mpeg" : lower.endsWith(".mp4") ? "video/mp4" : res.headers.get("content-type") || "image/jpeg";
  const out = new Headers({ "Content-Type": mime, "Accept-Ranges": "bytes" });
  for (const h of ["content-length", "content-range", "etag", "last-modified"]) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  // clean_* names are unguessable and immutable; everything else may be regenerated.
  out.set("Cache-Control", name.startsWith("clean_") ? "public, max-age=31536000, immutable" : "private, max-age=3600");
  return new Response(res.body, { status: res.status, headers: out });
}
