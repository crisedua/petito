import { db } from "@/lib/server/db";
import * as fal from "@/lib/server/fal";
import * as eleven from "@/lib/server/elevenvideo";
import { EV } from "./client";

type Step = {
  run: <T>(id: string, fn: () => Promise<T> | T) => Promise<any>;
  waitForEvent: (id: string, opts: { event: string; timeout: string; if?: string }) => Promise<unknown>;
  sleep: (id: string, time: string) => Promise<void>;
};

/** Called while waiting on a provider, with roughly how many seconds have passed. */
export type Tick = (elapsedSec: number) => Promise<void>;

/** Progress that keeps creeping from `from` toward `to` while a long render runs (never reaches `to`). */
export const creepingProgress = (table: "stories" | "portraits" | "videos", id: string, text: string, from: number, to: number): Tick =>
  async (sec) => {
    const pct = Math.round(from + (to - from) * (1 - Math.exp(-sec / 75)));
    await db().from(table).update({ progress_step: text, progress_pct: pct }).eq("id", id);
  };

/** Write progress to a job row (each call is its own memoized step). */
export const progress = (step: Step, table: "stories" | "portraits" | "videos", id: string, key: string, patch: Record<string, unknown>) =>
  step.run(`progress-${key}`, async () => {
    await db().from(table).update(patch).eq("id", id);
  });

/**
 * Wait for a fal request: check status, otherwise sleep until fal's webhook wakes us or 15 s pass,
 * then check again. Returns the output URL. Throws on failure or after `rounds × 15 s`.
 */
export async function awaitFal(step: Step, key: string, endpoint: string, requestId: string, rounds = 30, tick?: Tick): Promise<string> {
  for (let i = 0; i < rounds; i++) {
    const st: fal.FalState = await step.run(`${key}-status-${i}`, async () => {
      if (tick) await tick(i * 15);
      return fal.status(endpoint, requestId);
    });
    if (st === "COMPLETED") return step.run(`${key}-result`, () => fal.resultUrl(endpoint, requestId));
    if (st === "FAILED") throw new Error(`Generation failed (${key})`);
    await step.waitForEvent(`${key}-wait-${i}`, { event: EV.falResult, timeout: "15s", if: `async.data.request_id == "${requestId}"` });
  }
  throw new Error(`Generation timed out (${key})`);
}

/** Wait for an ElevenLabs video generation by polling (docs: at most once every 10 s). Returns the output URL. */
export async function awaitElevenVideo(step: Step, key: string, generationId: string, rounds = 60, tick?: Tick): Promise<string> {
  for (let i = 0; i < rounds; i++) {
    const st: eleven.VideoState = await step.run(`${key}-status-${i}`, async () => {
      if (tick) await tick(i * 10);
      return eleven.status(generationId);
    });
    if (st.state === "COMPLETED" && st.url) return st.url;
    if (st.state === "FAILED") throw new Error(`Generation failed (${key}): ${st.error ?? ""}`);
    await step.sleep(`${key}-sleep-${i}`, "10s");
  }
  throw new Error(`Generation timed out (${key})`);
}
