"""AI pipeline: Claude vision photo selection, Claude caption writing, fal.ai bonus scenes.

Fal Universal Key supports queue media inference through the Emergent proxy only,
not Fal Platform APIs.
"""
import os
import re
import json
import time
import requests
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
from dotenv import load_dotenv

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone

load_dotenv(Path(__file__).parent / ".env")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
FAL_MODEL = os.environ.get("FAL_IMAGE_MODEL", "fal-ai/nano-banana/edit")

INTEGRATION_PROXY_BASE = os.environ.get(
    "INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com"
).rstrip("/")
FAL_CONTROL = f"{INTEGRATION_PROXY_BASE}/api/v1/fal"
FAL_QUEUE_BASE = f"{FAL_CONTROL}/queue"

# Claude Sonnet pricing (USD per token)
CLAUDE_IN = 3.0 / 1_000_000
CLAUDE_OUT = 15.0 / 1_000_000
FAL_IMG_COST = 0.039  # estimated USD per generated image


def claude_cost(usage) -> float:
    return usage.input_tokens * CLAUDE_IN + usage.output_tokens * CLAUDE_OUT


def _extract_json(text: str):
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    # grab first balanced JSON object/array
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        if start == -1:
            continue
        depth = 0
        for i in range(start, len(text)):
            if text[i] == opener:
                depth += 1
            elif text[i] == closer:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except Exception:
                        break
    return json.loads(text)


async def _run_claude(system_message: str, user_message: UserMessage):
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"cuentapatas-{int(time.time()*1000)}",
        system_message=system_message,
    ).with_model("anthropic", CLAUDE_MODEL)
    text = ""
    usage = None
    async for ev in chat.stream_message(user_message):
        if isinstance(ev, TextDelta):
            text += ev.content
        elif isinstance(ev, StreamDone):
            usage = ev.usage
    return text, usage


async def select_photos(photo_b64_list, pet_name, species, traits, theme_label):
    """Vision: score each photo, pick best 6-8, order into a narrative arc."""
    system = (
        "Eres un editor visual experto para historias de mascotas. Analizas fotos y "
        "respondes SOLO con JSON válido, sin texto adicional."
    )
    n = len(photo_b64_list)
    want = max(3, min(8, n))
    prompt = (
        f"Mascota: {pet_name} ({species}). Rasgos: {', '.join(traits) or 'ninguno'}. "
        f"Tema de la historia: {theme_label}.\n"
        f"Te muestro {n} fotos numeradas de 0 a {n-1} en orden.\n"
        f"Puntúa cada foto de 0 a 10 según: mascota visible, nitidez, emoción y variedad. "
        f"Elige las mejores {want} fotos (o menos si hay pocas buenas) y ordénalas en un arco "
        f"narrativo coherente para el tema. La primera debe ser una gran foto de apertura.\n"
        f'Responde JSON: {{"best_photo_index": <int>, "selected": [{{"photo_index": <int>, '
        f'"slide_order": <int desde 0>, "score": <float>, "scene_description": "<breve>"}}]}}'
    )
    images = [ImageContent(image_base64=b) for b in photo_b64_list]
    text, usage = await _run_claude(system, UserMessage(text=prompt, file_contents=images))
    data = _extract_json(text)
    sel = sorted(data["selected"], key=lambda x: x.get("slide_order", 0))
    sel = [s for s in sel if 0 <= int(s["photo_index"]) < n][:8]
    best = int(data.get("best_photo_index", sel[0]["photo_index"] if sel else 0))
    if best < 0 or best >= n:
        best = sel[0]["photo_index"] if sel else 0
    return sel, best, usage


async def write_captions(pet_name, species, traits, theme_label, scene_descriptions):
    system = (
        "Eres un copywriter chileno experto en humor cálido y tierno. Escribes en primera "
        "persona como si fueras la mascota. Español de Chile, modismos suaves (regalón, "
        "pancito, siesta, choro, aperrado), sin groserías ni humor ofensivo. Respondes SOLO JSON válido."
    )
    k = len(scene_descriptions)
    scenes = "\n".join(f"{i}. {d}" for i, d in enumerate(scene_descriptions))
    prompt = (
        f"Soy {pet_name}, un {species}. Mis rasgos: {', '.join(traits) or 'muy regalón'}. "
        f"Tema: {theme_label}.\n"
        f"Hay {k} diapositivas con estas escenas:\n{scenes}\n\n"
        f"Entrega: (1) un título corto y pegajoso para la historia (máx 5 palabras); "
        f"(2) para CADA diapositiva una frase en primera persona como la mascota, cálida y divertida, "
        f"máximo 18 palabras, usando mi nombre a veces; "
        f"(3) para CADA diapositiva un 'sticker': una expresión MUY corta de 1 a 3 palabras tipo grito "
        f"de historia de Instagram (ej: '¡Qué regalón!', '¡Modo siesta!', '¡Tiki tiki ti!', '¡Pancito ya!').\n"
        f'Responde JSON: {{"title": "<título>", "captions": ["..." x{k}], "stickers": ["..." x{k}]}} '
        f"con exactamente {k} captions y {k} stickers."
    )
    text, usage = await _run_claude(system, UserMessage(text=prompt))
    data = _extract_json(text)
    caps = data.get("captions", [])
    stks = data.get("stickers", [])
    while len(caps) < k:
        caps.append(f"¡{pet_name} aquí, pasándolo regio!")
    while len(stks) < k:
        stks.append("¡Regalón!")
    title = data.get("title") or f"La historia de {pet_name}"
    return title, caps[:k], [str(s)[:22] for s in stks[:k]], usage


def _trusted_queue_url(value: str) -> str:
    c = urlparse(value)
    b = urlparse(FAL_QUEUE_BASE)
    prefix = b.path.rstrip("/") + "/"
    if (c.scheme != b.scheme or c.netloc != b.netloc or c.username or c.password
            or c.fragment or not c.path.startswith(prefix)):
        raise RuntimeError("Proxy returned an untrusted media queue URL")
    return value


def _fal_queue(endpoint, payload, timeout=300):
    """Blocking fal.ai queue call via Emergent proxy. Returns the result body JSON."""
    headers = {
        "Authorization": f"Bearer {EMERGENT_LLM_KEY}",
        "Content-Type": "application/json",
    }
    submit = None
    last_err = None
    for attempt in range(4):
        try:
            submit = requests.post(
                f"{FAL_CONTROL}/proxy",
                headers={**headers, "X-Fal-Target-Url": f"https://queue.fal.run/{endpoint}"},
                json=payload, timeout=60,
            )
        except requests.RequestException as e:
            last_err = e
            time.sleep(5 * (attempt + 1))
            continue
        if submit.status_code == 402:
            raise RuntimeError("INSUFFICIENT_CREDITS")
        if submit.status_code in (429, 500, 502, 503, 504) and attempt < 3:
            time.sleep(5 * (attempt + 1))
            continue
        break
    if submit is None:
        raise RuntimeError(f"fal submit failed: {last_err}")
    submit.raise_for_status()
    sub = submit.json()
    status_url = _trusted_queue_url(sub["status_url"])
    response_url = _trusted_queue_url(sub["response_url"])

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            st = requests.get(status_url, headers=headers, timeout=30)
            st.raise_for_status()
        except requests.RequestException:
            time.sleep(3)
            continue
        status = (st.json().get("status") or "").upper()
        if status in {"COMPLETED", "OK"}:
            res = requests.get(response_url, headers=headers, timeout=120)
            res.raise_for_status()
            return res.json()
        if status in {"FAILED", "CANCELLED", "CANCELED", "ERROR"}:
            raise RuntimeError(f"Generation failed: {status}")
        time.sleep(2)
    raise RuntimeError("Generation timed out")


def _fal_edit(image_data_uri, prompt, aspect_ratio="9:16", timeout=240):
    body = _fal_queue(FAL_MODEL, {
        "image_urls": [image_data_uri], "prompt": prompt, "num_images": 1,
        "output_format": "jpeg", "aspect_ratio": aspect_ratio,
    }, timeout)
    imgs = body.get("images") or []
    if not imgs:
        raise RuntimeError("No image returned")
    img_url = imgs[0]["url"] if isinstance(imgs[0], dict) else imgs[0]
    dl = requests.get(img_url, timeout=60)
    dl.raise_for_status()
    return Image.open(BytesIO(dl.content)).convert("RGB")


# ---------------- talking video (fal sync-lipsync v3 image-to-video) ----------------
TALK_MODEL = os.environ.get("FAL_TALK_MODEL", "fal-ai/sync-lipsync/v3/image-to-video")
FAL_VIDEO_COST_PER_SEC = 0.1333


def generate_talking_video(image_url, audio_url, timeout=600):
    """image_url + audio_url (public HTTPS) -> MP4 bytes. Duration follows the audio."""
    body = _fal_queue(TALK_MODEL, {"image_url": image_url, "audio_url": audio_url}, timeout)
    vid = body.get("video") or {}
    url = vid.get("url") if isinstance(vid, dict) else vid
    if not url:
        raise RuntimeError("No video returned")
    dl = requests.get(url, timeout=180)
    dl.raise_for_status()
    return dl.content


async def write_pet_line(photo_b64, pet_name=None, length="short"):
    """Claude vision: identify species and write ONE funny Chilean first-person line.
    length: 'mini' (~3s, free preview), 'short', or 'long' (~8s, full video)."""
    system = (
        "Eres un comediante chileno que le pone voz a las mascotas. Hablas en primera persona "
        "como si fueras la mascota de la foto. Español de Chile, cálido y chistoso, con modismos "
        "suaves (regalón, pancito, choro, aperrado, bacán, al tiro), sin groserías ni humor "
        "ofensivo. Respondes SOLO JSON válido."
    )
    words = {"mini": "6 a 9", "short": "11 a 15", "long": "20 a 26"}.get(length, "11 a 15")
    name_txt = f"Mi nombre es {pet_name}. " if pet_name else ""
    prompt = (
        f"Mira la foto de esta mascota. {name_txt}"
        f"Identifica si es perro, gato u otro. Inventa UNA sola frase graciosa en primera persona "
        f"que la mascota diría mirando a la cámara en un video, de {words} palabras, para hacer "
        f"reír y que la gente quiera compartirlo. Usa el nombre si lo tienes.\n"
        f'Responde JSON: {{"species": "perro|gato|otro", "line": "<frase>"}}'
    )
    text, usage = await _run_claude(
        system, UserMessage(text=prompt, file_contents=[ImageContent(image_base64=photo_b64)]))
    data = _extract_json(text)
    line = (data.get("line") or "").strip() or f"¡Hola! Soy {pet_name or 'tu regalón'}, el más choro de la casa."
    species = data.get("species") or "otro"
    return line, species, usage


def generate_bonus_scene(best_photo_data_uri, pet_name, species, bonus_prompt, timeout=240):
    prompt = (
        f"Transform this exact {species} into a fun stylized portrait: {bonus_prompt}. "
        f"Critically preserve the pet's real fur colors, markings, breed and face so it is "
        f"clearly the same pet. Cute, warm, high quality, vertical composition."
    )
    return _fal_edit(best_photo_data_uri, prompt, aspect_ratio="9:16", timeout=timeout)


def generate_portrait(photo_data_uri, species, style_prompt, timeout=300):
    prompt = (
        f"Transform this exact {species} into {style_prompt}. "
        f"CRITICAL: preserve the pet's real fur colors, markings, breed and facial features so it "
        f"is unmistakably the same pet. The pet's face must stay clearly visible and centered. "
        f"Luxurious, elegant, high quality, vertical portrait composition."
    )
    return _fal_edit(photo_data_uri, prompt, aspect_ratio="3:4", timeout=timeout)
