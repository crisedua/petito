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
        "music": "alegre",
        "bonus_scenes": [
            {
                "prompt": "a warm cinematic portrait celebrating a whole year of memories, soft golden confetti and bokeh lights, cozy home background, like a year-in-review cover",
                "sticker": "¡Mi añito!",
                "caption": "Así se ve un año entero de ser el regalón de la casa.",
            },
            {
                "prompt": "a dreamy painterly portrait surrounded by floating polaroid photo frames and soft pastel flowers, nostalgic scrapbook mood",
                "sticker": "¡Puro recuerdo!",
                "caption": "Cada foto mía es un recuerdito que guardo con la patita.",
            },
            {
                "prompt": "a glamorous awards-night portrait wearing a tiny bow tie, standing on a red carpet with golden spotlights and a small trophy",
                "sticker": "¡Mascota del año!",
                "caption": "Y el premio a la mascota más chora del año es para {name}.",
            },
        ],
    },
    "mis_aventuras": {
        "label": "Mis aventuras",
        "emoji": "🏕️",
        "music": "aventura",
        "bonus_scenes": [
            {
                "prompt": "an epic outdoor adventure scene exploring Chilean nature, andean mountains and forest trail, adventurous explorer vibe with a small backpack",
                "sticker": "¡A la aventura!",
                "caption": "Me arranqué a la cordillera, ando en modo explorador aperrado.",
            },
            {
                "prompt": "a sunny Chilean coast beach scene, standing on a surfboard with ocean waves and sunset light, playful summer vibe",
                "sticker": "¡Puro verano!",
                "caption": "Le tomé el gusto al mar: ahora soy mascota surfista.",
            },
            {
                "prompt": "riding in a vintage 4x4 jeep on a dusty Atacama desert road, goggles on and a scarf flying in the wind, golden hour",
                "sticker": "¡Todoterreno!",
                "caption": "Con {name} al volante, hasta el desierto queda chico.",
            },
        ],
    },
    "un_dia": {
        "label": "Un día en mi vida",
        "emoji": "☀️",
        "music": "tierno",
        "bonus_scenes": [
            {
                "prompt": "a cozy slice-of-life scene at home, sunny morning light through a window, relaxed and homely Chilean house background",
                "sticker": "¡Buenos días!",
                "caption": "Despierto, me estiro y empiezo mi turno de ser adorable.",
            },
            {
                "prompt": "napping wrapped in a fluffy blanket on a sofa, warm lamp light, super cozy evening mood",
                "sticker": "¡Modo siesta!",
                "caption": "Mi trabajo favorito: la siesta de las cuatro, sin interrupciones.",
            },
            {
                "prompt": "sitting at a Chilean kitchen table set for once, with pan amasado, avocado and a cup of tea, hopeful begging expression",
                "sticker": "¡Hora de la once!",
                "caption": "Sonó la tetera y {name} apareció altiro, pura casualidad.",
            },
        ],
    },
    "dieciochero": {
        "label": "Dieciochero",
        "emoji": "🇨🇱",
        "music": "cueca",
        "bonus_scenes": [
            {
                "prompt": "dressed as a Chilean huaso for Fiestas Patrias, wearing a chupalla straw hat and a colorful chamanto poncho, festive ramada background with chilean flags",
                "sticker": "¡Viva Chile!",
                "caption": "Me puse la chupalla y salí a celebrar como buen huaso.",
            },
            {
                "prompt": "dancing cueca holding a white handkerchief in the air, inside a ramada decorated with chilean flags and paper streamers, happy crowd blurred behind",
                "sticker": "¡Pie de cueca!",
                "caption": "Un pie de cueca y quedo listo para la segunda empanada.",
            },
            {
                "prompt": "next to a Chilean asado and empanadas stall, holding an empanada, colorful volantín kites flying in the blue sky",
                "sticker": "¡Empanada mía!",
                "caption": "Esa empanada tenía mi nombre: {name}, bien clarito.",
            },
        ],
    },
    "navidad": {
        "label": "Navidad",
        "emoji": "🎄",
        "music": "navidad",
        "bonus_scenes": [
            {
                "prompt": "wearing a cute Santa Claus hat and a small festive scarf, cozy Christmas scene with a decorated tree and warm lights in the background",
                "sticker": "¡Feliz Navidad!",
                "caption": "Me puse el gorrito y ahora soy ayudante oficial del Viejito.",
            },
            {
                "prompt": "wearing soft reindeer antlers in a magical snowy forest at night with warm glowing lights and gentle snowflakes",
                "sticker": "¡Reno regalón!",
                "caption": "Dicen que soy el reno más regalón del trineo.",
            },
            {
                "prompt": "dressed as a little Christmas elf surrounded by colorful gift boxes next to a fireplace with stockings",
                "sticker": "¡Puro regalo!",
                "caption": "Abrí un regalo sin permiso, pero {name} igual es un angelito.",
            },
        ],
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
    voice_id: Optional[str] = None


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
    bonus_pending: bool = False
    narration_pending: bool = False
    voice_id: Optional[str] = None
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
    audio_file: str = ""  # narration mp3 file name
    locked_file: str = ""  # blurred/watermarked variant
    locked: bool = False
    created_at: str = Field(default_factory=iso_now)


class SurveyResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_id)
    device_id: str = ""
    story_id: str = ""
    answer: str = "no"  # "yes" | "no"
    price_clp: int = 9900
    created_at: str = Field(default_factory=iso_now)


class SurveySubmit(BaseModel):
    story_id: str = ""
    answer: str  # "yes" | "no"
