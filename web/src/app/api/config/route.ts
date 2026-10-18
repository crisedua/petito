import { defaultVoiceId, ensureVoices, voices } from "@/lib/server/elevenlabs";
import { handler, json } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { BRAND_NAME, BRAND_URL, MEMORIAL_STYLES, PORTRAIT_STYLES, TALK_MESSAGE_MAX, TALK_SCENARIOS, THEMES, TRAITS } from "@/lib/catalogs";

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
    themes: Object.entries(THEMES).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji })),
    traits: TRAITS,
    portrait_price_clp: env.portraitPriceClp,
    portrait_styles: Object.entries(PORTRAIT_STYLES).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji, desc: v.desc })),
    memorial_styles: Object.entries(MEMORIAL_STYLES).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji, desc: v.desc })),
    talk_price_clp: env.talkPriceClp,
    free_talk_per_day: env.freeTalkPerDay,
    talk_scenarios: Object.entries(TALK_SCENARIOS).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji })),
    talk_message_max: TALK_MESSAGE_MAX,
    plus_monthly_clp: env.plusMonthlyClp,
    plus_annual_clp: env.plusAnnualClp,
  });
});
