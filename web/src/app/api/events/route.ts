import { handler, json, readJson } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/auth";
import { CLIENT_EVENTS, track, type EventName } from "@/lib/server/events";

/** Browser-reported funnel steps (visit, opened a feature, opened a shared link, installed, signed in). */
export const POST = handler(async (req: Request) => {
  const b = await readJson<{ name?: string; feature?: string; device_id?: string; props?: Record<string, unknown> }>(req);
  const name = String(b.name ?? "") as EventName;
  if (!CLIENT_EVENTS.has(name)) return json({ ok: false }, 400);
  const user = await getCurrentUser(req).catch(() => null);
  // Keep only short, flat string/number/boolean props.
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b.props ?? {}).slice(0, 12)) {
    if (typeof v === "string") props[k.slice(0, 40)] = v.slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean") props[k.slice(0, 40)] = v;
  }
  await track(name, { req, deviceId: req.headers.get("x-device-id") || b.device_id || null, userId: user?.user_id ?? null, feature: b.feature ?? null, props });
  return json({ ok: true });
});
