/**
 * Funnel analytics. Server code records the steps it knows for sure (photo uploaded, result ready,
 * paywall, checkout, paid, signup); the browser reports visits and which feature was opened
 * (POST /api/events). Recording never throws and never slows a request down meaningfully.
 */
import { after } from "next/server";
import { db } from "./db";
import { deviceId } from "./http";

export type EventName =
  | "visit" | "view_feature" | "share_open" | "install" | "login" | "signup"
  | "photo_uploaded" | "result_ready" | "paywall" | "checkout_started" | "paid";
export type Feature = "video" | "portrait" | "memorial" | "story" | "memory" | "friends" | "pet" | "plus";

export const CLIENT_EVENTS = new Set<EventName>(["visit", "view_feature", "share_open", "install", "login"]);
export const FEATURES = new Set<Feature>(["video", "portrait", "memorial", "story", "memory", "friends", "pet", "plus"]);

type Opts = { feature?: Feature | string | null; deviceId?: string | null; userId?: string | null; props?: Record<string, unknown>; req?: Request };

export async function track(name: EventName, o: Opts = {}): Promise<void> {
  try {
    const device = (o.deviceId ?? (o.req ? deviceId(o.req) : "")) || null;
    const { error } = await db().from("events").insert({
      name,
      feature: o.feature && FEATURES.has(o.feature as Feature) ? o.feature : null,
      device_id: device ? device.slice(0, 80) : null,
      user_id: o.userId ?? null,
      props: o.props ?? {},
    });
    if (error && !/relation .*events.* does not exist|schema cache/i.test(error.message)) console.warn("track failed", name, error.message);
  } catch (e) {
    console.warn("track failed", name, e);
  }
}

/** The feature an owner most recently hit the paywall or started checkout from (for crediting a payment). */
export async function lastCheckoutFeature(userId: string): Promise<string | null> {
  try {
    const { data } = await db().from("events").select("feature").eq("user_id", userId)
      .in("name", ["checkout_started", "paywall"]).not("feature", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return (data?.feature as string) ?? null;
  } catch {
    return null;
  }
}

/** Record after the response is sent (keeps the request fast; Vercel keeps the function alive for it). */
export function trackLater(name: EventName, o: Opts = {}) {
  // Read what we need from the request now: it may not be usable once the response is gone.
  const opts = { ...o, deviceId: o.deviceId ?? (o.req ? deviceId(o.req) || null : null), req: undefined };
  try {
    after(() => track(name, opts));
  } catch {
    void track(name, opts); // outside a request (scripts): best effort
  }
}
