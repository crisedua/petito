import OpenAI from "openai";
import { env } from "./env";
import type { ClaudeUsage as Usage } from "./anthropic";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: env.openaiKey }));

/** USD per million tokens [input, output]; approximate, used only for the admin cost panel. */
const PRICING: Record<string, [number, number]> = {
  "gpt-5": [1.25, 10],
  "gpt-5-mini": [0.25, 2],
  "gpt-5-nano": [0.05, 0.4],
  "gpt-4.1": [2, 8],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4o": [2.5, 10],
  "gpt-4o-mini": [0.15, 0.6],
};

export function openaiCost(usage: Usage | null | undefined, model = env.openaiModel): number {
  if (!usage) return 0;
  const [inp, out] = PRICING[model] ?? PRICING["gpt-5-mini"];
  return (usage.input_tokens * inp + usage.output_tokens * out) / 1_000_000;
}

/** Same contract as runClaude: system + one user message (text and optional JPEG images) → text + usage. */
export async function runOpenAI(system: string, text: string, imagesB64: string[] = []) {
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    ...imagesB64.map((data) => ({ type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${data}`, detail: "low" as const } })),
    { type: "text" as const, text },
  ];
  const res = await openai().chat.completions.create({
    model: env.openaiModel,
    max_completion_tokens: 4096,
    messages: [{ role: "system", content: system }, { role: "user", content }],
  });
  const choice = res.choices[0];
  if (!choice || choice.finish_reason === "content_filter") throw new Error("OpenAI declined the request");
  return {
    text: choice.message.content ?? "",
    usage: { input_tokens: res.usage?.prompt_tokens ?? 0, output_tokens: res.usage?.completion_tokens ?? 0 } as Usage,
  };
}
