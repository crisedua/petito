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


def generate_bonus_scene(best_photo_data_uri, pet_name, species, bonus_prompt, timeout=240):
    """Blocking fal.ai call via Emergent proxy. Run in a worker thread."""
    headers = {
        "Authorization": f"Bearer {EMERGENT_LLM_KEY}",
        "Content-Type": "application/json",
    }
    prompt = (
        f"Transform this exact {species} into a fun stylized portrait: {bonus_prompt}. "
        f"Critically preserve the pet's real fur colors, markings, breed and face so it is "
        f"clearly the same pet. Cute, warm, high quality, vertical composition."
    )
    payload = {
        "image_urls": [best_photo_data_uri],
        "prompt": prompt,
        "num_images": 1,
        "output_format": "jpeg",
        "aspect_ratio": "9:16",
    }
    submit = None
    for attempt in range(4):
        submit = requests.post(
            f"{FAL_CONTROL}/proxy", headers={**headers, "X-Fal-Target-Url": f"https://queue.fal.run/{FAL_MODEL}"},
            json=payload, timeout=60,
        )
        if submit.status_code == 402:
            raise RuntimeError("INSUFFICIENT_CREDITS")
        if submit.status_code in (429, 500, 502, 503, 504) and attempt < 3:
            time.sleep(3 * (attempt + 1))
            continue
        break
    submit.raise_for_status()
    sub = submit.json()
    status_url = _trusted_queue_url(sub["status_url"])
    response_url = _trusted_queue_url(sub["response_url"])

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        st = requests.get(status_url, headers=headers, timeout=30)
        st.raise_for_status()
        status = (st.json().get("status") or "").upper()
        if status in {"COMPLETED", "OK"}:
            res = requests.get(response_url, headers=headers, timeout=60)
            res.raise_for_status()
            body = res.json()
            imgs = body.get("images") or []
            if not imgs:
                raise RuntimeError("No bonus image returned")
            img_url = imgs[0]["url"] if isinstance(imgs[0], dict) else imgs[0]
            dl = requests.get(img_url, timeout=60)
            dl.raise_for_status()
            return Image.open(BytesIO(dl.content)).convert("RGB")
        if status in {"FAILED", "CANCELLED", "CANCELED", "ERROR"}:
            raise RuntimeError(f"Bonus generation failed: {status}")
        time.sleep(2)
    raise RuntimeError("Bonus generation timed out")
