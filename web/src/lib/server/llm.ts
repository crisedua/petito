/**
 * Text/vision model behind every prompt. Picks the provider from AI_PROVIDER, or from whichever
 * key is configured (Anthropic first). Both providers share the same call contract.
 */
import { env } from "./env";
import { claudeCost, runClaude, type ClaudeUsage } from "./anthropic";
import { openaiCost, runOpenAI } from "./openai";

export type LlmUsage = ClaudeUsage;

export const llmProvider = (): "anthropic" | "openai" => {
  if (env.aiProvider === "openai" || env.aiProvider === "anthropic") return env.aiProvider;
  return env.anthropicKey || !env.openaiKey ? "anthropic" : "openai";
};

/** `fast` picks the low-latency model for short, interactive text (e.g. the talking-video line). */
export const llmModel = (fast = false) =>
  llmProvider() === "openai" ? (fast ? env.openaiFastModel : env.openaiModel) : fast ? env.claudeFastModel : env.claudeModel;

export const runLlm = (system: string, text: string, imagesB64: string[] = [], fast = false) =>
  llmProvider() === "openai" && !env.mockAi
    ? runOpenAI(system, text, imagesB64, llmModel(fast))
    : runClaude(system, text, imagesB64, llmModel(fast));

export const llmCost = (usage: LlmUsage | null | undefined, fast = false) =>
  llmProvider() === "openai" ? openaiCost(usage, llmModel(fast)) : claudeCost(usage, llmModel(fast));
