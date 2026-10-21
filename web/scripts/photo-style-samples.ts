/** Renders the built-in samples for the no-AI photo styles from the example dog: public/portrait-styles/{polaroid,revista,antigua}.jpg */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderPhotoStyle } from "../src/lib/render/photoStyles";

(async () => {
  const dog = await readFile(path.join(__dirname, "..", "assets", "sample-pets", "dog.jpg"));
  for (const style of ["polaroid", "revista", "antigua"]) {
    const out = path.join(__dirname, "..", "public", "portrait-styles", `${style}.jpg`);
    await writeFile(out, await renderPhotoStyle(style, dog, "Rocco"));
    console.log("wrote", out);
  }
})();
