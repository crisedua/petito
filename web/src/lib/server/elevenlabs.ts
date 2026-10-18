import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { VOICES as DEFAULT_VOICES, type Voice } from "@/lib/catalogs";

const API = "https://api.elevenlabs.io/v1/text-to-speech";

/**
 * Voices offered in the app. Override with ELEVENLABS_VOICES="voiceId:Label|voiceId:Label" (first = default)
 * to use voices from your own ElevenLabs library (see scripts/voices.ts to find Chilean / neutral Spanish ones).
 */
export function voices(): Voice[] {
  const raw = (process.env.ELEVENLABS_VOICES ?? "").trim();
  if (!raw) return DEFAULT_VOICES;
  const list = raw.split("|").map((p) => p.trim()).filter(Boolean).map((p) => {
    const i = p.indexOf(":");
    return i > 0 ? { id: p.slice(0, i).trim(), label: p.slice(i + 1).trim() } : { id: p, label: p };
  }).filter((v) => /^[A-Za-z0-9]{10,40}$/.test(v.id));
  return list.length ? list : DEFAULT_VOICES;
}
export const defaultVoiceId = () => voices()[0].id;
export const validVoice = (voiceId?: string | null): string =>
  voiceId && voices().some((v) => v.id === voiceId) ? voiceId : defaultVoiceId();

// Slow, clear and warm delivery (narration.py _VOICE_SETTINGS).
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true, speed: 0.8 };

/** ElevenLabs TTS (BYOK), same request as backend/narration.py. Returns MP3 bytes. */
export async function generateNarration(text: string, voiceId: string, speed?: number, modelId = env.narrationModel): Promise<Buffer> {
  if (env.mockAi) return readFile(path.join(process.cwd(), "assets", "mock", "voice.mp3"));
  if (!env.elevenKey || !text?.trim()) throw new Error("Narration unavailable");
  const res = await fetch(`${API}/${validVoice(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": env.elevenKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: text.trim().slice(0, 900),
      model_id: modelId,
      voice_settings: { ...VOICE_SETTINGS, ...(speed !== undefined ? { speed } : {}) },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error("Empty narration audio");
  return buf;
}
