/** Server-side configuration. Defaults mirror backend/server.py so behaviour is unchanged. */
const int = (name: string, def: number) => {
  const v = process.env[name];
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : def;
};
const bool = (name: string, def: boolean) => {
  const v = process.env[name];
  return v === undefined || v === "" ? def : v.toLowerCase() === "true";
};

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, ""),
  adminEmails: new Set(
    (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  ),
  // prices and limits
  priceClp: int("STORY_PRICE_CLP", 3990),
  portraitPriceClp: int("PORTRAIT_PRICE_CLP", 2990),
  talkPriceClp: int("TALK_PRICE_CLP", 2990),
  plusMonthlyClp: int("PLUS_MONTHLY_CLP", 3900),
  plusAnnualClp: int("PLUS_ANNUAL_CLP", 29900),
  // Plus+: everything in Plus, plus songs and motion/dance videos (they cost 3-5x a talking video).
  plusProMonthlyClp: int("PLUS_PRO_MONTHLY_CLP", 7990),
  plusProAnnualClp: int("PLUS_PRO_ANNUAL_CLP", 79900),
  // Monthly allowances (0 = no limit). Plus+ songs + motion videos; talking videos for both tiers.
  plusProMonthlyVideos: int("PLUS_PRO_MONTHLY_VIDEOS", 5),
  plusMonthlyTalks: int("PLUS_MONTHLY_TALKS", 0),
  usdToClp: int("USD_TO_CLP", 950),
  freePerDay: int("FREE_PREVIEWS_PER_DAY", 3),
  freeTalkPerDay: int("FREE_TALK_PER_DAY", 2),
  // "Pruébalo gratis": the no-account portrait on the landing. Per device per day, plus a global daily cap.
  freeTryPerDay: int("FREE_TRY_PER_DAY", 2),
  tryDailyCap: int("TRY_DAILY_CAP", 300),
  tryStyle: process.env.TRY_STYLE ?? "estudio",
  retentionDays: int("PHOTO_RETENTION_DAYS", 7),
  freeMode: bool("FREE_MODE", true),
  bonusEnabled: bool("BONUS_SCENES_ENABLED", true),
  bonusScenesCount: Math.max(1, Math.min(3, int("BONUS_SCENES_COUNT", 3))),
  // AI providers
  anthropicKey: (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY || process.env.CLAUDE_API_KEY || "").trim(),
  claudeModel: process.env.CLAUDE_MODEL ?? "claude-opus-5-5",
  openaiKey: (process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.CHATGPT_API_KEY || process.env.OPEN_AI_API_KEY || "").trim(),
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-5-mini",
  // Fast models for short, latency-sensitive text (the line a pet says in a talking video).
  claudeFastModel: process.env.CLAUDE_FAST_MODEL ?? "claude-haiku-5-5",
  openaiFastModel: process.env.OPENAI_FAST_MODEL ?? "gpt-5-mini",
  aiProvider: (process.env.AI_PROVIDER ?? "").toLowerCase(),
  falKey: process.env.FAL_KEY ?? "",
  falImageModel: process.env.FAL_IMAGE_MODEL ?? "fal-ai/nano-banana/edit",
  elevenKey: process.env.ELEVENLABS_API_KEY ?? "",
  // Lip-sync for talking videos: "fal" (VEED Fabric, fastest) or "elevenlabs" (Creatify Aurora). Default: fal when FAL_KEY is set.
  talkVideoProvider: ((process.env.LIPSYNC_PROVIDER ?? "").toLowerCase() === "elevenlabs" || ((process.env.LIPSYNC_PROVIDER ?? "").toLowerCase() !== "fal" && !process.env.FAL_KEY)) ? "elevenlabs" : "fal",
  falLipsyncModel: process.env.FAL_LIPSYNC_MODEL ?? "veed/fabric-1.0/fast",
  falLipsyncHdModel: process.env.FAL_LIPSYNC_HD_MODEL ?? "veed/fabric-1.0",
  // Voice for talking videos: ElevenLabs' low-latency model (story narration keeps NARRATION_MODEL).
  talkVoiceModel: process.env.TALK_VOICE_MODEL ?? "eleven_flash_v2_5",
  talkVideoCostPerSec: Number(process.env.TALK_VIDEO_COST_PER_SEC ?? "0.1333"),
  narrationModel: process.env.NARRATION_MODEL ?? "eleven_multilingual_v2",
  narrationEnabled: bool("NARRATION_ENABLED", true) && (Boolean(process.env.ELEVENLABS_API_KEY) || process.env.MOCK_AI === "1"),
  // payments
  paymentMode: process.env.PAYMENT_MODE ?? "demo",
  mpToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
  mpWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
  // Local development only: replace Claude/fal/ElevenLabs with fixtures (never in production).
  mockAi: process.env.MOCK_AI === "1" && process.env.NODE_ENV !== "production",
  // test-only auth bypass (never set in production)
  testSessionTokens: process.env.TEST_SESSION_TOKENS ?? "",
  allowTestTokens: process.env.NODE_ENV !== "production" || bool("ALLOW_TEST_TOKENS", false),
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
