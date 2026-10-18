import { db } from "@/lib/server/db";
import * as fal from "@/lib/server/fal";
import { EV } from "./client";

type Step = {
  run: <T>(id: string, fn: () => Promise<T> | T) => Promise<any>;
  waitForEvent: (id: string, opts: { event: string; timeout: string; if?: string }) => Promise<unknown>;
};

/** Write progress to a job row (each call is its own memoized step). */
export const progress = (step: Step, table: "stories" | "portraits" | "videos", id: string, key: string, patch: Record<string, unknown>) =>
  step.run(`progress-${key}`, async () => {
    await db().from(table).update(patch).eq("id", id);
  });

/**
 * Wait for a fal request: check status, otherwise sleep until fal's webhook wakes us (or a timeout),
 * then check again. Returns the output URL. Throws on failure or after ~`rounds × 3 min`.
 */
export async function awaitFal(step: Step, key: string, endpoint: string, requestId: string, rounds = 6): Promise<string> {
  for (let i = 0; i < rounds; i++) {
    const st: fal.FalState = await step.run(`${key}-status-${i}`, () => fal.status(endpoint, requestId));
    if (st === "COMPLETED") return step.run(`${key}-result`, () => fal.resultUrl(endpoint, requestId));
    if (st === "FAILED") throw new Error(`Generation failed (${key})`);
    await step.waitForEvent(`${key}-wait-${i}`, { event: EV.falResult, timeout: "3m", if: `async.data.request_id == "${requestId}"` });
  }
  throw new Error(`Generation timed out (${key})`);
}
