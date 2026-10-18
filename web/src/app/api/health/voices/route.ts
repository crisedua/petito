import { handler, json } from "@/lib/server/http";
import { ensureVoices, voices } from "@/lib/server/elevenlabs";
import { loadLibraryVoices, setupLibraryVoices } from "@/lib/server/voiceLibrary";

export const maxDuration = 60;

/**
 * Shows the voices the app offers. The first visit, when no Chilean/neutral catalog is saved yet,
 * picks them from the ElevenLabs library and adds them to the account (runs once; later visits only read).
 */
export const GET = handler(async () => {
  const override = Boolean((process.env.ELEVENLABS_VOICES ?? "").trim());
  let saved = await loadLibraryVoices();
  let notes: string[] = [];
  if (!saved && !override) ({ voices: saved, notes } = await setupLibraryVoices());
  await ensureVoices();
  return json({ source: override ? "ELEVENLABS_VOICES" : saved?.length ? "library" : "default", offered: voices(), library: saved, notes });
});
