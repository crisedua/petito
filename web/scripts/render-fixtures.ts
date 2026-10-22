/** Renders every slide kind per theme to an output dir for a visual check. Usage: tsx scripts/render-fixtures.ts <photo.jpg> <outdir> */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decode, toJpeg } from "../src/lib/render/core";
import { closingSlide, photoSlide, titleSlide } from "../src/lib/render/slides";
import { makeLocked, portraitPreview, talkSource } from "../src/lib/render/watermarks";
import { THEMES } from "../src/lib/catalogs";

const [photoPath, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const raw = readFileSync(photoPath);
(async () => {
  const img = await decode(raw);
  for (const theme of Object.keys(THEMES)) {
    const t = titleSlide("La gran siesta del año", "Max", THEMES[theme].label, "Petipo", img, theme);
    writeFileSync(path.join(out, `${theme}_title.jpg`), await toJpeg(t, 85));
    const p0 = photoSlide(img, "Hoy me comí la pantufla de mi humano y no me arrepiento de nada.", "¡Modo siesta!", "Max", "Petipo", theme, 0);
    const p0buf = await toJpeg(p0, 85);
    writeFileSync(path.join(out, `${theme}_photo0.jpg`), p0buf);
    writeFileSync(path.join(out, `${theme}_photo1.jpg`), await toJpeg(photoSlide(img, "Me pongo regio para la foto, como buen regalón.", "¡Qué regalón!", "Max", "Petipo", theme, 1), 85));
    writeFileSync(path.join(out, `${theme}_closing.jpg`), await toJpeg(closingSlide("Petipo", "petito.pro", theme), 85));
    if (theme === "mi_ano") writeFileSync(path.join(out, `locked.jpg`), await makeLocked(p0buf));
  }
  writeFileSync(path.join(out, "portrait_preview.jpg"), await portraitPreview(raw));
  writeFileSync(path.join(out, "talk_source_wm.jpg"), await talkSource(raw, true, 720));
  writeFileSync(path.join(out, "talk_source_hd.jpg"), await talkSource(raw, false, 1080));
  console.log("rendered to", out);
})();
