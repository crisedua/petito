/**
 * Claude prompts, ported verbatim from backend/ai_pipeline.py (Chilean Spanish voice, never invent facts).
 * Post-processing (caption padding, sticker length, fallbacks) matches the legacy behaviour.
 */
import { extractJson, type ClaudeUsage } from "./anthropic";
import { runLlm as runClaude } from "./llm";

type Selected = { photo_index: number; slide_order?: number; score?: number; scene_description?: string };

export async function selectPhotos(photosB64: string[], petName: string, species: string, traits: string[], themeLabel: string) {
  const system =
    "Eres un editor visual experto para historias de mascotas. Analizas fotos y " +
    "respondes SOLO con JSON válido, sin texto adicional.";
  const n = photosB64.length;
  const want = Math.max(3, Math.min(8, n));
  const prompt =
    `Mascota: ${petName} (${species}). Rasgos: ${traits.join(", ") || "ninguno"}. ` +
    `Tema de la historia: ${themeLabel}.\n` +
    `Te muestro ${n} fotos numeradas de 0 a ${n - 1} en orden.\n` +
    `Puntúa cada foto de 0 a 10 según: mascota visible, nitidez, emoción y variedad. ` +
    `Elige las mejores ${want} fotos (o menos si hay pocas buenas) y ordénalas en un arco ` +
    `narrativo coherente para el tema. La primera debe ser una gran foto de apertura.\n` +
    `Responde JSON: {"best_photo_index": <int>, "selected": [{"photo_index": <int>, ` +
    `"slide_order": <int desde 0>, "score": <float>, "scene_description": "<breve>"}]}`;
  const { text, usage } = await runClaude(system, prompt, photosB64);
  const data = extractJson<{ best_photo_index?: number; selected: Selected[] }>(text);
  let sel = [...(data.selected ?? [])].sort((a, b) => (a.slide_order ?? 0) - (b.slide_order ?? 0));
  sel = sel.filter((s) => Number(s.photo_index) >= 0 && Number(s.photo_index) < n).slice(0, 8);
  let best = Number(data.best_photo_index ?? (sel[0]?.photo_index ?? 0));
  if (!(best >= 0 && best < n)) best = sel[0] ? Number(sel[0].photo_index) : 0;
  return { selected: sel, best, usage };
}

export async function writeCaptions(petName: string, species: string, traits: string[], themeLabel: string, scenes: string[]) {
  const system =
    "Eres un copywriter chileno experto en humor cálido y tierno. Escribes en primera " +
    "persona como si fueras la mascota. Español de Chile, modismos suaves (regalón, " +
    "pancito, siesta, choro, aperrado), sin groserías ni humor ofensivo. Respondes SOLO JSON válido.";
  const k = scenes.length;
  const list = scenes.map((d, i) => `${i}. ${d}`).join("\n");
  const prompt =
    `Soy ${petName}, un ${species}. Mis rasgos: ${traits.join(", ") || "muy regalón"}. ` +
    `Tema: ${themeLabel}.\n` +
    `Hay ${k} diapositivas con estas escenas:\n${list}\n\n` +
    `Entrega: (1) un título corto y pegajoso para la historia (máx 5 palabras); ` +
    `(2) para CADA diapositiva una frase en primera persona como la mascota, cálida y divertida, ` +
    `máximo 18 palabras, usando mi nombre a veces; ` +
    `(3) para CADA diapositiva un 'sticker': una expresión MUY corta de 1 a 3 palabras tipo grito ` +
    `de historia de Instagram (ej: '¡Qué regalón!', '¡Modo siesta!', '¡Tiki tiki ti!', '¡Pancito ya!').\n` +
    `Responde JSON: {"title": "<título>", "captions": ["..." x${k}], "stickers": ["..." x${k}]} ` +
    `con exactamente ${k} captions y ${k} stickers.`;
  const { text, usage } = await runClaude(system, prompt);
  const data = extractJson<{ title?: string; captions?: string[]; stickers?: string[] }>(text);
  const caps = [...(data.captions ?? [])];
  const stks = [...(data.stickers ?? [])];
  while (caps.length < k) caps.push(`¡${petName} aquí, pasándolo regio!`);
  while (stks.length < k) stks.push("¡Regalón!");
  const title = data.title || `La historia de ${petName}`;
  return { title, captions: caps.slice(0, k), stickers: stks.slice(0, k).map((s) => String(s).slice(0, 22)), usage };
}

export type LineContext = { toName?: string | null; personality?: string[] | null; memory?: string | null; species?: string | null };

export async function writePetLine(photoB64: string, petName: string | null, length: "mini" | "short" | "long" = "short", scenarioHint?: string | null, ctx: LineContext = {}) {
  const system =
    "Eres un comediante chileno que le pone voz a las mascotas. Hablas en primera persona " +
    "como si fueras la mascota de la foto. Español de Chile, cálido y chistoso, con modismos " +
    "suaves (regalón, pancito, choro, aperrado, bacán, al tiro), sin groserías ni humor " +
    "ofensivo. Respondes SOLO JSON válido.";
  // Video render time grows with clip length, so full videos use a ~5 s line (was 20–26 words, ~8 s).
  const dedicated = Boolean(ctx.toName);
  const words = { mini: "6 a 9", short: "11 a 15", long: dedicated ? "16 a 22" : "12 a 16" }[length] ?? "11 a 15";
  const nameTxt = petName ? `Mi nombre es ${petName}. ` : "";
  const intent = scenarioHint ? `La frase debe ser ${scenarioHint}. ` : "Inventa UNA sola frase graciosa en primera persona ";
  // What makes it unmistakably THIS pet talking to THIS person: their name, its personality, a real memory.
  const extras =
    (dedicated ? `El mensaje es para ${ctx.toName}: háblale directamente y dile su nombre al principio. ` : "") +
    (ctx.personality?.length ? `Mi personalidad: ${ctx.personality.join(", ")}; que se note. ` : "") +
    (ctx.memory ? `Si calza, menciona de pasada este recuerdo real nuestro: "${ctx.memory}". ` : "");
  const prompt =
    `Mira la foto de esta mascota. ${nameTxt}` +
    `Identifica si es perro, gato u otro. ${intent}${extras}` +
    `que la mascota diría mirando a la cámara en un video, de ${words} palabras, ` +
    `con tono cálido y chileno. Usa el nombre si lo tienes.\n` +
    `Responde JSON: {"species": "perro|gato|otro", "line": "<frase>"}`;
  let text = "", usage: Awaited<ReturnType<typeof runClaude>>["usage"] | null = null;
  try {
    ({ text, usage } = await runClaude(system, prompt, [photoB64], true));
  } catch (e) {
    // A failed line must not sink the whole video: fall back to the stock line below.
    console.error("writePetLine failed, using fallback line", e);
  }
  let data: { species?: string; line?: string } = {};
  try { data = text ? extractJson<{ species?: string; line?: string }>(text) : {}; } catch { data = {}; }
  const line = (data.line ?? "").trim() || (ctx.toName ? `¡${ctx.toName}! Soy ${petName || "tu regalón"} y te quiero un montón.` : `¡Hola! Soy ${petName || "tu regalón"}, el más choro de la casa.`);
  return { line, species: data.species || "otro", usage };
}

export const bonusScenePrompt = (species: string, bonusPrompt: string) =>
  `Transform this exact ${species} into a fun stylized portrait: ${bonusPrompt}. ` +
  `Critically preserve the pet's real fur colors, markings, breed and face so it is ` +
  `clearly the same pet. Cute, warm, high quality, vertical composition.`;

export const portraitPrompt = (species: string, stylePrompt: string) =>
  `Transform this exact ${species} into ${stylePrompt}. ` +
  `CRITICAL: preserve the pet's real fur colors, markings, breed and facial features so it ` +
  `is unmistakably the same pet. The pet's face must stay clearly visible and centered. ` +
  `Luxurious, elegant, high quality, vertical portrait composition.`;

/** Photo-edit styles: the photograph stays a photograph; the model only adds what the style says. */
export const photoEditPrompt = (species: string, stylePrompt: string) =>
  `This is a real photograph of a ${species}. Keep the photo exactly as it is: the same animal, pose, ` +
  `expression, fur, colors, markings, lighting and camera angle, fully photorealistic, not a painting ` +
  `or illustration. Make only this change: ${stylePrompt}. The result must look like a real photo ` +
  `taken of this same pet, sharp and natural, vertical 3:4 composition, no text, no frame.`;

export const petIntroFallback = (name: string) =>
  `${name} llegó para llenar de cariño cada día. Este es el comienzo de su universo, donde cada recuerdo tendrá su lugar. 🐾`;

export async function writePetIntro(photoB64: string, name: string, species: string, personalityLabel: string, favoriteMemory?: string | null) {
  const system =
    "Eres un narrador chileno cálido y tierno que da la bienvenida a la mascota de una familia " +
    "a su propio 'universo' en Petito. Escribes en segundo nivel emocional, en español de Chile, " +
    "con cariño y sin groserías. REGLA CLAVE: nunca inventes hechos reales (ni edad, ni raza exacta, " +
    "ni historias que no te dieron); habla de sentimientos, personalidad y el vínculo. " +
    "Respondes SOLO JSON válido.";
  const especie = ({ perro: "perrito", gato: "gatito" } as Record<string, string>)[species] ?? "mascota";
  const memo = favoriteMemory ? ` Un recuerdo que su familia atesora: ${favoriteMemory}.` : "";
  const prompt =
    `La mascota se llama ${name}, es un ${especie}. Su personalidad: ${personalityLabel || "muy regalón"}.${memo}\n` +
    `Mira su foto y escribe una bienvenida corta y emotiva (2 a 3 frases, máx 45 palabras en total) ` +
    `dirigida a su familia, celebrando que ${name} ahora tiene su propio universo de recuerdos. ` +
    `Cálida, chilena, tierna, sin inventar datos. Usa su nombre.\n` +
    `Responde JSON: {"intro": "<bienvenida>"}`;
  const { text, usage } = await runClaude(system, prompt, [photoB64]);
  let intro = "";
  try {
    intro = (extractJson<{ intro?: string }>(text).intro ?? "").trim();
  } catch {
    intro = text.trim();
  }
  return { intro: intro || petIntroFallback(name), usage };
}

export const reflectionFallback = (petName: string) =>
  `Qué lindo guardar este momento con ${petName}. Algunos instantes se quedan en el corazón para siempre. 🤍`;

export async function writeMemoryReflection(petName: string, title: string, feelingText: string | null, emotionLabels: string, photoB64?: string | null) {
  const system =
    "Eres Petito, una voz cálida y tierna que acompaña los recuerdos de una familia con su mascota, " +
    "en español de Chile. Escribes un pensamiento breve y emotivo (NO un hecho). " +
    "REGLA CLAVE: nunca inventes datos ni hechos nuevos; solo acompaña y refleja con cariño lo que la " +
    "persona ya contó y sintió. Sin groserías. Respondes SOLO JSON válido.";
  const emo = emotionLabels ? ` Emociones que marcó: ${emotionLabels}.` : "";
  const told = feelingText ? feelingText.trim() : "";
  const prompt =
    `La familia guardó un recuerdo de su mascota ${petName}, titulado: "${title}".${emo}\n` +
    `Lo que escribió la persona: "${told || "(no escribió texto)"}"\n` +
    `Escribe un pensamiento cálido y tierno (1 a 2 frases, máx 35 palabras) que acompañe esa emoción, ` +
    `sin inventar hechos, como un abrazo en palabras. Puedes usar el nombre.\n` +
    `Responde JSON: {"reflection": "<pensamiento>"}`;
  const { text, usage } = await runClaude(system, prompt, photoB64 ? [photoB64] : []);
  let reflection = "";
  try {
    reflection = (extractJson<{ reflection?: string }>(text).reflection ?? "").trim();
  } catch {
    reflection = text.trim();
  }
  return { reflection: reflection || reflectionFallback(petName), usage: usage as ClaudeUsage };
}
