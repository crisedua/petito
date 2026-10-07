import os
import base64
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps

UPLOAD_ROOT = Path(__file__).parent / "uploads"
UPLOAD_ROOT.mkdir(exist_ok=True)


def story_dir(story_id: str) -> Path:
    d = UPLOAD_ROOT / story_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_original(story_id: str, index: int, raw: bytes) -> str:
    """Resize to max 1536px, strip EXIF, store as JPEG. Returns file name."""
    img = Image.open(BytesIO(raw))
    img = ImageOps.exif_transpose(img)  # apply orientation then drop exif
    img = img.convert("RGB")
    img.thumbnail((1536, 1536), Image.LANCZOS)
    name = f"orig_{index}.jpg"
    img.save(story_dir(story_id) / name, "JPEG", quality=88)
    return name


def load_image(story_id: str, name: str) -> Image.Image:
    return Image.open(story_dir(story_id) / name).convert("RGB")


def file_path(story_id: str, name: str) -> Path:
    return story_dir(story_id) / name


def exists(story_id: str, name: str) -> bool:
    return (story_dir(story_id) / name).exists()


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


def save_bytes(story_id: str, name: str, raw: bytes) -> str:
    with open(story_dir(story_id) / name, "wb") as f:
        f.write(raw)
    return name
