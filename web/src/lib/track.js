"use client";
// Browser side of the funnel: visits, which feature was opened, shared links opened, sign-in, install.
// Everything else (photo uploaded, result ready, paywall, checkout, paid) is recorded by the server.
import { getDeviceId } from "@/lib/api";

export function track(name, { feature, props } = {}) {
  try {
    const device = getDeviceId();
    fetch("/api/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", "X-Device-Id": device },
      body: JSON.stringify({ name, feature, device_id: device, props: props || {} }),
    }).catch(() => {});
  } catch { /* never break the page for analytics */ }
}

const once = (store, key) => {
  try {
    if (store.getItem(key)) return false;
    store.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
};
export const oncePerSession = (key) => typeof sessionStorage !== "undefined" && once(sessionStorage, key);
export const oncePerDay = (key) => typeof localStorage !== "undefined" && once(localStorage, `${key}:${new Date().toISOString().slice(0, 10)}`);

/** Where this visit came from: ?utm_source, ?from, the referring site, the installed app, or "directo". */
export function visitSource() {
  const q = new URLSearchParams(window.location.search);
  if (q.get("app") === "1") return { source: "app" };
  const utm = q.get("utm_source") || q.get("ref") || q.get("from");
  if (utm) return { source: utm.toLowerCase().slice(0, 40), medium: q.get("utm_medium") || "", campaign: q.get("utm_campaign") || "" };
  try {
    const host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
    if (host && !host.endsWith("petipop.pro") && host !== window.location.hostname) {
      const known = [["whatsapp", "whatsapp"], ["wa.me", "whatsapp"], ["instagram", "instagram"], ["facebook", "facebook"], ["fb.", "facebook"], ["tiktok", "tiktok"], ["google", "google"], ["t.co", "x"], ["twitter", "x"], ["x.com", "x"], ["youtube", "youtube"]];
      const k = known.find(([needle]) => host.includes(needle));
      return { source: k ? k[1] : host.slice(0, 40) };
    }
  } catch { /* ignore */ }
  return { source: "directo" };
}

// Page → funnel feature (the landing page's free video preview counts under "video" at upload time).
const FEATURE_ROUTES = [
  [/^\/hablar$/, "video"], [/^\/retrato$/, "portrait"], [/^\/recuerdo$/, "memorial"], [/^\/crear$/, "story"],
  [/^\/album(\/nuevo)?$/, "memory"], [/^\/amigos$/, "friends"], [/^\/plus$/, "plus"],
];
const SHARE_ROUTES = [[/^\/v\//, "video"], [/^\/r\//, "portrait"], [/^\/h\//, "story"], [/^\/u\//, "memory"], [/^\/amigos\/conectar\//, "friends"]];

export function featureForPath(path) {
  return FEATURE_ROUTES.find(([r]) => r.test(path))?.[1] ?? null;
}
export function shareFeatureForPath(path) {
  return SHARE_ROUTES.find(([r]) => r.test(path))?.[1] ?? null;
}
