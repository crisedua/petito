import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: env.anthropicKey }));

export type ClaudeUsage = { input_tokens: number; output_tokens: number };

/** USD per million tokens [input, output]. */
const MODEL_PRICING: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export function claudeCost(usage: ClaudeUsage | null | undefined, model = env.claudeModel): number {
  if (!usage) return 0;
  const [inp, out] = MODEL_PRICING[model] ?? MODEL_PRICING["claude-opus-5-5"];
  return (usage.input_tokens * inp + usage.output_tokens * out) / 1_000_000;
}

/**
 * One-turn Claude call (system + one user message with optional JPEG images), the same contract as
 * the legacy `_run_claude`: returns the concatenated text and the token usage.
 * Short JSON-producing tasks, so effort is low; refusals fall back server-side to a suitable model.
 */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

export async function runClaude(system: string, text: string, imagesB64: string[] = [], model = env.claudeModel) {
  if (env.mockAi) return mockClaude(imagesB64.length);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...imagesB64.map((data) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
    })),
    { type: "text" as const, text },
  ];
  const stream = anthropic().beta.messages.stream({
    model,
    max_tokens: 4096,
    system,
    output_config: { effort: "low" },
    // Server-side refusal fallback exists for the larger models only.
    ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    messages: [{ role: "user", content }],
  } as Anthropic.Beta.MessageCreateParamsStreaming);
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude declined the request");
  const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return { text: out, usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens } as ClaudeUsage };
}

/** Port of `_extract_json`: strip code fences, take the first balanced object/array. */
export function extractJson<T = any>(raw: string): T {
  let text = raw.trim().replace(/^```(?:json)?/, "").trim().replace(/```$/, "").trim();
  for (const [opener, closer] of [["{", "}"], ["[", "]"]] as const) {
    const start = text.indexOf(opener);
    if (start === -1) continue;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === opener) depth++;
      else if (text[i] === closer) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return JSON.parse(text);
}

/** MOCK_AI fixture: one JSON object that satisfies every prompt's expected keys. */
function mockClaude(nImages: number) {
  const selected = Array.from({ length: Math.max(1, nImages) }, (_, i) => ({ photo_index: i, slide_order: i, score: 8, scene_description: `escena ${i}` }));
  const text = JSON.stringify({
    best_photo_index: 0, selected,
    title: "Mi gran aventura", captions: selected.map(() => "¡Hola! Soy el más regalón de la casa."), stickers: selected.map(() => "¡Regalón!"),
    species: "perro", line: "¡Hola humano! Te quiero un montón, ¿me das pancito?",
    intro: "Max llegó para llenar de cariño cada día. Este es el comienzo de su universo. 🐾",
    reflection: "Qué lindo guardar este momento. Algunos instantes se quedan en el corazón para siempre. 🤍",
  });
  return { text, usage: { input_tokens: 500, output_tokens: 120 } as ClaudeUsage };
}
