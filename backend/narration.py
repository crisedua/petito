"""ElevenLabs narration: reads a pet phrase aloud in Spanish, slow and warm.

Uses the user's own ElevenLabs API key (BYOK). Multilingual model + curated
Spanish-accent voices from the shared library (used directly by voice_id).
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from elevenlabs import ElevenLabs, VoiceSettings

load_dotenv(Path(__file__).parent / ".env")

ELEVEN_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
NARRATION_MODEL = os.environ.get("NARRATION_MODEL", "eleven_multilingual_v2")
NARRATION_ENABLED = os.environ.get("NARRATION_ENABLED", "true").lower() == "true" and bool(ELEVEN_API_KEY)

# Curated Spanish voices (Latin-American leaning for a Chilean audience).
VOICES = [
    {"id": "G5fUGgDJhRU7jqXTv65B", "label": "Cálida y alegre"},
    {"id": "4q0PbHS9CvGUVibwij58", "label": "Chilenazo"},
    {"id": "nYm4p0R8BhHFRBH8wGHm", "label": "Narrador tierno"},
    {"id": "fZfhCzqImeCHqeFIpNOv", "label": "Dinámica"},
]
DEFAULT_VOICE_ID = VOICES[0]["id"]
VALID_VOICE_IDS = {v["id"] for v in VOICES}

# Slow, clear and warm delivery.
_SETTINGS = VoiceSettings(stability=0.5, similarity_boost=0.8, style=0.0,
                          use_speaker_boost=True, speed=0.8)

_client = ElevenLabs(api_key=ELEVEN_API_KEY) if ELEVEN_API_KEY else None


def valid_voice(voice_id: str) -> str:
    return voice_id if voice_id in VALID_VOICE_IDS else DEFAULT_VOICE_ID


def generate_narration(text: str, voice_id: str) -> bytes:
    """Blocking ElevenLabs TTS call. Run in a worker thread. Returns MP3 bytes."""
    if not _client or not text or not text.strip():
        raise RuntimeError("Narration unavailable")
    stream = _client.text_to_speech.convert(
        text=text.strip()[:900],
        voice_id=valid_voice(voice_id),
        model_id=NARRATION_MODEL,
        output_format="mp3_44100_128",
        voice_settings=_SETTINGS,
    )
    data = b""
    for chunk in stream:
        data += chunk
    if not data:
        raise RuntimeError("Empty narration audio")
    return data
