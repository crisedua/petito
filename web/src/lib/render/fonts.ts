import path from "node:path";
import { GlobalFonts } from "@napi-rs/canvas";

/**
 * Static weight instances of the legacy variable fonts (Fredoka, Plus Jakarta Sans, Caveat), each
 * registered under its own family name because napi-rs/canvas can't select variable-font axes.
 */
const FILES = ["Fredoka600", "Fredoka700", "Jakarta600", "Jakarta700", "Jakarta800", "Caveat700"];
let loaded = false;

export function ensureFonts() {
  if (loaded) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  for (const f of FILES) GlobalFonts.registerFromPath(path.join(dir, `${f}.ttf`), f);
  loaded = true;
}

const pick = (family: string, weights: number[], w: number) =>
  `${family}${weights.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a))}`;

/** CSS font strings for ctx.font, mirroring display_font / body_font / script_font. */
export const displayFont = (size: number, weight = 600) => `${size}px ${pick("Fredoka", [600, 700], weight)}`;
export const bodyFont = (size: number, weight = 700) => `${size}px ${pick("Jakarta", [600, 700, 800], weight)}`;
export const scriptFont = (size: number, _weight = 700) => `${size}px Caveat700`;
