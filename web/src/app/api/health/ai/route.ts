import { handler, json } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { llmModel, llmProvider, runLlm } from "@/lib/server/llm";

export const maxDuration = 30;

// Public, cached for 5 minutes so it can't be used to run up the AI bill. Never returns keys.
let cached: { at: number; body: unknown } | null = null;

export const GET = handler(async () => {
  if (cached && Date.now() - cached.at < 5 * 60_000) return json(cached.body);
  const t0 = Date.now();
  let ok = false, error: string | null = null;
  try {
    const { text } = await runLlm("Responde solo JSON.", 'Responde {"ok": true}', [], true);
    ok = text.includes("ok");
  } catch (e: any) {
    error = String(e?.message ?? e).replace(/(sk-|key-)[\w-]+/g, "$1***").slice(0, 300);
  }
  const body = {
    provider: llmProvider(), fast_model: llmModel(true), ai_provider_setting: env.aiProvider || null,
    anthropic_key_set: !!env.anthropicKey, openai_key_set: !!env.openaiKey, ok, error, ms: Date.now() - t0,
  };
  cached = { at: Date.now(), body };
  return json(body);
});
