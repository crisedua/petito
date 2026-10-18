import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { validVoice } from "@/lib/catalogs";

const API = "https://api.elevenlabs.io/v1/text-to-speech";

// Slow, clear and warm delivery (narration.py _VOICE_SETTINGS).
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true, speed: 0.8 };

/** ElevenLabs TTS (BYOK), same request as backend/narration.py. Returns MP3 bytes. */
export async function generateNarration(text: string, voiceId: string, speed?: number): Promise<Buffer> {
  if (env.mockAi) return readFile(path.join(process.cwd(), "assets", "mock", "voice.mp3"));
  if (!env.elevenKey || !text?.trim()) throw new Error("Narration unavailable");
  const res = await fetch(`${API}/${validVoice(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": env.elevenKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: text.trim().slice(0, 900),
      model_id: env.narrationModel,
      voice_settings: { ...VOICE_SETTINGS, ...(speed !== undefined ? { speed } : {}) },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error("Empty narration audio");
  return buf;
}
