import { defaultVoiceId, ensureVoices, voices } from "@/lib/server/elevenlabs";
import { handler, json } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { BRAND_NAME, BRAND_URL, MEMORIAL_STYLES, PORTRAIT_STYLES, TALK_MESSAGE_MAX, TALK_SCENARIOS, TALK_SCENARIO_GROUPS, THEMES, TRAITS, PORTRAIT_FRAMES, STYLE_DEFAULT_FRAME, SONG_STYLES, SONG_SECONDS, MOTION_SCENES } from "@/lib/catalogs";

export const GET = handler(async () => {
  await ensureVoices();
  return json({
    price_clp: env.priceClp,
    brand_name: BRAND_NAME,
    brand_url: BRAND_URL,
    payment_mode: env.paymentMode === "mercadopago" && env.mpToken ? "mercadopago" : "demo",
    bonus_enabled: env.bonusEnabled,
    free_mode: env.freeMode,
    bonus_scenes_count: env.bonusScenesCount,
    narration_enabled: env.narrationEnabled,
    voices: voices(),
    narration_default_voice: defaultVoiceId(),
    free_per_day: env.freePerDay,
    retention_days: env.retentionDays,
    themes: Object.entries(THEMES).filter(([, v]) => !v.hidden).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji })),
    traits: TRAITS,
    portrait_price_clp: env.portraitPriceClp,
    portrait_styles: Object.entries(PORTRAIT_STYLES).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji, desc: v.desc, mode: v.mode ?? "paint", group: v.group ?? "pintura", has_frame: (v.mode ?? "paint") === "paint", default_frame: STYLE_DEFAULT_FRAME[key] ?? "dorado" })),
    portrait_frames: Object.entries(PORTRAIT_FRAMES).map(([key, v]) => ({ key, label: v.label, desc: v.desc })),
    memorial_styles: Object.entries(MEMORIAL_STYLES).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji, desc: v.desc })),
    talk_price_clp: env.talkPriceClp,
    free_talk_per_day: env.freeTalkPerDay,
    talk_scenarios: Object.entries(TALK_SCENARIOS).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji, group: v.group ?? "dedicar" })),
    talk_scenario_groups: TALK_SCENARIO_GROUPS,
    talk_message_max: TALK_MESSAGE_MAX,
    song_styles: Object.entries(SONG_STYLES).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji })),
    song_seconds: SONG_SECONDS,
    motion_scenes: Object.entries(MOTION_SCENES).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji, dance: Boolean(v.choreo) })),
    plus_monthly_clp: env.plusMonthlyClp,
    plus_annual_clp: env.plusAnnualClp,
    plus_pro_monthly_clp: env.plusProMonthlyClp,
    plus_pro_annual_clp: env.plusProAnnualClp,
    plus_pro_monthly_videos: env.plusProMonthlyVideos,
  });
});
