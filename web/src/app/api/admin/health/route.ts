import { GlobalFonts } from "@napi-rs/canvas";
import sharp from "sharp";
import { handler, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import * as storage from "@/lib/server/storage";
import { llmModel, llmProvider } from "@/lib/server/llm";
import { voices } from "@/lib/server/elevenlabs";
import { talkSource } from "@/lib/render/watermarks";

export const maxDuration = 60;

type Check = { ok: boolean; detail?: unknown; ms?: number };

async function check(fn: () => Promise<unknown>): Promise<Check> {
  const t0 = Date.now();
  try {
    return { ok: true, detail: await fn(), ms: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, detail: String(e?.message ?? e).slice(0, 400), ms: Date.now() - t0 };
  }
}

/**
 * Admin-only self-test of every dependency. No secrets are returned, only whether they are set and
 * whether each service answers. Open /api/admin/health while signed in as an admin.
 */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const set = (v: string | undefined) => (v ? "set" : "MISSING");

  const config = {
    NEXT_PUBLIC_SUPABASE_URL: set(env.supabaseUrl),
    SUPABASE_SERVICE_ROLE_KEY: set(env.supabaseServiceKey),
    PUBLIC_BASE_URL: env.publicBaseUrl || "MISSING",
    ADMIN_EMAILS: env.adminEmails.size ? `${env.adminEmails.size} email(s)` : "MISSING",
    llm: `${llmProvider()} / ${llmModel()}`,
    ANTHROPIC_API_KEY: set(env.anthropicKey),
    OPENAI_API_KEY: set(env.openaiKey),
    ELEVENLABS_API_KEY: set(env.elevenKey),
    ELEVENLABS_VOICES: process.env.ELEVENLABS_VOICES ? voices().map((v) => v.label) : "default list",
    LIPSYNC_PROVIDER: `${env.talkVideoProvider} (${env.talkVideoProvider === "fal" ? `${env.falLipsyncModel}, HD ${env.falLipsyncHdModel}` : "creatify-aurora"})`,
    TALK_VOICE_MODEL: env.talkVoiceModel,
    fast_text_model: llmModel(true),
    FAL_KEY: set(env.falKey),
    INNGEST_EVENT_KEY: set(process.env.INNGEST_EVENT_KEY),
    INNGEST_SIGNING_KEY: set(process.env.INNGEST_SIGNING_KEY),
    PAYMENT_MODE: env.paymentMode,
    MERCADOPAGO_ACCESS_TOKEN: set(env.mpToken),
    MOCK_AI: env.mockAi ? "ON (must be off in production)" : "off",
  };

  const [database, mediaStorage, renderer, elevenlabsAccount, elevenlabsVideo, publicBase] = await Promise.all([
    check(async () => {
      const { count, error } = await db().from("app_users").select("user_id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return { users: count };
    }),
    check(async () => {
      const name = `health_${Date.now()}.txt`;
      await storage.put("health", name, Buffer.from("ok"), "text/plain");
      const back = (await storage.get("health", name)).buf.toString();
      await storage.remove("health", [name]);
      if (back !== "ok") throw new Error("read-back mismatch");
      return "write/read/delete ok";
    }),
    check(async () => {
      const img = await sharp({ create: { width: 400, height: 600, channels: 3, background: "#c96" } }).jpeg().toBuffer();
      const out = await talkSource(img, true, 384);
      const fonts = GlobalFonts.families.map((f) => f.family).filter((f) => /Fredoka|Jakarta|Caveat/.test(f));
      if (fonts.length < 6) throw new Error(`fonts loaded: ${fonts.join(", ") || "none"} (expected 6; assets/fonts not bundled?)`);
      return { jpeg_bytes: out.length, fonts };
    }),
    check(async () => {
      if (!env.elevenKey) throw new Error("ELEVENLABS_API_KEY missing");
      const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": env.elevenKey } });
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
      const d = await r.json();
      return { tier: d.tier, characters_used: d.character_count, characters_limit: d.character_limit, status: d.status };
    }),
    check(async () => {
      if (env.talkVideoProvider !== "elevenlabs") return "not used (lip-sync runs on fal; ElevenLabs is only the fallback)";
      if (!env.elevenKey) throw new Error("ELEVENLABS_API_KEY missing");
      const r = await fetch("https://api.elevenlabs.io/v1/flows/video?page_size=1", { headers: { "xi-api-key": env.elevenKey } });
      const text = (await r.text()).slice(0, 200);
      if (r.status === 402) throw new Error(`plan too low for video (needs Pro or above): ${text}`);
      if (text.includes("invalid_api_key")) throw new Error("ELEVENLABS_API_KEY is invalid");
      if (r.status === 401 || r.status === 403) throw new Error(`API key lacks the Image & Video permission: ${text}`);
      if (!r.ok) throw new Error(`${r.status}: ${text}`);
      return "video API reachable";
    }),
    check(async () => {
      if (!env.publicBaseUrl) throw new Error("PUBLIC_BASE_URL missing");
      const r = await fetch(`${env.publicBaseUrl}/api`, { signal: AbortSignal.timeout(10_000) });
      const body = await r.text();
      if (!body.includes('"app":"Petito"')) throw new Error(`${env.publicBaseUrl} does not answer like this app (still pointing at the old site?)`);
      return `${env.publicBaseUrl} → this app`;
    }),
  ]);

  const { data: recent } = await db().from("videos").select("id, share_slug, mode, status, progress_step, progress_pct, error, created_at, expires_at")
    .order("created_at", { ascending: false }).limit(5);
  const ids = (recent ?? []).map((v) => v.id);
  const { data: logs } = ids.length
    ? await db().from("generation_logs").select("owner_id, step, model, duration_ms, created_at").in("owner_id", ids)
    : { data: [] as any[] };
  // expires_at is set to (moment generation started + retention days), so it gives the start time.
  const timing = (vid: string, expires: string | null) => {
    const mine = (logs ?? []).filter((l) => l.owner_id === vid);
    const pick = (step: string) => mine.find((l) => l.step === step);
    const sec = (ms?: number | null) => (ms == null ? null : Math.round(ms / 100) / 10);
    const video = pick("talk_video");
    return {
      line_s: sec(pick("talk_line")?.duration_ms), voice_s: sec(pick("talk_voice")?.duration_ms),
      video_s: sec(video?.duration_ms), video_model: video?.model ?? null,
      total_s: video && expires ? sec(new Date(video.created_at).getTime() - (new Date(expires).getTime() - env.retentionDays * 86400_000)) : null,
    };
  };

  const checks = { database, storage: mediaStorage, renderer, elevenlabs_account: elevenlabsAccount, elevenlabs_video: elevenlabsVideo, public_base_url: publicBase };
  return json({
    ok: Object.values(checks).every((c) => c.ok),
    config,
    checks,
    recent_videos: (recent ?? []).map((v) => ({ ...v, created_at: iso(v.created_at), seconds: timing(v.id, v.expires_at) })),
  });
});
