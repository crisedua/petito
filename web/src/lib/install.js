"use client";
// "Add to home screen" state shared by the landing card, the banner and the profile menu.
//
// Chromium browsers (Chrome, Edge, Samsung Internet, Opera, on Android and desktop) fire
// `beforeinstallprompt` once, very early in page load; a tiny script in the root layout catches it
// into window.__petitoBIP before React starts, so a later tap can open the real install dialog.
// Safari (iPhone/iPad/Mac) and Firefox give websites no install API at all: there we show the
// steps for that exact browser.

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function subscribeInstall(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initInstall() {
  if (typeof window === "undefined" || window.__petitoInstallInit) return;
  window.__petitoInstallInit = true;
  // The layout script already captured it if it fired before us; keep listening in case it fires later.
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); window.__petitoBIP = e; emit(); });
  window.addEventListener("petito:bip", emit);
  window.addEventListener("appinstalled", () => { window.__petitoInstalled = true; window.__petitoBIP = null; emit(); });
}

export const canPromptNatively = () => typeof window !== "undefined" && Boolean(window.__petitoBIP);

/** Chrome may not have offered the dialog yet when someone taps right after the page opens. */
function waitForPrompt(ms) {
  if (canPromptNatively()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const t = setTimeout(() => { off(); resolve(canPromptNatively()); }, ms);
    const off = subscribeInstall(() => { if (canPromptNatively()) { clearTimeout(t); off(); resolve(true); } });
  });
}

/**
 * Opens the browser's own install dialog when this browser has one. Returns
 * "accepted" | "dismissed" | "unavailable".
 */
export async function promptInstall() {
  if (!supportsNativeInstall()) return "unavailable";
  if (!(await waitForPrompt(1500))) return "unavailable";
  const e = window.__petitoBIP;
  window.__petitoBIP = null; // each event can only be used once
  emit();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice?.outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    return "unavailable";
  }
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return Boolean(window.__petitoInstalled) || window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

/** True when Chrome/Edge report Petipo is already installed on this device (manifest related_applications). */
export async function checkInstalled() {
  if (isStandalone()) return true;
  try {
    const apps = await navigator.getInstalledRelatedApps?.();
    return Boolean(apps && apps.length);
  } catch {
    return false;
  }
}

/** Which instructions fit this device and browser. */
export function platform() {
  if (typeof navigator === "undefined") return "desktop-other";
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|TikTok|musical_ly|Twitter|Snapchat|LinkedInApp|Pinterest|GSA\//i.test(ua);
  if (inApp) return ios ? "ios-inapp" : "android-inapp";
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/i.test(ua)) {
    if (/SamsungBrowser/i.test(ua)) return "android-samsung";
    if (/Firefox/i.test(ua)) return "android-firefox";
    if (/Chrome\//i.test(ua)) return "android"; // Chrome, Edge, Opera, Brave… (all Chromium)
    return "android-other";
  }
  if (/Edg\//i.test(ua)) return "desktop-edge";
  if (/Firefox\//i.test(ua)) return "desktop-firefox";
  if (/Chrome\//i.test(ua)) return "desktop-chrome";
  if (/Safari\//i.test(ua) && /Macintosh/i.test(ua)) return "desktop-safari";
  return "desktop-other";
}

export const isMobile = () => !platform().startsWith("desktop");

/** Browsers that let a website open the install dialog (all Chromium-based). */
export const supportsNativeInstall = () => ["android", "android-samsung", "desktop-chrome", "desktop-edge"].includes(platform());

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
