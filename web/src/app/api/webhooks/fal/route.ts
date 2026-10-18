import { inngest, EV } from "@/inngest/client";

/**
 * fal.ai completion webhook. The payload is NOT trusted: it only wakes the waiting job, which then
 * reads status and result from fal with our own API key. A forged call can only cause an early check.
 */
export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const requestId = typeof body?.request_id === "string" ? body.request_id : null;
  if (requestId && /^[\w-]{6,80}$/.test(requestId)) {
    await inngest.send({ name: EV.falResult, data: { request_id: requestId } });
  }
  return Response.json({ received: true });
}
