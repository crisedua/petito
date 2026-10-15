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


# ---------------- Pets ("El universo de mi mascota") ----------------
PERSONALITY_OPTIONS = [
    {"key": "regalon", "label": "El regalón de la casa", "emoji": "🥰"},
    {"key": "terremoto", "label": "Un pequeño terremoto", "emoji": "⚡"},
    {"key": "dormilon", "label": "Dormilón profesional", "emoji": "😴"},
    {"key": "aventurero", "label": "Aventurero de corazón", "emoji": "🏕️"},
    {"key": "travieso", "label": "Travieso pero irresistible", "emoji": "😼"},
]
PERSONALITY_LABELS = {o["key"]: o["label"] for o in PERSONALITY_OPTIONS}


class PetCreate(BaseModel):
    name: str
    species: str = "perro"
    personality: List[str] = []
    personality_text: Optional[str] = None
    favorite_memory: Optional[str] = None


class Pet(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_id)
    share_slug: str = Field(default_factory=new_slug)
    user_id: str
    name: str
    species: str = "perro"
    personality: List[str] = []
    personality_text: Optional[str] = None
    favorite_memory: Optional[str] = None
    photo_file: Optional[str] = None
    intro_text: Optional[str] = None
    birthday: Optional[str] = None          # "YYYY-MM-DD" or "MM-DD"
    adoption_date: Optional[str] = None     # "YYYY-MM-DD" or "MM-DD"
    public_enabled: bool = False
    created_at: str = Field(default_factory=iso_now)


class PetUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    personality: Optional[List[str]] = None
    personality_text: Optional[str] = None
    birthday: Optional[str] = None
    adoption_date: Optional[str] = None
    public_enabled: Optional[bool] = None


# ---------------- Memories ("Nuestra historia") ----------------
EMOTIONS = [
    {"key": "ternura", "label": "Ternura", "emoji": "🥹"},
    {"key": "risa", "label": "Risa", "emoji": "😂"},
    {"key": "alegria", "label": "Alegría", "emoji": "😊"},
    {"key": "orgullo", "label": "Orgullo", "emoji": "🏅"},
    {"key": "nostalgia", "label": "Nostalgia", "emoji": "🍂"},
    {"key": "amor", "label": "Amor", "emoji": "❤️"},
    {"key": "calma", "label": "Calma", "emoji": "🌿"},
    {"key": "gratitud", "label": "Gratitud", "emoji": "🙏"},
]
EMOTION_LABELS = {e["key"]: e["label"] for e in EMOTIONS}


class MemoryCreate(BaseModel):
    title: str
    happened_on: Optional[str] = None       # free text date, e.g. "2024-03" or "hace un tiempo"
    date_unknown: bool = False
    feeling_text: Optional[str] = None       # what the owner felt / what happened
    emotions: List[str] = []


class MemoryUpdate(BaseModel):
    title: Optional[str] = None
    happened_on: Optional[str] = None
    date_unknown: Optional[bool] = None
    feeling_text: Optional[str] = None
    emotions: Optional[List[str]] = None


class Memory(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_id)
    pet_id: str
    user_id: str
    title: str
    happened_on: Optional[str] = None
    date_unknown: bool = False
    feeling_text: Optional[str] = None
    emotions: List[str] = []
    photo_file: Optional[str] = None
    ai_reflection: Optional[str] = None       # Petito's gentle thought (IA), always labeled
    shared: bool = False                      # included in the pet's public album when true
    created_at: str = Field(default_factory=iso_now)
    updated_at: Optional[str] = None


class StoryCreate(BaseModel):
    pet_name: str
    species: str
    traits: List[str] = []
    theme: str
    email: Optional[str] = None
    voice_id: Optional[str] = None
    pet_id: Optional[str] = None


class Story(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_id)
    share_slug: str = Field(default_factory=new_slug)
    device_id: Optional[str] = None
    user_id: Optional[str] = None
    pet_name: str
    species: str
    traits: List[str] = []
    theme: str
    status: str = "draft"  # draft, generating, preview_ready, paid, failed
    pet_id: Optional[str] = None
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


# ---------------- Portraits (royalty portrait: free preview -> paid HD) ----------------
PORTRAIT_STYLES = {
    "renacentista": {
        "label": "Renacentista",
        "emoji": "🎨",
        "desc": "Óleo clásico, telón oscuro y vestuario de época",
        "prompt": (
            "a masterful classical Renaissance oil painting portrait, the pet wearing regal "
            "Renaissance noble attire such as a velvet robe and a ruffled lace collar, dramatic "
            "chiaroscuro lighting, dark elegant painted background, visible oil brush strokes, "
            "museum masterpiece style, displayed inside an ornate hand-carved gilded golden "
            "baroque frame as if hanging in a palace"
        ),
    },
    "victoriano": {
        "label": "Victoriano",
        "emoji": "🎩",
        "desc": "Atuendo aristócrata: capa, encaje y joyas",
        "prompt": (
            "a refined Victorian aristocratic oil painting portrait, the pet dressed as a noble "
            "aristocrat with a velvet cape, delicate lace, pearls and jewels, dignified regal pose, "
            "soft classic painted studio background, elegant and stately mood, displayed inside an "
            "ornate gilded golden frame with carved flourishes"
        ),
    },
    "halloween": {
        "label": "Halloween",
        "emoji": "🎃",
        "desc": "Retrato clásico con toque gótico de Halloween",
        "prompt": (
            "a classical oil painting portrait with an elegant gothic Halloween theme, warm "
            "candlelight and flickering candles, subtle cobwebs, deep moody dark tones, the pet "
            "wearing a small aristocratic costume, spooky yet refined mansion background, displayed "
            "inside an ornate gilded golden frame with carved flourishes"
        ),
    },
}

# Memorial / tribute portraits — calm, tasteful, no humor, no ornate frame.
MEMORIAL_STYLES = {
    "acuarela": {
        "label": "Acuarela",
        "emoji": "🕊️",
        "desc": "Acuarela suave y serena, delicada y luminosa",
        "prompt": (
            "a gentle serene fine-art watercolor painting portrait, soft pastel washes and delicate "
            "flowing brush strokes, light airy pale background, peaceful loving and calm mood, tender "
            "soft light, faithfully preserving the pet's real features and sweet expression, no text, "
            "no frame"
        ),
    },
    "oleo_realista": {
        "label": "Óleo realista",
        "emoji": "🖼️",
        "desc": "Óleo realista que conserva su esencia",
        "prompt": (
            "a realistic fine-art oil painting portrait, lifelike faithful detail that preserves the "
            "pet's real features and gentle expression, soft warm natural lighting, calm neutral muted "
            "background, dignified serene and tender mood, museum-quality, no text, no frame"
        ),
    },
}


class PortraitCreate(BaseModel):
    pet_name: Optional[str] = None
    style: str
    category: str = "royal"            # "royal" | "memorial"
    gift_enabled: bool = False
    gift_to: Optional[str] = None
    gift_from: Optional[str] = None
    gift_message: Optional[str] = None
    memorial_dates: Optional[str] = None
    memorial_caption: Optional[str] = None
    pet_id: Optional[str] = None


class Portrait(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_id)
    share_slug: str = Field(default_factory=new_slug)
    device_id: Optional[str] = None
    user_id: Optional[str] = None
    pet_name: Optional[str] = None
    style: str
    category: str = "royal"
    pet_id: Optional[str] = None
    status: str = "draft"  # draft, generating, preview_ready, paid, failed
    progress_step: str = ""
    progress_pct: int = 0
    preview_file: str = ""   # low-res watermarked (public)
    clean_file: str = ""     # HD clean, unguessable name (only exposed when paid)
    price_clp: int = 2990
    paid_at: Optional[str] = None
    gift_enabled: bool = False
    gift_to: Optional[str] = None
    gift_from: Optional[str] = None
    gift_message: Optional[str] = None
    memorial_dates: Optional[str] = None
    memorial_caption: Optional[str] = None
    ai_cost_usd: float = 0.0
    error: Optional[str] = None
    created_at: str = Field(default_factory=iso_now)
    expires_at: Optional[str] = None


# ---------------- Talking video ("Petito Habla") ----------------
# Predefined scenarios steer the AI line; owner can also write a custom message.
TALK_SCENARIOS = {
    "chistoso": {"label": "Algo chistoso", "emoji": "😄",
                 "hint": "una frase graciosa y tierna saludando a la cámara"},
    "cumpleanos": {"label": "Feliz cumpleaños", "emoji": "🎂",
                   "hint": "un saludo tierno y alegre de feliz cumpleaños a su familia"},
    "te_amo": {"label": "Te amo", "emoji": "❤️",
               "hint": "una declaración de amor dulce y tierna a su familia"},
    "te_extrano": {"label": "Te extraño", "emoji": "🥺",
                   "hint": "decir con ternura cuánto extraña a su familia y que la espera"},
    "gracias": {"label": "Gracias", "emoji": "🙏",
                "hint": "agradecer con cariño a su familia por cuidarlo y quererlo"},
}
TALK_MESSAGE_MAX = 160


class TalkCreate(BaseModel):
    pet_name: Optional[str] = None
    voice_id: Optional[str] = None
    pet_id: Optional[str] = None
    scenario: Optional[str] = None
    message: Optional[str] = None


class TalkingVideo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_id)
    share_slug: str = Field(default_factory=new_slug)
    device_id: Optional[str] = None
    user_id: Optional[str] = None
    pet_name: Optional[str] = None
    species: Optional[str] = None
    mode: str = "full"          # "preview_free" (anonymous) | "full" (logged in)
    status: str = "draft"       # draft, generating, preview_ready, finalizing, paid, failed
    pet_id: Optional[str] = None
    scenario: Optional[str] = None
    message: Optional[str] = None
    progress_step: str = ""
    progress_pct: int = 0
    line: Optional[str] = None
    voice_id: Optional[str] = None
    media_base: Optional[str] = None   # public origin to build fal-reachable media URLs
    audio_file: str = ""
    preview_file: str = ""      # watermarked mp4 (public)
    clean_file: str = ""        # HD clean mp4, unguessable name (only exposed when paid)
    price_clp: int = 2990
    paid_at: Optional[str] = None
    ai_cost_usd: float = 0.0
    error: Optional[str] = None
    created_at: str = Field(default_factory=iso_now)
    expires_at: Optional[str] = None
