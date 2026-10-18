import { handler, json } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";

// Public troubleshooting view of the latest talking videos: state only, no photos, names, lines or links.
export const GET = handler(async () => {
  const { data: vids } = await db().from("videos").select("id, mode, status, progress_pct, progress_step, error, created_at")
    .neq("status", "draft").order("created_at", { ascending: false }).limit(8);
  const ids = (vids ?? []).map((v) => v.id);
  const { data: logs } = ids.length
    ? await db().from("generation_logs").select("owner_id, step, model, duration_ms, created_at").in("owner_id", ids)
    : { data: [] as any[] };
  const now = Date.now();
  return json({
    lipsync_provider: env.talkVideoProvider, fal_key_set: !!env.falKey, eleven_key_set: !!env.elevenKey,
    videos: (vids ?? []).map((v) => ({
      ref: v.id.slice(0, 6), mode: v.mode, status: v.status, pct: v.progress_pct, step: v.progress_step,
      error: v.error ? String(v.error).slice(0, 300) : null, age_s: Math.round((now - new Date(v.created_at).getTime()) / 1000),
      done_s: (() => { const l = (logs ?? []).find((x) => x.owner_id === v.id && x.step === "talk_video");
        return l ? Math.round((new Date(l.created_at).getTime() - new Date(v.created_at).getTime()) / 1000) : null; })(),
      steps: (logs ?? []).filter((l) => l.owner_id === v.id).map((l) => `${l.step}:${l.model}:${Math.round(l.duration_ms / 100) / 10}s`),
    })),
  });
});
