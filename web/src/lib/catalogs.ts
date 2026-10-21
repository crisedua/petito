/**
 * Product catalogs, ported verbatim from backend/models.py and backend/narration.py.
 * Customer-facing strings are Chilean/Latin-American Spanish and must not be edited casually.
 */

export type BonusScene = { prompt: string; sticker: string; caption: string };
export type Theme = { label: string; emoji: string; music: string; bonus_scenes: BonusScene[] };
/**
 * mode: "paint" = AI repaints the photo (oil painting etc.); "edit" = AI keeps the real photo and only
 * adds background/props (photoreal); "render" = our own renderer, no AI at all.
 */
export type StyleMode = "paint" | "edit" | "render";
export type StyleDef = { label: string; emoji: string; desc: string; prompt: string; mode?: StyleMode; group?: "foto" | "pintura" };
export type Option = { key: string; label: string; emoji: string };
export type TalkScenario = { label: string; emoji: string; hint: string };
export type Voice = { id: string; label: string };

export const BRAND_NAME = "Petito";
export const BRAND_URL = "petito.pro";

export const THEMES: Record<string, Theme> = {
  "mi_ano": {
    "label": "Mi año",
    "emoji": "📅",
    "music": "alegre",
    "bonus_scenes": [
      {
        "prompt": "a warm cinematic portrait celebrating a whole year of memories, soft golden confetti and bokeh lights, cozy home background, like a year-in-review cover",
        "sticker": "¡Mi añito!",
        "caption": "Así se ve un año entero de ser el regalón de la casa."
      },
      {
        "prompt": "a dreamy painterly portrait surrounded by floating polaroid photo frames and soft pastel flowers, nostalgic scrapbook mood",
        "sticker": "¡Puro recuerdo!",
        "caption": "Cada foto mía es un recuerdito que guardo con la patita."
      },
      {
        "prompt": "a glamorous awards-night portrait wearing a tiny bow tie, standing on a red carpet with golden spotlights and a small trophy",
        "sticker": "¡Mascota del año!",
        "caption": "Y el premio a la mascota más chora del año es para {name}."
      }
    ]
  },
  "mis_aventuras": {
    "label": "Mis aventuras",
    "emoji": "🏕️",
    "music": "aventura",
    "bonus_scenes": [
      {
        "prompt": "an epic outdoor adventure scene exploring Chilean nature, andean mountains and forest trail, adventurous explorer vibe with a small backpack",
        "sticker": "¡A la aventura!",
        "caption": "Me arranqué a la cordillera, ando en modo explorador aperrado."
      },
      {
        "prompt": "a sunny Chilean coast beach scene, standing on a surfboard with ocean waves and sunset light, playful summer vibe",
        "sticker": "¡Puro verano!",
        "caption": "Le tomé el gusto al mar: ahora soy mascota surfista."
      },
      {
        "prompt": "riding in a vintage 4x4 jeep on a dusty Atacama desert road, goggles on and a scarf flying in the wind, golden hour",
        "sticker": "¡Todoterreno!",
        "caption": "Con {name} al volante, hasta el desierto queda chico."
      }
    ]
  },
  "un_dia": {
    "label": "Un día en mi vida",
    "emoji": "☀️",
    "music": "tierno",
    "bonus_scenes": [
      {
        "prompt": "a cozy slice-of-life scene at home, sunny morning light through a window, relaxed and homely Chilean house background",
        "sticker": "¡Buenos días!",
        "caption": "Despierto, me estiro y empiezo mi turno de ser adorable."
      },
      {
        "prompt": "napping wrapped in a fluffy blanket on a sofa, warm lamp light, super cozy evening mood",
        "sticker": "¡Modo siesta!",
        "caption": "Mi trabajo favorito: la siesta de las cuatro, sin interrupciones."
      },
      {
        "prompt": "sitting at a Chilean kitchen table set for once, with pan amasado, avocado and a cup of tea, hopeful begging expression",
        "sticker": "¡Hora de la once!",
        "caption": "Sonó la tetera y {name} apareció altiro, pura casualidad."
      }
    ]
  },
  "dieciochero": {
    "label": "Dieciochero",
    "emoji": "🇨🇱",
    "music": "cueca",
    "bonus_scenes": [
      {
        "prompt": "dressed as a Chilean huaso for Fiestas Patrias, wearing a chupalla straw hat and a colorful chamanto poncho, festive ramada background with chilean flags",
        "sticker": "¡Viva Chile!",
        "caption": "Me puse la chupalla y salí a celebrar como buen huaso."
      },
      {
        "prompt": "dancing cueca holding a white handkerchief in the air, inside a ramada decorated with chilean flags and paper streamers, happy crowd blurred behind",
        "sticker": "¡Pie de cueca!",
        "caption": "Un pie de cueca y quedo listo para la segunda empanada."
      },
      {
        "prompt": "next to a Chilean asado and empanadas stall, holding an empanada, colorful volantín kites flying in the blue sky",
        "sticker": "¡Empanada mía!",
        "caption": "Esa empanada tenía mi nombre: {name}, bien clarito."
      }
    ]
  },
  "navidad": {
    "label": "Navidad",
    "emoji": "🎄",
    "music": "navidad",
    "bonus_scenes": [
      {
        "prompt": "wearing a cute Santa Claus hat and a small festive scarf, cozy Christmas scene with a decorated tree and warm lights in the background",
        "sticker": "¡Feliz Navidad!",
        "caption": "Me puse el gorrito y ahora soy ayudante oficial del Viejito."
      },
      {
        "prompt": "wearing soft reindeer antlers in a magical snowy forest at night with warm glowing lights and gentle snowflakes",
        "sticker": "¡Reno regalón!",
        "caption": "Dicen que soy el reno más regalón del trineo."
      },
      {
        "prompt": "dressed as a little Christmas elf surrounded by colorful gift boxes next to a fireplace with stockings",
        "sticker": "¡Puro regalo!",
        "caption": "Abrí un regalo sin permiso, pero {name} igual es un angelito."
      }
    ]
  }
};

export const SPECIES: Record<string, string> = {
  "perro": "perro",
  "gato": "gato",
  "otro": "mascota"
};

export const TRAITS: string[] = [
  "regalón",
  "glotón",
  "flojo",
  "aventurero",
  "mañoso",
  "guardián",
  "payaso"
];

export const PERSONALITY_OPTIONS: Option[] = [
  {
    "key": "regalon",
    "label": "El regalón de la casa",
    "emoji": "🥰"
  },
  {
    "key": "terremoto",
    "label": "Un pequeño terremoto",
    "emoji": "⚡"
  },
  {
    "key": "dormilon",
    "label": "Dormilón profesional",
    "emoji": "😴"
  },
  {
    "key": "aventurero",
    "label": "Aventurero de corazón",
    "emoji": "🏕️"
  },
  {
    "key": "travieso",
    "label": "Travieso pero irresistible",
    "emoji": "😼"
  }
];
export const PERSONALITY_LABELS: Record<string, string> = Object.fromEntries(PERSONALITY_OPTIONS.map((o) => [o.key, o.label]));

export const EMOTIONS: Option[] = [
  {
    "key": "ternura",
    "label": "Ternura",
    "emoji": "🥹"
  },
  {
    "key": "risa",
    "label": "Risa",
    "emoji": "😂"
  },
  {
    "key": "alegria",
    "label": "Alegría",
    "emoji": "😊"
  },
  {
    "key": "orgullo",
    "label": "Orgullo",
    "emoji": "🏅"
  },
  {
    "key": "nostalgia",
    "label": "Nostalgia",
    "emoji": "🍂"
  },
  {
    "key": "amor",
    "label": "Amor",
    "emoji": "❤️"
  },
  {
    "key": "calma",
    "label": "Calma",
    "emoji": "🌿"
  },
  {
    "key": "gratitud",
    "label": "Gratitud",
    "emoji": "🙏"
  }
];
export const EMOTION_LABELS: Record<string, string> = Object.fromEntries(EMOTIONS.map((e) => [e.key, e.label]));

export const PORTRAIT_STYLES: Record<string, StyleDef> = {
  // ---- Tu foto, mejorada: the real photo stays the real photo ----
  "polaroid": {
    "label": "Polaroid",
    "emoji": "📸",
    "desc": "Tu foto tal cual, en una polaroid con su nombre escrito a mano",
    "prompt": "", "mode": "render", "group": "foto"
  },
  "revista": {
    "label": "Portada de revista",
    "emoji": "📰",
    "desc": "Tu mascota en la portada de la revista Petito",
    "prompt": "", "mode": "render", "group": "foto"
  },
  "antigua": {
    "label": "Foto antigua",
    "emoji": "🎞️",
    "desc": "Revelado sepia con borde de álbum y fecha",
    "prompt": "", "mode": "render", "group": "foto"
  },
  "estudio": {
    "label": "Foto de estudio",
    "emoji": "💡",
    "desc": "Tu foto real con fondo de estudio y luz profesional",
    "prompt": "a professional pet photography studio: replace only the background with a smooth, softly lit neutral studio backdrop (warm beige to charcoal gradient) and add gentle professional studio lighting and a subtle catchlight in the eyes",
    "mode": "edit", "group": "foto"
  },
  "coronita": {
    "label": "Con coronita",
    "emoji": "👑",
    "desc": "Tu foto real con una pequeña corona y capa de terciopelo",
    "prompt": "add a small, realistic golden crown resting naturally on the pet's head and a short red velvet cape with white fur trim around its shoulders, matching the photo's real lighting and perspective; keep the real background",
    "mode": "edit", "group": "foto"
  },
  "flores": {
    "label": "Entre flores",
    "emoji": "🌸",
    "desc": "Tu foto real rodeada de flores frescas",
    "prompt": "surround the pet with real-looking fresh flowers (peonies, daisies and eucalyptus) in the foreground and background, soft natural daylight, photorealistic, like a professional spring photoshoot",
    "mode": "edit", "group": "foto"
  },
  // ---- Pinturas: the AI repaints the photo ----
  "renacentista": {
    "mode": "paint", "group": "pintura",
    "label": "Renacentista",
    "emoji": "🎨",
    "desc": "Óleo clásico, telón oscuro y vestuario de época",
    "prompt": "a masterful classical Renaissance oil painting portrait, the pet wearing regal Renaissance noble attire such as a velvet robe and a ruffled lace collar, dramatic chiaroscuro lighting, dark elegant painted background, visible oil brush strokes, museum masterpiece style"
  },
  "victoriano": {
    "mode": "paint", "group": "pintura",
    "label": "Victoriano",
    "emoji": "🎩",
    "desc": "Atuendo aristócrata: capa, encaje y joyas",
    "prompt": "a refined Victorian aristocratic oil painting portrait, the pet dressed as a noble aristocrat with a velvet cape, delicate lace, pearls and jewels, dignified regal pose, soft classic painted studio background, elegant and stately mood"
  },
  "halloween": {
    "mode": "paint", "group": "pintura",
    "label": "Halloween",
    "emoji": "🎃",
    "desc": "Retrato clásico con toque gótico de Halloween",
    "prompt": "a classical oil painting portrait with an elegant gothic Halloween theme, warm candlelight and flickering candles, subtle cobwebs, deep moody dark tones, the pet wearing a small aristocratic costume, spooky yet refined mansion background"
  },
  "vampiro": {
    "mode": "paint", "group": "pintura",
    "label": "Conde vampiro",
    "emoji": "🦇",
    "desc": "Capa negra y roja, castillo y luna llena",
    "prompt": "a dramatic gothic oil painting portrait of the pet as an elegant vampire count, wearing a high-collared black cape with a deep crimson silk lining and a ruby brooch, moonlit stone castle balcony at night, a huge full moon and small bats in the sky, cool blue moonlight with warm candle accents, charming rather than scary"
  },
  "bruja": {
    "mode": "paint", "group": "pintura",
    "label": "Bruja",
    "emoji": "🧙",
    "desc": "Sombrero puntudo, caldero y pociones",
    "prompt": "a whimsical classical oil painting portrait of the pet as a charming witch, wearing a tall crooked pointed black witch hat with a purple ribbon and a small velvet cloak, cozy candlelit witch's study with a bubbling cauldron giving off soft green glow, potion bottles, old spell books and dried herbs, warm magical atmosphere"
  },
  "calabazas": {
    "mode": "paint", "group": "pintura",
    "label": "Noche de calabazas",
    "emoji": "🌕",
    "desc": "Huerto de calabazas iluminadas bajo la luna",
    "prompt": "a warm storybook oil painting portrait of the pet sitting in an autumn pumpkin patch at dusk, surrounded by glowing carved jack-o'-lanterns with friendly smiling faces, fallen orange leaves, a cozy knitted orange and black scarf around its neck, a big golden harvest moon in a deep purple sky, warm orange glow, sweet and festive rather than spooky"
  },
  "casa_embrujada": {
    "mode": "paint", "group": "pintura",
    "label": "Casa embrujada",
    "emoji": "👻",
    "desc": "Mansión antigua con fantasmitas amistosos",
    "prompt": "a playful classical oil painting portrait of the pet in a grand old haunted Victorian mansion hall, wearing a small explorer's tweed cap and holding a brass lantern, a few cute translucent friendly little ghosts floating in the background, dusty chandelier, cobwebs and moonlight through tall windows, misty bluish tones with warm lantern light, cute rather than scary"
  }
};

/** Frame around a royal/Halloween portrait, chosen separately from the style. */
export type FrameDef = { label: string; desc: string; prompt: string };
export const PORTRAIT_FRAMES: Record<string, FrameDef> = {
  dorado: { label: "Dorado clásico", desc: "Barroco tallado en oro", prompt: "displayed inside an ornate hand-carved gilded golden baroque frame with carved flourishes, as if hanging in a palace" },
  madera: { label: "Madera tallada", desc: "Nogal oscuro con filo dorado", prompt: "displayed inside an elegant hand-carved dark walnut wooden frame with a thin antique gold inner lip" },
  negro_gotico: { label: "Negro gótico", desc: "Laca negra, filigrana y detalles plateados", prompt: "displayed inside an ornate black lacquered gothic frame with carved filigree, delicate spiderweb and tiny bat details and subtle silver highlights" },
  plata: { label: "Plata antigua", desc: "Plata grabada con pátina suave", prompt: "displayed inside an ornate antique silver frame with fine engraved floral details and a soft patina" },
  sin_marco: { label: "Sin marco", desc: "La pintura ocupa todo el cuadro", prompt: "an edge-to-edge painting with no frame at all, the artwork fills the whole image" },
};
/** Frame each style starts with (people can change it). */
export const STYLE_DEFAULT_FRAME: Record<string, string> = {
  renacentista: "dorado", victoriano: "dorado", halloween: "negro_gotico",
  vampiro: "negro_gotico", bruja: "negro_gotico", calabazas: "madera", casa_embrujada: "negro_gotico",
};
export const frameFor = (style: string, frame?: string | null) =>
  PORTRAIT_FRAMES[frame ?? ""] ?? PORTRAIT_FRAMES[STYLE_DEFAULT_FRAME[style] ?? "dorado"];
export const styleMode = (style: string): StyleMode => PORTRAIT_STYLES[style]?.mode ?? "paint";
/** Frames only make sense on paintings. */
export const styleHasFrame = (style: string) => styleMode(style) === "paint";

export const MEMORIAL_STYLES: Record<string, StyleDef> = {
  "acuarela": {
    "label": "Acuarela",
    "emoji": "🕊️",
    "desc": "Acuarela suave y serena, delicada y luminosa",
    "prompt": "a gentle serene fine-art watercolor painting portrait, soft pastel washes and delicate flowing brush strokes, light airy pale background, peaceful loving and calm mood, tender soft light, faithfully preserving the pet's real features and sweet expression, no text, no frame"
  },
  "oleo_realista": {
    "label": "Óleo realista",
    "emoji": "🖼️",
    "desc": "Óleo realista que conserva su esencia",
    "prompt": "a realistic fine-art oil painting portrait, lifelike faithful detail that preserves the pet's real features and gentle expression, soft warm natural lighting, calm neutral muted background, dignified serene and tender mood, museum-quality, no text, no frame"
  }
};
export const ALL_PORTRAIT_STYLES: Record<string, StyleDef> = { ...PORTRAIT_STYLES, ...MEMORIAL_STYLES };

export const TALK_SCENARIOS: Record<string, TalkScenario> = {
  "chistoso": {
    "label": "Algo chistoso",
    "emoji": "😄",
    "hint": "una frase graciosa y tierna saludando a la cámara"
  },
  "cumpleanos": {
    "label": "Feliz cumpleaños",
    "emoji": "🎂",
    "hint": "un saludo tierno y alegre de feliz cumpleaños a su familia"
  },
  "te_amo": {
    "label": "Te amo",
    "emoji": "❤️",
    "hint": "una declaración de amor dulce y tierna a su familia"
  },
  "te_extrano": {
    "label": "Te extraño",
    "emoji": "🥺",
    "hint": "decir con ternura cuánto extraña a su familia y que la espera"
  },
  "gracias": {
    "label": "Gracias",
    "emoji": "🙏",
    "hint": "agradecer con cariño a su familia por cuidarlo y quererlo"
  }
};
export const TALK_MESSAGE_MAX = 160;

/** "Tu mascota te canta": music styles. `styles` go to ElevenLabs Music, `feel` guides the lyric writer. */
export type SongStyle = { label: string; emoji: string; styles: string[]; feel: string };
export const SONG_STYLES: Record<string, SongStyle> = {
  cumbia: { label: "Cumbia chilena", emoji: "🪗", styles: ["cumbia chilena", "upbeat", "accordion and brass", "festive"], feel: "fiestera y pegajosa, como cumbia de matrimonio chileno" },
  balada: { label: "Balada romántica", emoji: "💖", styles: ["romantic latin ballad", "soft piano and strings", "emotional", "slow"], feel: "tierna y emocionante, como balada de los 90" },
  pop: { label: "Pop alegre", emoji: "🎉", styles: ["catchy latin pop", "bright", "hand claps", "sing-along chorus"], feel: "alegre y cantable, con un coro que se pega" },
  reggaeton: { label: "Reggaetón suave", emoji: "🔥", styles: ["soft reggaeton", "dembow beat", "playful", "summer"], feel: "juguetona y con flow, sin groserías" },
  cueca: { label: "Cueca", emoji: "🇨🇱", styles: ["cueca chilena", "guitar and tambourine", "lively folk", "handclaps"], feel: "dieciochera y picarona, con picardía de cueca" },
};
/** "Tu mascota en movimiento": the real pet (as a reference element) in a short scene. */
export type MotionScene = { label: string; emoji: string; prompt: string };
export const MOTION_SCENES: Record<string, MotionScene> = {
  baile: { label: "Bailando", emoji: "💃", prompt: "dancing happily to upbeat music in a living room, bouncing and wiggling to the beat, tail wagging, warm party lights, playful and funny" },
  playa: { label: "En la playa", emoji: "🏖️", prompt: "running joyfully along a sunny Chilean beach at golden hour, splashing through small waves, sand flying, slow-motion feel" },
  regalo: { label: "Abriendo un regalo", emoji: "🎁", prompt: "excitedly tearing the wrapping paper off a big birthday gift with its paws, confetti falling, happy surprised reaction" },
  nieve: { label: "En la nieve", emoji: "❄️", prompt: "playing in gently falling snow in a pine forest, catching snowflakes, leaving paw prints, cozy winter light" },
  superheroe: { label: "Superhéroe", emoji: "🦸", prompt: "wearing a small red cape, striking a heroic pose on a rooftop at sunset as the cape flutters in the wind, then turning to the camera, cinematic" },
};
export const MOTION_SECONDS = 5;

/** Seconds of song (and of lip-synced video): keep it short, the video costs by the second. */
export const SONG_SECONDS = 18;

export const VOICES: Voice[] = [
  {
    "id": "G5fUGgDJhRU7jqXTv65B",
    "label": "Cálida y alegre"
  },
  {
    "id": "4q0PbHS9CvGUVibwij58",
    "label": "Chilenazo"
  },
  {
    "id": "nYm4p0R8BhHFRBH8wGHm",
    "label": "Narrador tierno"
  },
  {
    "id": "fZfhCzqImeCHqeFIpNOv",
    "label": "Dinámica"
  }
];
export const DEFAULT_VOICE_ID = VOICES[0].id;
const VALID_VOICE_IDS = new Set(VOICES.map((v) => v.id));
export function validVoice(voiceId?: string | null): string {
  return voiceId && VALID_VOICE_IDS.has(voiceId) ? voiceId : DEFAULT_VOICE_ID;
}
export const VOICE_SAMPLE_TEXT = "¡Hola! Soy tu regalón. ¿Jugamos un ratito?";

// Slide ordering inside a story (title=0, photos 1..n, bonus 100+i, closing last).
export const BONUS_ORDER_BASE = 100;
export const CLOSING_ORDER = 9999;
