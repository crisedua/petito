/**
 * ElevenLabs Music: a short sung song from our own lyrics (POST /v1/music with a composition plan).
 * Used for "Tu mascota te canta". Returns MP3 bytes.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

export const SONG_MODEL = process.env.SONG_MODEL ?? "music_v2_5";
/** Credits aren't published per second; this is a conservative admin-panel estimate. */
export const SONG_COST_USD = Number(process.env.SONG_COST_USD ?? "0.30");

export async function composeSong(lyrics: string, styles: string[], durationMs: number): Promise<Buffer> {
  if (env.mockAi) return readFile(path.join(process.cwd(), "assets", "mock", "voice.mp3"));
  if (!env.elevenKey) throw new Error("ELEVENLABS_API_KEY no está configurada");
  const ms = Math.max(3000, Math.min(120000, Math.round(durationMs)));
  const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": env.elevenKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      model_id: SONG_MODEL,
      composition_plan: {
        chunks: [{
          text: lyrics,
          duration_ms: ms,
          positive_styles: ["spanish vocals", "clear sung lyrics, every word intelligible", ...styles],
          negative_styles: ["instrumental only", "spoken word", "rap mumbling", "english"],
          context_adherence: "high",
        }],
      },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs Music ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error("ElevenLabs Music returned no audio");
  return buf;
}
