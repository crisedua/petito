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

export const llmModel = () => (llmProvider() === "openai" ? env.openaiModel : env.claudeModel);

export const runLlm = (system: string, text: string, imagesB64: string[] = []) =>
  llmProvider() === "openai" && !env.mockAi ? runOpenAI(system, text, imagesB64) : runClaude(system, text, imagesB64);

export const llmCost = (usage: LlmUsage | null | undefined) =>
  llmProvider() === "openai" ? openaiCost(usage) : claudeCost(usage);
