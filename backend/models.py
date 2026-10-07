import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return now_utc().isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def new_slug() -> str:
    return uuid.uuid4().hex[:10]


THEMES = {
    "mi_ano": {
        "label": "Mi año",
        "emoji": "📅",
        "bonus_prompt": "a warm cinematic portrait celebrating a whole year of memories, soft golden confetti and cozy home background, like a year-in-review cover",
    },
    "mis_aventuras": {
        "label": "Mis aventuras",
        "emoji": "🏕️",
        "bonus_prompt": "an epic outdoor adventure scene, exploring Chilean nature, mountains and forest trail, adventurous explorer vibe with a small backpack",
    },
    "un_dia": {
        "label": "Un día en mi vida",
        "emoji": "☀️",
        "bonus_prompt": "a cozy slice-of-life scene at home, sunny morning light through a window, relaxed and homely Chilean house background",
    },
    "dieciochero": {
        "label": "Dieciochero",
        "emoji": "🇨🇱",
        "bonus_prompt": "dressed as a Chilean huaso for Fiestas Patrias, wearing a chupalla straw hat and a colorful chamanto poncho, festive ramada background with chilean flags, empanadas and asado",
    },
    "navidad": {
        "label": "Navidad",
        "emoji": "🎄",
        "bonus_prompt": "wearing a cute Santa Claus hat and a small festive scarf, cozy Christmas scene with a decorated tree and warm lights in the background",
    },
}

SPECIES = {"perro": "perro", "gato": "gato", "otro": "mascota"}

TRAITS = ["regalón", "glotón", "flojo", "aventurero", "mañoso", "guardián", "payaso"]


class StoryCreate(BaseModel):
    pet_name: str
    species: str
    traits: List[str] = []
    theme: str
    email: Optional[str] = None


class Story(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_id)
    share_slug: str = Field(default_factory=new_slug)
    device_id: Optional[str] = None
    pet_name: str
    species: str
    traits: List[str] = []
    theme: str
    status: str = "draft"  # draft, generating, preview_ready, paid, failed
    progress_step: str = ""
    progress_pct: int = 0
    title: Optional[str] = None
    price_clp: int = 3990
    paid_at: Optional[str] = None
    email: Optional[str] = None
    bonus_enabled: bool = True
    ai_cost_usd: float = 0.0
    error: Optional[str] = None
    photo_count: int = 0
    generated_at: Optional[str] = None
    created_at: str = Field(default_factory=iso_now)
    expires_at: Optional[str] = None


class Slide(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_id)
    story_id: str
    order: int
    caption: str = ""
    kind: str = "photo"  # title, photo, bonus, closing
    image_file: str = ""  # clean rendered file name
    locked_file: str = ""  # blurred/watermarked variant
    locked: bool = False
    created_at: str = Field(default_factory=iso_now)
