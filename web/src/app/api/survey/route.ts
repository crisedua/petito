import { deviceId, handler, json, readJson } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { isoNow, newId } from "@/lib/server/ids";

export const POST = handler(async (req: Request) => {
  const b = await readJson<{ story_id?: string; answer?: unknown }>(req);
  const answer = ["yes", "si", "sí", "true", "1"].includes(String(b.answer).toLowerCase()) ? "yes" : "no";
  const device = deviceId(req);
  if (device) {
    const { data } = await db().from("survey_responses").select("id").eq("device_id", device).limit(1).maybeSingle();
    if (data) return json({ ok: true, already: true });
  }
  await db().from("survey_responses").insert({ id: newId(), device_id: device, story_id: b.story_id ?? "", answer, price_clp: 9900, created_at: isoNow() });
  return json({ ok: true, already: false });
});
