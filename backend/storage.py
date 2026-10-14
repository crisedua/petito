import os
import base64
import logging
from io import BytesIO
from pathlib import Path
import requests
from dotenv import load_dotenv
from PIL import Image, ImageOps

# Register HEIC/HEIF opener so iPhone photos (.heic/.heif) decode in every upload flow.
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:  # pragma: no cover - optional dependency
    pass

load_dotenv(Path(__file__).parent / ".env")
logger = logging.getLogger("petito.storage")

# ---- Emergent object storage (durable, survives redeploys) ----
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "petito"

_storage_key = None


def init_storage(force: bool = False):
    """Call once at startup. Returns a session-scoped storage key."""
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _obj_path(story_id: str, name: str) -> str:
    return f"{APP_NAME}/{story_id}/{name}"


def _put(path: str, data: bytes, content_type: str):
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:  # dead/unknown storage key -> re-init once
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def _get(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---- public helpers (same interface as before) ----
def save_original(story_id: str, index: int, raw: bytes) -> str:
    """Resize to max 1536px, strip EXIF, store as JPEG in object storage. Returns file name."""
    img = Image.open(BytesIO(raw))
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    img.thumbnail((1536, 1536), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=88)
    img.close()
    name = f"orig_{index}.jpg"
    _put(_obj_path(story_id, name), buf.getvalue(), "image/jpeg")
    buf.close()
    return name


def save_image(story_id: str, name: str, image: Image.Image, quality: int = 90) -> str:
    buf = BytesIO()
    image.save(buf, "JPEG", quality=quality)
    _put(_obj_path(story_id, name), buf.getvalue(), "image/jpeg")
    return name


def save_bytes(story_id: str, name: str, raw: bytes, content_type: str = "application/octet-stream") -> str:
    _put(_obj_path(story_id, name), raw, content_type)
    return name


def get_bytes(story_id: str, name: str):
    """Returns (content_bytes, content_type)."""
    return _get(_obj_path(story_id, name))


def load_image(story_id: str, name: str) -> Image.Image:
    data, _ = _get(_obj_path(story_id, name))
    return Image.open(BytesIO(data)).convert("RGB")


def exists(story_id: str, name: str) -> bool:
    try:
        _get(_obj_path(story_id, name))
        return True
    except Exception:
        return False


def image_to_b64(story_id: str, name: str, max_side: int = 384) -> str:
    """Downscaled base64 (no data-uri prefix) for vision scoring."""
    img = load_image(story_id, name)
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def image_to_data_uri(story_id: str, name: str, max_side: int = 1024) -> str:
    img = load_image(story_id, name)
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=88)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"
