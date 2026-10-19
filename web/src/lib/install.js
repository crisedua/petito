"use client";
// "Add to home screen" state shared by the banner and the profile menu. Android/desktop Chrome hand us
// a `beforeinstallprompt` event we can trigger later; iPhone only allows doing it by hand from Safari's
// Share menu, so there we show instructions.

let deferred = null;
let installed = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function subscribeInstall(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initInstall() {
  if (typeof window === "undefined" || window.__petitoInstallInit) return;
  window.__petitoInstallInit = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own banner instead of the browser's mini-infobar
    deferred = e;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export const canPromptNatively = () => Boolean(deferred);

/** Opens the browser's own install dialog (Android/desktop Chrome). Resolves true if accepted. */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  emit();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice?.outcome === "accepted";
  } catch {
    return false;
  }
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return installed || window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

/** Which instructions fit this device and browser. */
export function platform() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|TikTok|musical_ly|Twitter|Snapchat|LinkedInApp|Pinterest|GSA\//i.test(ua);
  if (inApp) return ios ? "ios-inapp" : "android-inapp";
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/i.test(ua)) return /SamsungBrowser/i.test(ua) ? "android-samsung" : "android";
  return "desktop";
}

export const isMobile = () => platform() !== "desktop";

const DISMISS_KEY = "petito_install_dismissed";
export function dismissedRecently(days = 14) {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < days * 86_400_000;
  } catch {
    return false;
  }
}
export function rememberDismiss() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
}
