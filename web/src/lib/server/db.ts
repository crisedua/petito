import { createServiceClient } from "./supabase";
import { isoNow, newId } from "./ids";

export const db = () => createServiceClient();

/** Postgres timestamptz → ISO string, matching what the legacy API returned. */
export const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

type Usage = { input_tokens: number; output_tokens: number } | null | undefined;

/**
 * Port of server.py log_generation: records one AI call and adds its cost to the owner row
 * (story, portrait or video) when the owner has an ai_cost_usd column.
 */
export async function logGeneration(opts: {
  ownerId: string;
  step: string;
  model: string;
  usage?: Usage;
  images?: number;
  costUsd?: number;
  durationMs?: number;
}) {
  const cost = Number((opts.costUsd ?? 0).toFixed(6));
  await db().from("generation_logs").insert({
    id: newId(),
    owner_id: opts.ownerId,
    step: opts.step,
    model: opts.model,
    input_tokens: opts.usage?.input_tokens ?? 0,
    output_tokens: opts.usage?.output_tokens ?? 0,
    images: opts.images ?? 0,
    cost_usd: cost,
    duration_ms: opts.durationMs ?? 0,
    created_at: isoNow(),
  });
  if (cost > 0) {
    for (const table of ["stories", "portraits", "videos"] as const) {
      const { data } = await db().from(table).select("ai_cost_usd").eq("id", opts.ownerId).maybeSingle();
      if (data) {
        await db().from(table).update({ ai_cost_usd: Number(data.ai_cost_usd ?? 0) + cost }).eq("id", opts.ownerId);
        break;
      }
    }
  }
  return cost;
}
