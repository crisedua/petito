import os
import asyncio
import re
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Header, Request, Depends, Response as FastResponse
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
import httpx

import models
import storage
import renderer
import ai_pipeline
import narration
import payments
from models import Story, Slide, StoryCreate, SurveyResponse, SurveySubmit, Portrait, PortraitCreate, TalkingVideo, TalkCreate, Pet, PetCreate, PetUpdate, Memory, MemoryCreate, MemoryUpdate, THEMES, SPECIES, PORTRAIT_STYLES, MEMORIAL_STYLES, PERSONALITY_OPTIONS, PERSONALITY_LABELS, EMOTIONS, EMOTION_LABELS, TALK_SCENARIOS, TALK_MESSAGE_MAX, now_utc, iso_now, new_id

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Brand is permanently "Petito" / "petito.pro" — fixed in the product so no server
# configuration can ever bake the old "Cuentapatas" name into new creations.
BRAND_NAME = "Petito"
BRAND_URL = "petito.pro"
PRICE_CLP = int(os.environ.get("STORY_PRICE_CLP", "3990"))
PORTRAIT_PRICE_CLP = int(os.environ.get("PORTRAIT_PRICE_CLP", "2990"))
ALL_PORTRAIT_STYLES = {**PORTRAIT_STYLES, **MEMORIAL_STYLES}
TALK_PRICE_CLP = int(os.environ.get("TALK_PRICE_CLP", "2990"))
FREE_TALK_PER_DAY = int(os.environ.get("FREE_TALK_PER_DAY", "2"))
USD_TO_CLP = float(os.environ.get("USD_TO_CLP", "950"))
FREE_PER_DAY = int(os.environ.get("FREE_PREVIEWS_PER_DAY", "3"))
BONUS_ENABLED = os.environ.get("BONUS_SCENES_ENABLED", "true").lower() == "true"
BONUS_SCENES_COUNT = max(1, min(3, int(os.environ.get("BONUS_SCENES_COUNT", "3"))))
FREE_MODE = os.environ.get("FREE_MODE", "true").lower() == "true"
RETENTION_DAYS = int(os.environ.get("PHOTO_RETENTION_DAYS", "7"))
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_DAYS = 7

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("petito")

app = FastAPI()
api_router = APIRouter(prefix="/api")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
PUBLIC_API_URL = os.environ.get("PUBLIC_API_URL", "")
provider = payments.build_provider(FRONTEND_URL, PUBLIC_API_URL)

# ---- Petito Plus (suscripción) ----
PLUS_MONTHLY_CLP = int(os.environ.get("PLUS_MONTHLY_CLP", "3900"))
PLUS_ANNUAL_CLP = int(os.environ.get("PLUS_ANNUAL_CLP", "29900"))
PLUS_PLANS = {
    "monthly": {"reason": "Petito Plus mensual", "amount": PLUS_MONTHLY_CLP, "frequency": 1, "days": 31},
    "annual": {"reason": "Petito Plus anual", "amount": PLUS_ANNUAL_CLP, "frequency": 12, "days": 366},
}


async def is_plus(user_id: str) -> bool:
    if not user_id:
        return False
    sub = await db.subscriptions.find_one({"user_id": user_id, "membership_active": True}, {"_id": 0, "plus_until": 1})
    if not sub:
        return False
    until = sub.get("plus_until")
    if until and until < iso_now():
        await db.subscriptions.update_one({"user_id": user_id}, {"$set": {"membership_active": False}})
        return False
    return True


# ---------------- helpers ----------------
async def get_story(story_id: str):
    doc = await db.stories.find_one({"id": story_id}, {"_id": 0})
    return Story(**doc) if doc else None


async def get_story_by_slug(slug: str):
    doc = await db.stories.find_one({"share_slug": slug}, {"_id": 0})
    return Story(**doc) if doc else None


async def get_portrait(portrait_id: str):
    doc = await db.portraits.find_one({"id": portrait_id}, {"_id": 0})
    return Portrait(**doc) if doc else None


async def get_portrait_by_slug(slug: str):
    doc = await db.portraits.find_one({"share_slug": slug}, {"_id": 0})
    return Portrait(**doc) if doc else None


# ---------------- auth (Emergent Google) ----------------
def _bearer_token(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:].strip()
    return token or None


async def _user_from_token(token: str):
    if not token:
        return None
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    exp = sess.get("expires_at")
    if isinstance(exp, str):
        try:
            exp = datetime.fromisoformat(exp)
        except ValueError:
            return None
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < now_utc():
        return None
    return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})


async def require_user(request: Request):
    user = await _user_from_token(_bearer_token(request))
    if not user:
        raise HTTPException(401, "Inicia sesión para continuar")
    return user


async def optional_user(request: Request):
    return await _user_from_token(_bearer_token(request))


async def require_admin(request: Request):
    user = await require_user(request)
    if user.get("email", "").lower() not in ADMIN_EMAILS:
        raise HTTPException(403, "No autorizado")
    return user


def _user_public(user):
    return {
        "user_id": user["user_id"], "email": user["email"],
        "name": user.get("name"), "picture": user.get("picture"),
        "is_admin": user.get("email", "").lower() in ADMIN_EMAILS,
    }


@api_router.post("/auth/session")
async def auth_session(request: Request, response: FastResponse):
    sid = request.headers.get("X-Session-ID")
    if not sid:
        raise HTTPException(400, "Falta session id")
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": sid})
        r.raise_for_status()
        data = r.json()
    except Exception:
        raise HTTPException(401, "No se pudo validar la sesión")
    email = (data.get("email") or "").strip()
    if not email:
        raise HTTPException(401, "Sesión inválida")
    name, picture = data.get("name"), data.get("picture")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {"user_id": f"user_{new_id().replace('-', '')[:12]}", "email": email,
                "name": name, "picture": picture, "created_at": iso_now()}
        await db.users.insert_one(dict(user))
    else:
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
        user["name"], user["picture"] = name, picture
    token = data.get("session_token") or new_id()
    await db.user_sessions.insert_one({
        "user_id": user["user_id"], "session_token": token,
        "expires_at": (now_utc() + timedelta(days=SESSION_DAYS)).isoformat(),
        "created_at": iso_now()})
    response.set_cookie("session_token", token, httponly=True, secure=True,
                        samesite="none", path="/", max_age=SESSION_DAYS * 24 * 3600)
    return {"user": _user_public(user), "session_token": token}


@api_router.get("/auth/me")
async def auth_me(user=Depends(require_user)):
    return _user_public(user)


@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: FastResponse):
    token = _bearer_token(request)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api_router.get("/me/stories")
async def my_stories(user=Depends(require_user)):
    docs = await db.stories.find({"user_id": user["user_id"], "status": {"$ne": "draft"}},
                                 {"_id": 0}).sort("created_at", -1).to_list(200)
    return [{
        "id": d["id"], "slug": d["share_slug"], "pet_name": d["pet_name"],
        "title": d.get("title"), "theme_label": THEMES.get(d["theme"], {}).get("label", d["theme"]),
        "status": d["status"], "paid": d["status"] == "paid" or FREE_MODE,
        "thumb_url": f"/api/media/{d['id']}/slide_0.jpg",
        "created_at": d["created_at"],
    } for d in docs]


@api_router.get("/me/portraits")
async def my_portraits(user=Depends(require_user)):
    docs = await db.portraits.find({"user_id": user["user_id"],
                                    "status": {"$in": ["preview_ready", "paid"]}},
                                   {"_id": 0}).sort("created_at", -1).to_list(200)
    return [{
        "id": d["id"], "slug": d["share_slug"], "pet_name": d.get("pet_name"),
        "style_label": ALL_PORTRAIT_STYLES.get(d["style"], {}).get("label", d["style"]),
        "category": d.get("category", "royal"),
        "status": d["status"], "paid": d["status"] == "paid",
        "thumb_url": f"/api/media/{d['id']}/preview.jpg",
        "gift_enabled": d.get("gift_enabled", False),
        "created_at": d["created_at"],
    } for d in docs]


# ---------------- pets ("El universo de mi mascota") ----------------
async def get_pet(pet_id: str, user_id: str):
    doc = await db.pets.find_one({"id": pet_id, "user_id": user_id}, {"_id": 0})
    return Pet(**doc) if doc else None


def pet_public(p: Pet):
    return {
        "id": p.id,
        "slug": p.share_slug,
        "name": p.name,
        "species": p.species,
        "personality": p.personality,
        "personality_text": p.personality_text,
        "personality_labels": [PERSONALITY_LABELS.get(k, k) for k in p.personality],
        "favorite_memory": p.favorite_memory,
        "photo_url": f"/api/media/{p.id}/{p.photo_file}" if p.photo_file else None,
        "intro_text": p.intro_text,
        "birthday": p.birthday,
        "adoption_date": p.adoption_date,
        "public_enabled": p.public_enabled,
        "share_slug": p.share_slug,
        "created_at": p.created_at,
    }


@api_router.get("/pets/meta")
async def pets_meta():
    return {
        "species": [{"key": k, "label": v} for k, v in SPECIES.items()],
        "personality_options": PERSONALITY_OPTIONS,
    }


@api_router.post("/pets")
async def create_pet(payload: PetCreate, user=Depends(require_user)):
    name = (payload.name or "").strip()[:40]
    if not name:
        raise HTTPException(400, "Ponle un nombre a tu mascota")
    existing = await db.pets.count_documents({"user_id": user["user_id"]})
    if existing >= 1 and not await is_plus(user["user_id"]):
        raise HTTPException(402, "El plan gratis incluye 1 mascota. ¡Hazte Plus para crear universos ilimitados!")
    valid_personality = [k for k in payload.personality if k in PERSONALITY_LABELS][:5]
    pet = Pet(
        user_id=user["user_id"], name=name,
        species=payload.species if payload.species in SPECIES else "perro",
        personality=valid_personality,
        personality_text=(payload.personality_text or "").strip()[:200] or None,
        favorite_memory=(payload.favorite_memory or "").strip()[:400] or None,
    )
    await db.pets.insert_one(pet.model_dump())
    return pet_public(pet)


@api_router.post("/pets/{pet_id}/photo")
async def upload_pet_photo(pet_id: str, files: list[UploadFile] = File(...), user=Depends(require_user)):
    pet = await get_pet(pet_id, user["user_id"])
    if not pet:
        raise HTTPException(404, "Mascota no encontrada")
    if not files:
        raise HTTPException(400, "Sube una foto")
    raw = await _read_capped(files[0])
    if not raw:
        raise HTTPException(400, "Foto vacía")
    try:
        name = await asyncio.to_thread(storage.save_original, pet.id, 0, raw)
    except Exception:
        logger.exception("pet photo: could not process")
        raise HTTPException(400, "No pudimos leer esta foto. Prueba con otra (JPG, PNG o foto de iPhone).")
    finally:
        del raw
    await db.pets.update_one({"id": pet.id}, {"$set": {"photo_file": name}})
    return {"ok": True, "photo_url": f"/api/media/{pet.id}/{name}"}


@api_router.post("/pets/{pet_id}/reveal")
async def reveal_pet(pet_id: str, user=Depends(require_user)):
    pet = await get_pet(pet_id, user["user_id"])
    if not pet:
        raise HTTPException(404, "Mascota no encontrada")
    if not pet.photo_file:
        raise HTTPException(400, "Falta la foto de tu mascota")
    labels = ", ".join([PERSONALITY_LABELS.get(k, k) for k in pet.personality])
    if pet.personality_text:
        labels = (labels + ("; " if labels else "") + pet.personality_text)
    try:
        photo_b64 = await asyncio.to_thread(storage.image_to_b64, pet.id, pet.photo_file, 512)
        intro, usage = await ai_pipeline.write_pet_intro(
            photo_b64, pet.name, pet.species, labels, pet.favorite_memory)
    except Exception as e:
        logger.exception("pet reveal failed")
        if "INSUFFICIENT_CREDITS" in str(e):
            raise HTTPException(402, "Sin crédito para generar. Agrega saldo a tu Universal Key.")
        intro = (f"{pet.name} llegó para llenar de cariño cada día. Este es el comienzo de su "
                 f"universo, donde cada recuerdo tendrá su lugar. 🐾")
        usage = None
    await db.pets.update_one({"id": pet.id}, {"$set": {"intro_text": intro}})
    if usage:
        await log_generation(pet.id, "pet_intro", ai_pipeline.CLAUDE_MODEL, usage=usage,
                             cost_usd=ai_pipeline.claude_cost(usage))
    return {"intro_text": intro}


@api_router.get("/pets")
async def list_pets(user=Depends(require_user)):
    docs = await db.pets.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(50)
    return [pet_public(Pet(**d)) for d in docs]


@api_router.get("/pets/{pet_id}")
async def read_pet(pet_id: str, user=Depends(require_user)):
    pet = await get_pet(pet_id, user["user_id"])
    if not pet:
        raise HTTPException(404, "Mascota no encontrada")
    return pet_public(pet)


@api_router.put("/pets/{pet_id}")
async def update_pet(pet_id: str, payload: PetUpdate, user=Depends(require_user)):
    pet = await get_pet(pet_id, user["user_id"])
    if not pet:
        raise HTTPException(404, "Mascota no encontrada")
    upd = {}
    if payload.name is not None:
        n = payload.name.strip()[:40]
        if not n:
            raise HTTPException(400, "El nombre no puede quedar vacío")
        upd["name"] = n
    if payload.species is not None:
        upd["species"] = payload.species if payload.species in SPECIES else pet.species
    if payload.personality is not None:
        upd["personality"] = [k for k in payload.personality if k in PERSONALITY_LABELS][:5]
    if payload.personality_text is not None:
        upd["personality_text"] = payload.personality_text.strip()[:200] or None
    if payload.birthday is not None:
        upd["birthday"] = payload.birthday.strip()[:10] or None
    if payload.adoption_date is not None:
        upd["adoption_date"] = payload.adoption_date.strip()[:10] or None
    if payload.public_enabled is not None:
        upd["public_enabled"] = bool(payload.public_enabled)
    await db.pets.update_one({"id": pet.id}, {"$set": upd})
    return pet_public(await get_pet(pet.id, user["user_id"]))


@api_router.delete("/pets/{pet_id}")
async def delete_pet(pet_id: str, user=Depends(require_user)):
    pet = await get_pet(pet_id, user["user_id"])
    if not pet:
        raise HTTPException(404, "Mascota no encontrada")
    await db.pets.delete_one({"id": pet.id})
    await db.memories.delete_many({"pet_id": pet.id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------- public pet album ("/u/:slug") ----------------
@api_router.get("/u/{slug}")
async def public_pet_album(slug: str):
    pet_doc = await db.pets.find_one({"share_slug": slug, "public_enabled": True}, {"_id": 0})
    if not pet_doc:
        raise HTTPException(404, "Álbum no encontrado o privado")
    pet = Pet(**pet_doc)
    mems = await db.memories.find({"pet_id": pet.id, "shared": True}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {
        "name": pet.name, "species": pet.species, "intro_text": pet.intro_text,
        "photo_url": f"/api/media/{pet.id}/{pet.photo_file}" if pet.photo_file else None,
        "memories": [{
            "title": m["title"],
            "happened_on": None if m.get("date_unknown") else m.get("happened_on"),
            "date_unknown": m.get("date_unknown", False),
            "feeling_text": m.get("feeling_text"),
            "emotion_labels": [{"key": k, "label": EMOTION_LABELS.get(k, k),
                                "emoji": next((e["emoji"] for e in EMOTIONS if e["key"] == k), "")}
                               for k in m.get("emotions", [])],
            "photo_url": f"/api/media/{m['id']}/{m['photo_file']}" if m.get("photo_file") else None,
        } for m in mems],
    }


@api_router.get("/pets/{pet_id}/creations")
async def pet_creations(pet_id: str, user=Depends(require_user)):
    pet = await get_pet(pet_id, user["user_id"])
    if not pet:
        raise HTTPException(404, "Mascota no encontrada")
    out = []
    stories = await db.stories.find({"pet_id": pet.id, "user_id": user["user_id"],
                                     "status": {"$ne": "draft"}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for d in stories:
        out.append({"kind": "historia", "id": d["id"], "slug": d["share_slug"],
                    "title": d.get("title") or "Historia", "thumb_url": f"/api/media/{d['id']}/slide_0.jpg",
                    "view_path": f"/h/{d['share_slug']}", "created_at": d["created_at"]})
    portraits = await db.portraits.find({"pet_id": pet.id, "user_id": user["user_id"],
                                         "status": {"$in": ["preview_ready", "paid"]}},
                                        {"_id": 0}).sort("created_at", -1).to_list(100)
    for d in portraits:
        label = ALL_PORTRAIT_STYLES.get(d["style"], {}).get("label", d["style"])
        out.append({"kind": "recuerdo" if d.get("category") == "memorial" else "retrato",
                    "id": d["id"], "slug": d["share_slug"], "title": label,
                    "thumb_url": f"/api/media/{d['id']}/preview.jpg",
                    "view_path": f"/r/{d['share_slug']}", "created_at": d["created_at"]})
    videos = await db.videos.find({"pet_id": pet.id, "user_id": user["user_id"],
                                   "status": {"$in": ["preview_ready", "paid"]}},
                                  {"_id": 0}).sort("created_at", -1).to_list(100)
    for d in videos:
        out.append({"kind": "video", "id": d["id"], "slug": d["share_slug"], "title": "Video que habla",
                    "thumb_url": f"/api/media/{d['id']}/source.jpg",
                    "view_path": f"/v/{d['share_slug']}", "created_at": d["created_at"]})
    out.sort(key=lambda x: x["created_at"], reverse=True)
    return out


async def _validate_pet_id(pet_id, user_id):
    """Return pet_id if it belongs to the user, else None."""
    if not pet_id:
        return None
    pet = await db.pets.find_one({"id": pet_id, "user_id": user_id}, {"_id": 1})
    return pet_id if pet else None



# ---------------- memories ("Nuestra historia") ----------------
async def get_memory(memory_id: str, user_id: str):
    doc = await db.memories.find_one({"id": memory_id, "user_id": user_id}, {"_id": 0})
    return Memory(**doc) if doc else None


def memory_public(m: Memory):
    return {
        "id": m.id,
        "pet_id": m.pet_id,
        "title": m.title,
        "happened_on": m.happened_on,
        "date_unknown": m.date_unknown,
        "feeling_text": m.feeling_text,
        "emotions": m.emotions,
        "emotion_labels": [{"key": k, "label": EMOTION_LABELS.get(k, k),
                            "emoji": next((e["emoji"] for e in EMOTIONS if e["key"] == k), "")}
                           for k in m.emotions],
        "photo_url": f"/api/media/{m.id}/{m.photo_file}" if m.photo_file else None,
        "ai_reflection": m.ai_reflection,
        "shared": m.shared,
        "created_at": m.created_at,
        "updated_at": m.updated_at,
    }


@api_router.get("/memories/meta")
async def memories_meta():
    return {"emotions": EMOTIONS}


@api_router.post("/pets/{pet_id}/memories")
async def create_memory(pet_id: str, payload: MemoryCreate, user=Depends(require_user)):
    pet = await get_pet(pet_id, user["user_id"])
    if not pet:
        raise HTTPException(404, "Mascota no encontrada")
    title = (payload.title or "").strip()[:80]
    if not title:
        raise HTTPException(400, "Ponle un título a este recuerdo")
    m = Memory(
        pet_id=pet.id, user_id=user["user_id"], title=title,
        happened_on=(payload.happened_on or "").strip()[:40] or None,
        date_unknown=bool(payload.date_unknown),
        feeling_text=(payload.feeling_text or "").strip()[:1500] or None,
        emotions=[e for e in payload.emotions if e in EMOTION_LABELS][:6],
    )
    await db.memories.insert_one(m.model_dump())
    return memory_public(m)


@api_router.post("/memories/{memory_id}/photo")
async def upload_memory_photo(memory_id: str, files: list[UploadFile] = File(...), user=Depends(require_user)):
    m = await get_memory(memory_id, user["user_id"])
    if not m:
        raise HTTPException(404, "Recuerdo no encontrado")
    if not files:
        raise HTTPException(400, "Sube una foto")
    raw = await _read_capped(files[0])
    if not raw:
        raise HTTPException(400, "Foto vacía")
    try:
        name = await asyncio.to_thread(storage.save_original, m.id, 0, raw)
    except Exception:
        logger.exception("memory photo: could not process")
        raise HTTPException(400, "No pudimos leer esta foto. Prueba con otra (JPG, PNG o foto de iPhone).")
    finally:
        del raw
    await db.memories.update_one({"id": m.id}, {"$set": {"photo_file": name}})
    return {"ok": True, "photo_url": f"/api/media/{m.id}/{name}"}


@api_router.post("/memories/{memory_id}/reflect")
async def reflect_memory(memory_id: str, user=Depends(require_user)):
    m = await get_memory(memory_id, user["user_id"])
    if not m:
        raise HTTPException(404, "Recuerdo no encontrado")
    if not m.ai_reflection and not await is_plus(user["user_id"]):
        month = iso_now()[:7]
        count = await db.memories.count_documents({
            "user_id": user["user_id"], "ai_reflection": {"$ne": None},
            "created_at": {"$regex": f"^{month}"}})
        if count >= 3:
            raise HTTPException(402, "Llegaste a tus 3 pensamientos de Petito gratis del mes. ¡Hazte Plus para tenerlos sin límite!")
    pet = await get_pet(m.pet_id, user["user_id"])
    pet_name = pet.name if pet else "tu mascota"
    labels = ", ".join([EMOTION_LABELS.get(k, k) for k in m.emotions])
    try:
        photo_b64 = None
        if m.photo_file:
            photo_b64 = await asyncio.to_thread(storage.image_to_b64, m.id, m.photo_file, 512)
        reflection, usage = await ai_pipeline.write_memory_reflection(
            pet_name, m.title, m.feeling_text, labels, photo_b64)
    except Exception as e:
        logger.exception("memory reflection failed")
        if "INSUFFICIENT_CREDITS" in str(e):
            raise HTTPException(402, "Sin crédito para generar. Agrega saldo a tu Universal Key.")
        reflection = (f"Qué lindo guardar este momento con {pet_name}. Algunos instantes se quedan "
                      f"en el corazón para siempre. 🤍")
        usage = None
    await db.memories.update_one({"id": m.id}, {"$set": {"ai_reflection": reflection}})
    if usage:
        await log_generation(m.id, "memory_reflection", ai_pipeline.CLAUDE_MODEL, usage=usage,
                             cost_usd=ai_pipeline.claude_cost(usage))
    return {"ai_reflection": reflection}


@api_router.post("/memories/{memory_id}/reflect/hide")
async def hide_memory_reflection(memory_id: str, user=Depends(require_user)):
    m = await get_memory(memory_id, user["user_id"])
    if not m:
        raise HTTPException(404, "Recuerdo no encontrado")
    await db.memories.update_one({"id": m.id}, {"$set": {"ai_reflection": None}})
    return {"ok": True}


@api_router.post("/memories/{memory_id}/share")
async def toggle_memory_share(memory_id: str, user=Depends(require_user)):
    m = await get_memory(memory_id, user["user_id"])
    if not m:
        raise HTTPException(404, "Recuerdo no encontrado")
    new_val = not m.shared
    await db.memories.update_one({"id": m.id}, {"$set": {"shared": new_val}})
    return {"shared": new_val}


VOICE_SAMPLE_TEXT = "¡Hola! Soy tu regalón. ¿Jugamos un ratito?"


@api_router.get("/voice-sample/{voice_id}")
async def voice_sample(voice_id: str):
    vid = narration.valid_voice(voice_id)
    name = f"{vid}.mp3"
    if not await asyncio.to_thread(storage.exists, "voicesamples", name):
        if not narration.NARRATION_ENABLED:
            raise HTTPException(503, "Voces no disponibles")
        try:
            audio = await asyncio.to_thread(narration.generate_narration, VOICE_SAMPLE_TEXT, vid, 1.0)
            await asyncio.to_thread(storage.save_bytes, "voicesamples", name, audio, "audio/mpeg")
        except Exception:
            logger.exception("voice sample failed")
            raise HTTPException(502, "No se pudo generar la muestra")
    return {"url": f"/api/media/voicesamples/{name}"}


# ---------------- Petito Plus (suscripción) ----------------
def _plus_until_from(sub_status_date, days):
    from datetime import timedelta
    return (now_utc() + timedelta(days=days)).isoformat()


async def _activate_plus(preapproval_id, status, next_payment_date=None):
    """Update local subscription from a real Mercado Pago preapproval status."""
    sub = await db.subscriptions.find_one({"mp_id": preapproval_id}, {"_id": 0})
    if not sub:
        return
    active = status == "authorized"
    days = PLUS_PLANS.get(sub.get("plan", "monthly"), PLUS_PLANS["monthly"])["days"]
    upd = {"status": status, "membership_active": active, "next_payment_date": next_payment_date}
    if active:
        upd["plus_until"] = _plus_until_from(next_payment_date, days)
    await db.subscriptions.update_one({"mp_id": preapproval_id}, {"$set": upd})


@api_router.get("/plus/status")
async def plus_status(user=Depends(require_user)):
    sub = await db.subscriptions.find_one({"user_id": user["user_id"]}, {"_id": 0}, sort=[("created_at", -1)])
    active = await is_plus(user["user_id"])
    return {
        "active": active,
        "plan": sub.get("plan") if sub else None,
        "status": sub.get("status") if sub else None,
        "plus_until": sub.get("plus_until") if sub else None,
        "mp_id": sub.get("mp_id") if sub else None,
        "monthly_clp": PLUS_MONTHLY_CLP,
        "annual_clp": PLUS_ANNUAL_CLP,
        "free_mode": FREE_MODE,
        "is_admin": user.get("email", "").lower() in ADMIN_EMAILS,
    }


@api_router.post("/plus/subscribe")
async def plus_subscribe(request: Request, user=Depends(require_user)):
    body = await request.json()
    plan = body.get("plan")
    if plan not in PLUS_PLANS:
        raise HTTPException(400, "Plan inválido")
    if await is_plus(user["user_id"]):
        raise HTTPException(400, "Ya tienes Petito Plus activo")
    if not isinstance(provider, payments.MercadoPagoProvider):
        raise HTTPException(503, "Pagos no disponibles")
    # Mercado Pago (suscripción sin plan) exige que el correo enviado coincida con el de la
    # cuenta con la que la persona paga; dejamos que el usuario lo confirme/edite.
    payer_email = (body.get("email") or user.get("email") or "").strip()
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", payer_email):
        raise HTTPException(400, "Ingresa un correo válido de tu cuenta de Mercado Pago")
    p = PLUS_PLANS[plan]
    ref = f"{user['user_id']}:{plan}:{new_id()}"
    origin = _origin_from(request)
    back_url = f"{(origin or FRONTEND_URL).rstrip('/')}/plus?pago=success"
    try:
        mp = await provider.create_preapproval(ref, p["reason"], p["amount"], p["frequency"],
                                               payer_email, back_url)
    except httpx.HTTPStatusError as e:
        logger.exception("preapproval create failed")
        if e.response is not None and e.response.status_code == 400:
            raise HTTPException(400, "Mercado Pago no aceptó estos datos. Revisa que el correo sea exactamente el de tu cuenta de Mercado Pago.")
        raise HTTPException(502, "No se pudo iniciar la suscripción")
    except Exception:
        logger.exception("preapproval create failed")
        raise HTTPException(502, "No se pudo iniciar la suscripción")
    await db.subscriptions.insert_one({
        "mp_id": mp["id"], "user_id": user["user_id"], "plan": plan, "external_reference": ref,
        "payer_email": payer_email, "status": mp.get("status", "pending"),
        "membership_active": False, "plus_until": None, "created_at": iso_now(),
    })
    return {"init_point": mp["init_point"], "mp_id": mp["id"]}


@api_router.post("/plus/sync")
async def plus_sync(request: Request, user=Depends(require_user)):
    """Called on return from Mercado Pago to confirm status server-side."""
    sub = await db.subscriptions.find_one({"user_id": user["user_id"]}, {"_id": 0}, sort=[("created_at", -1)])
    if not sub or not sub.get("mp_id"):
        return {"active": await is_plus(user["user_id"])}
    if isinstance(provider, payments.MercadoPagoProvider):
        try:
            fresh = await provider.get_preapproval(sub["mp_id"])
            await _activate_plus(sub["mp_id"], fresh.get("status"), fresh.get("next_payment_date"))
        except Exception:
            logger.exception("plus sync failed")
    return {"active": await is_plus(user["user_id"])}


@api_router.put("/plus/cancel")
async def plus_cancel(user=Depends(require_user)):
    sub = await db.subscriptions.find_one({"user_id": user["user_id"], "membership_active": True},
                                          {"_id": 0}, sort=[("created_at", -1)])
    if not sub or not sub.get("mp_id"):
        raise HTTPException(404, "No tienes una suscripción activa")
    if isinstance(provider, payments.MercadoPagoProvider):
        try:
            await provider.cancel_preapproval(sub["mp_id"])
        except Exception:
            logger.exception("plus cancel failed")
    # Keep access until plus_until (period already paid), but stop renewal.
    await db.subscriptions.update_one({"mp_id": sub["mp_id"]}, {"$set": {"status": "canceled"}})
    return {"ok": True, "plus_until": sub.get("plus_until")}


@api_router.post("/plus/dev-activate")
async def plus_dev_activate(request: Request, user=Depends(require_user)):
    """Preview-only: activate Plus without a real charge (gated by FREE_MODE)."""
    if not FREE_MODE:
        raise HTTPException(403, "No disponible")
    body = await request.json()
    plan = body.get("plan") if body.get("plan") in PLUS_PLANS else "monthly"
    days = PLUS_PLANS[plan]["days"]
    await db.subscriptions.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"mp_id": f"dev-{new_id()}", "user_id": user["user_id"], "plan": plan,
                  "status": "authorized", "membership_active": True,
                  "plus_until": _plus_until_from(None, days), "created_at": iso_now()}},
        upsert=True)
    return {"active": True, "plan": plan}


@api_router.post("/plus/admin-activate")
async def plus_admin_activate(request: Request, user=Depends(require_admin)):
    """Admin-only: activate Plus on the admin's own account to verify the full Plus
    experience (works in preview AND production, restricted to ADMIN_EMAILS)."""
    body = await request.json()
    plan = body.get("plan") if body.get("plan") in PLUS_PLANS else "monthly"
    days = PLUS_PLANS[plan]["days"]
    await db.subscriptions.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"mp_id": f"admin-{new_id()}", "user_id": user["user_id"], "plan": plan,
                  "status": "authorized", "membership_active": True,
                  "plus_until": _plus_until_from(None, days), "created_at": iso_now()}},
        upsert=True)
    return {"active": True, "plan": plan}


@api_router.post("/plus/admin-deactivate")
async def plus_admin_deactivate(user=Depends(require_admin)):
    """Admin-only: turn OFF the test Plus on the admin's own account."""
    await db.subscriptions.delete_many({"user_id": user["user_id"]})
    return {"active": False}



@api_router.get("/pets/{pet_id}/memories")
async def list_memories(pet_id: str, user=Depends(require_user)):
    pet = await get_pet(pet_id, user["user_id"])
    if not pet:
        raise HTTPException(404, "Mascota no encontrada")
    docs = await db.memories.find({"pet_id": pet.id, "user_id": user["user_id"]},
                                  {"_id": 0}).sort("created_at", -1).to_list(500)
    return [memory_public(Memory(**d)) for d in docs]


@api_router.get("/memories/{memory_id}")
async def read_memory(memory_id: str, user=Depends(require_user)):
    m = await get_memory(memory_id, user["user_id"])
    if not m:
        raise HTTPException(404, "Recuerdo no encontrado")
    return memory_public(m)


@api_router.put("/memories/{memory_id}")
async def update_memory(memory_id: str, payload: MemoryUpdate, user=Depends(require_user)):
    m = await get_memory(memory_id, user["user_id"])
    if not m:
        raise HTTPException(404, "Recuerdo no encontrado")
    upd = {}
    if payload.title is not None:
        t = payload.title.strip()[:80]
        if not t:
            raise HTTPException(400, "El título no puede quedar vacío")
        upd["title"] = t
    if payload.happened_on is not None:
        upd["happened_on"] = payload.happened_on.strip()[:40] or None
    if payload.date_unknown is not None:
        upd["date_unknown"] = bool(payload.date_unknown)
    if payload.feeling_text is not None:
        upd["feeling_text"] = payload.feeling_text.strip()[:1500] or None
    if payload.emotions is not None:
        upd["emotions"] = [e for e in payload.emotions if e in EMOTION_LABELS][:6]
    upd["updated_at"] = iso_now()
    await db.memories.update_one({"id": m.id}, {"$set": upd})
    return memory_public(await get_memory(m.id, user["user_id"]))


@api_router.delete("/memories/{memory_id}")
async def delete_memory(memory_id: str, user=Depends(require_user)):
    m = await get_memory(memory_id, user["user_id"])
    if not m:
        raise HTTPException(404, "Recuerdo no encontrado")
    await db.memories.delete_one({"id": m.id})
    return {"ok": True}



async def log_generation(story_id, step, model, usage=None, images=0, cost_usd=0.0, duration_ms=0):
    if usage is not None:
        cost_usd = ai_pipeline.claude_cost(usage)
    doc = {
        "id": new_id(), "story_id": story_id, "step": step, "model": model,
        "input_tokens": usage.input_tokens if usage else 0,
        "output_tokens": usage.output_tokens if usage else 0,
        "images": images, "cost_usd": round(cost_usd, 6),
        "duration_ms": duration_ms, "created_at": iso_now(),
    }
    await db.generation_logs.insert_one(doc)
    await db.stories.update_one({"id": story_id}, {"$inc": {"ai_cost_usd": doc["cost_usd"]}})
    return doc["cost_usd"]


def story_public(story: Story, slides, paid: bool):
    paid = paid or FREE_MODE
    out = []
    for s in sorted(slides, key=lambda x: x.order):
        locked = s.locked and not paid
        fname = s.locked_file if locked else s.image_file
        out.append({
            "order": s.order, "kind": s.kind, "caption": s.caption,
            "locked": locked,
            "image_url": f"/api/media/{story.id}/{fname}" if fname else None,
            "audio_url": f"/api/media/{story.id}/{s.audio_file}" if (s.audio_file and not locked) else None,
        })
    return {
        "id": story.id, "slug": story.share_slug, "pet_name": story.pet_name,
        "species": story.species, "traits": story.traits, "theme": story.theme,
        "theme_label": THEMES.get(story.theme, {}).get("label", story.theme),
        "music": THEMES.get(story.theme, {}).get("music", "alegre"),
        "status": story.status, "progress_step": story.progress_step,
        "progress_pct": story.progress_pct, "bonus_pending": story.bonus_pending,
        "narration_pending": story.narration_pending, "voice_id": story.voice_id,
        "title": story.title,
        "price_clp": story.price_clp, "paid": paid, "email": story.email,
        "error": story.error, "slides": out, "brand_url": BRAND_URL,
        "retention_days": RETENTION_DAYS,
    }


# ---------------- pipeline ----------------
BONUS_ORDER_BASE = 100   # bonus slides sort between photos and closing
CLOSING_ORDER = 9999


def _save_jpg(story_id, image, fname, q=90):
    storage.save_image(story_id, fname, image, q)


async def _add_slide(story_id, kind, image, order, caption="", lockable=True):
    fn = f"slide_{order}.jpg"
    await asyncio.to_thread(_save_jpg, story_id, image, fn, 90)
    locked = (not FREE_MODE) and lockable and order >= 2
    sl = Slide(story_id=story_id, order=order, kind=kind, caption=caption, image_file=fn, locked=locked)
    if locked:
        lk = await asyncio.to_thread(renderer.make_locked, image, BRAND_NAME)
        lfn = f"slide_{order}_locked.jpg"
        await asyncio.to_thread(_save_jpg, story_id, lk, lfn, 82)
        sl.locked_file = lfn
    await db.slides.insert_one(sl.model_dump())
    return sl


# cap concurrent ElevenLabs calls (BYOK accounts have modest concurrency limits)
_narr_sem = None


def _get_narr_sem():
    global _narr_sem
    if _narr_sem is None:
        _narr_sem = asyncio.Semaphore(3)
    return _narr_sem


def _write_bytes(story_id, fname, data):
    storage.save_bytes(story_id, fname, data, "audio/mpeg")


async def narrate_slide(story_id, order, text, voice_id):
    """Generate narration mp3 for one slide and attach it. Best-effort (skips on error)."""
    if not narration.NARRATION_ENABLED or not text or not text.strip():
        return False
    try:
        async with _get_narr_sem():
            audio = await asyncio.to_thread(narration.generate_narration, text, voice_id)
    except Exception as e:
        logger.warning(f"Narration slide {order} skipped: {e}")
        return False
    fn = f"narration_{order}.mp3"
    await asyncio.to_thread(_write_bytes, story_id, fn, audio)
    await db.slides.update_one({"story_id": story_id, "order": order}, {"$set": {"audio_file": fn}})
    return True


async def narrate_core(story, title, captions):
    jobs = [narrate_slide(story.id, 0, title, story.voice_id)]
    for i, cap in enumerate(captions):
        jobs.append(narrate_slide(story.id, 1 + i, cap, story.voice_id))
    await asyncio.gather(*jobs, return_exceptions=True)


async def generate_bonus_scenes(story, photos, theme, best_file):
    """Runs AFTER the core story is live; streams each magic scene into the carousel."""
    import time
    scenes_cfg = theme["bonus_scenes"][:BONUS_SCENES_COUNT]
    data_uri = await asyncio.to_thread(storage.image_to_data_uri, story.id, best_file)
    t0 = time.monotonic()

    async def one_scene(scene_cfg):
        return await asyncio.to_thread(
            ai_pipeline.generate_bonus_scene, data_uri, story.pet_name,
            SPECIES.get(story.species, "mascota"), scene_cfg["prompt"])

    # all scenes fully in parallel (no staggered start)
    images = await asyncio.gather(*[one_scene(sc) for sc in scenes_cfg], return_exceptions=True)

    # single parallel retry pass for any the flaky proxy dropped
    missing = [i for i, img in enumerate(images) if isinstance(img, Exception)]
    if missing:
        logger.warning(f"Bonus scenes retry: {missing}")
        retried = await asyncio.gather(*[one_scene(scenes_cfg[i]) for i in missing], return_exceptions=True)
        for idx, i in enumerate(missing):
            images[i] = retried[idx]

    ok = 0
    created = []
    for i, sc in enumerate(scenes_cfg):
        img = images[i]
        if isinstance(img, Exception):
            logger.warning(f"Bonus scene {i} skipped: {img}")
            continue
        cap = sc["caption"].replace("{name}", story.pet_name)
        rendered = await asyncio.to_thread(renderer.photo_slide, img, cap, sc["sticker"],
                                           story.pet_name, BRAND_NAME, story.theme, i)
        await _add_slide(story.id, "bonus", rendered, BONUS_ORDER_BASE + i, caption=cap)
        created.append((BONUS_ORDER_BASE + i, cap))
        ok += 1

    if ok:
        await log_generation(story.id, "bonus_scenes", ai_pipeline.FAL_MODEL, images=ok,
                             cost_usd=ai_pipeline.FAL_IMG_COST * ok,
                             duration_ms=int((time.monotonic() - t0) * 1000))
    await db.stories.update_one({"id": story.id}, {"$set": {
        "bonus_pending": False, "progress_step": "¡Tu historia está lista!"}})
    return created


async def run_pipeline(story_id: str):
    import time
    story = await get_story(story_id)
    if not story:
        return
    try:
        photos = await db.photos.find({"story_id": story_id}, {"_id": 0}).sort("index", 1).to_list(50)
        if not photos:
            raise RuntimeError("No hay fotos")
        theme = THEMES.get(story.theme, list(THEMES.values())[0])

        # Stage 1: selection
        await db.stories.update_one({"id": story_id}, {"$set": {
            "progress_step": "Eligiendo tus mejores fotos...", "progress_pct": 25}})
        b64s = await asyncio.gather(*[asyncio.to_thread(storage.image_to_b64, story_id, p["file"]) for p in photos])
        t0 = time.monotonic()
        sel, best_idx, usage = await ai_pipeline.select_photos(
            b64s, story.pet_name, SPECIES.get(story.species, "mascota"), story.traits, theme["label"])
        await log_generation(story_id, "selection", ai_pipeline.CLAUDE_MODEL, usage=usage,
                             duration_ms=int((time.monotonic() - t0) * 1000))

        # Stage 2: captions
        await db.stories.update_one({"id": story_id}, {"$set": {
            "progress_step": "Escribiendo tu historia con humor chileno...", "progress_pct": 55}})
        scenes = [s.get("scene_description", "") for s in sel]
        t0 = time.monotonic()
        title, captions, stickers, usage = await ai_pipeline.write_captions(
            story.pet_name, SPECIES.get(story.species, "mascota"), story.traits, theme["label"], scenes)
        await log_generation(story_id, "captions", ai_pipeline.CLAUDE_MODEL, usage=usage,
                             duration_ms=int((time.monotonic() - t0) * 1000))

        best_file = photos[best_idx]["file"] if best_idx < len(photos) else photos[0]["file"]

        # Stage 3: render + PUBLISH the core story immediately (fast first view)
        await db.stories.update_one({"id": story_id}, {"$set": {
            "progress_step": "Diseñando tus diapositivas...", "progress_pct": 85}})
        await db.slides.delete_many({"story_id": story_id})

        # title slide (uses best photo as cover)
        cover = await asyncio.to_thread(storage.load_image, story_id, best_file)
        img = await asyncio.to_thread(renderer.title_slide, title, story.pet_name, theme["label"],
                                      BRAND_NAME, cover, story.theme)
        await _add_slide(story_id, "title", img, 0, lockable=False)

        # photo slides (alternating layouts + stickers)
        for i, s in enumerate(sel):
            pf = photos[int(s["photo_index"])]["file"]
            src = await asyncio.to_thread(storage.load_image, story_id, pf)
            cap = captions[i] if i < len(captions) else ""
            stk = stickers[i] if i < len(stickers) else ""
            img = await asyncio.to_thread(renderer.photo_slide, src, cap, stk, story.pet_name,
                                          BRAND_NAME, story.theme, i)
            await _add_slide(story_id, "photo", img, 1 + i, caption=cap)

        # closing slide (kept last via high order so bonus can slot in before it)
        img = await asyncio.to_thread(renderer.closing_slide, story.pet_name, BRAND_NAME, BRAND_URL, story.theme)
        await _add_slide(story_id, "closing", img, CLOSING_ORDER)

        bonus_will_run = bool(story.bonus_enabled and BONUS_ENABLED)
        narrate_will_run = narration.NARRATION_ENABLED
        await db.stories.update_one({"id": story_id}, {"$set": {
            "status": "preview_ready", "title": title, "progress_pct": 100,
            "bonus_pending": bonus_will_run, "narration_pending": narrate_will_run,
            "progress_step": "Agregando escenas mágicas..." if bonus_will_run else "¡Tu historia está lista!"}})
        logger.info(f"Story {story_id} core ready (bonus={bonus_will_run}, narration={narrate_will_run})")

        # Stage 4: narration + bonus scenes stream in while the user enjoys the story
        async def bonus_branch():
            created = await generate_bonus_scenes(story, photos, theme, best_file)
            if narrate_will_run and created:
                await asyncio.gather(
                    *[narrate_slide(story_id, order, cap, story.voice_id) for order, cap in created],
                    return_exceptions=True)

        tasks = []
        if narrate_will_run:
            tasks.append(narrate_core(story, title, captions))
        if bonus_will_run:
            tasks.append(bonus_branch())
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        if narrate_will_run:
            await db.stories.update_one({"id": story_id}, {"$set": {"narration_pending": False}})
        logger.info(f"Story {story_id} fully done (bonus+narration)")
    except Exception as e:
        logger.exception(f"Pipeline failed for {story_id}")
        await db.stories.update_one({"id": story_id}, {"$set": {
            "status": "failed", "error": str(e), "progress_step": "Algo salió mal",
            "progress_pct": 0, "bonus_pending": False, "narration_pending": False}})


# ---------------- routes ----------------
@api_router.get("/")
async def root():
    return {"app": "Petito", "status": "ok"}


@api_router.get("/config")
async def config():
    return {
        "price_clp": PRICE_CLP, "brand_name": BRAND_NAME, "brand_url": BRAND_URL,
        "payment_mode": provider.mode, "bonus_enabled": BONUS_ENABLED, "free_mode": FREE_MODE,
        "bonus_scenes_count": BONUS_SCENES_COUNT,
        "narration_enabled": narration.NARRATION_ENABLED,
        "voices": narration.VOICES,
        "narration_default_voice": narration.DEFAULT_VOICE_ID,
        "free_per_day": FREE_PER_DAY, "retention_days": RETENTION_DAYS,
        "themes": [{"key": k, "label": v["label"], "emoji": v["emoji"]} for k, v in THEMES.items()],
        "traits": models.TRAITS,
        "portrait_price_clp": PORTRAIT_PRICE_CLP,
        "portrait_styles": [{"key": k, "label": v["label"], "emoji": v["emoji"], "desc": v["desc"]}
                            for k, v in PORTRAIT_STYLES.items()],
        "memorial_styles": [{"key": k, "label": v["label"], "emoji": v["emoji"], "desc": v["desc"]}
                            for k, v in MEMORIAL_STYLES.items()],
        "talk_price_clp": TALK_PRICE_CLP,
        "free_talk_per_day": FREE_TALK_PER_DAY,
        "talk_scenarios": [{"key": k, "label": v["label"], "emoji": v["emoji"]}
                           for k, v in TALK_SCENARIOS.items()],
        "talk_message_max": TALK_MESSAGE_MAX,
        "plus_monthly_clp": PLUS_MONTHLY_CLP,
        "plus_annual_clp": PLUS_ANNUAL_CLP,
    }


@api_router.post("/stories")
async def create_story(payload: StoryCreate, x_device_id: str = Header(default=""), user=Depends(require_user)):
    if payload.theme not in THEMES:
        raise HTTPException(400, "Tema inválido")
    story = Story(
        pet_name=payload.pet_name.strip()[:40] or "Mi mascota",
        species=payload.species if payload.species in SPECIES else "otro",
        traits=[t for t in payload.traits if t in models.TRAITS][:3],
        theme=payload.theme, email=payload.email, device_id=x_device_id,
        user_id=user["user_id"],
        pet_id=await _validate_pet_id(payload.pet_id, user["user_id"]),
        price_clp=PRICE_CLP, bonus_enabled=BONUS_ENABLED,
        voice_id=narration.valid_voice(payload.voice_id or narration.DEFAULT_VOICE_ID),
    )
    await db.stories.insert_one(story.model_dump())
    return {"id": story.id, "slug": story.share_slug}


MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB cap per photo to bound worker memory


async def _read_capped(f: UploadFile, limit: int = MAX_UPLOAD_BYTES) -> bytes:
    """Read an upload with a hard size cap so a huge file can't exhaust memory."""
    chunks, total = [], 0
    while True:
        chunk = await f.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(413, "La foto es muy pesada. Usa una de menos de 20 MB.")
        chunks.append(chunk)
    return b"".join(chunks)



@api_router.post("/stories/{story_id}/photos")
async def upload_photos(story_id: str, files: list[UploadFile] = File(...)):
    story = await get_story(story_id)
    if not story:
        raise HTTPException(404, "Historia no encontrada")
    files = files[:20]
    await db.photos.delete_many({"story_id": story_id})
    saved = []
    for i, f in enumerate(files):
        raw = await _read_capped(f)
        if not raw:
            continue
        try:
            name = await asyncio.to_thread(storage.save_original, story_id, i, raw)
        except Exception:
            continue
        saved.append({"id": new_id(), "story_id": story_id, "index": i, "file": name,
                      "selected": False, "slide_order": None, "created_at": iso_now()})
    if not saved:
        raise HTTPException(400, "No se pudieron procesar las fotos")
    await db.photos.insert_many(saved)
    await db.stories.update_one({"id": story_id}, {"$set": {"photo_count": len(saved)}})
    return {"uploaded": len(saved)}


@api_router.post("/stories/{story_id}/generate")
async def generate(story_id: str, x_device_id: str = Header(default="")):
    story = await get_story(story_id)
    if not story:
        raise HTTPException(404, "Historia no encontrada")
    if story.photo_count < 1:
        raise HTTPException(400, "Sube al menos una foto")
    # rate limit: free previews per device per day
    device = x_device_id or story.device_id or ""
    if device:
        start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        count = await db.stories.count_documents({
            "device_id": device, "generated_at": {"$gte": start}})
        if count >= FREE_PER_DAY:
            raise HTTPException(429, f"Límite de {FREE_PER_DAY} historias gratis por día alcanzado. Vuelve mañana 🐾")
    expires = (now_utc() + timedelta(days=RETENTION_DAYS)).isoformat()
    await db.stories.update_one({"id": story_id}, {"$set": {
        "status": "generating", "progress_step": "Preparando...", "progress_pct": 5,
        "generated_at": iso_now(), "expires_at": expires, "error": None, "ai_cost_usd": 0.0}})
    asyncio.create_task(run_pipeline(story_id))
    return {"status": "generating"}


@api_router.get("/stories/{story_id}")
async def read_story(story_id: str):
    story = await get_story(story_id)
    if not story:
        raise HTTPException(404, "Historia no encontrada")
    slides = [Slide(**s) for s in await db.slides.find({"story_id": story_id}, {"_id": 0}).to_list(50)]
    return story_public(story, slides, story.status == "paid")


@api_router.get("/stories/slug/{slug}")
async def read_story_by_slug(slug: str):
    story = await get_story_by_slug(slug)
    if not story:
        raise HTTPException(404, "Historia no encontrada")
    slides = [Slide(**s) for s in await db.slides.find({"story_id": story.id}, {"_id": 0}).to_list(50)]
    return story_public(story, slides, story.status == "paid")


class EmailPayload(BaseModel):
    email: str


@api_router.post("/stories/{story_id}/email")
async def save_email(story_id: str, payload: EmailPayload):
    await db.stories.update_one({"id": story_id}, {"$set": {"email": payload.email.strip()[:120]}})
    return {"ok": True}


@api_router.post("/stories/{story_id}/checkout")
async def checkout(story_id: str, request: Request):
    story = await get_story(story_id)
    if not story:
        raise HTTPException(404, "Historia no encontrada")
    if story.status == "paid":
        return {"mode": provider.mode, "already_paid": True}
    if story.user_id and await is_plus(story.user_id):
        await db.stories.update_one({"id": story_id, "status": {"$ne": "paid"}},
                                    {"$set": {"status": "paid", "paid_at": iso_now()}})
        await db.slides.update_many({"story_id": story_id}, {"$set": {"locked": False}})
        return {"mode": "plus", "already_paid": True}
    # Subscription-only: the clean version is unlocked solely by Petito Plus.
    return {"mode": "plus_required"}


@api_router.post("/payments/webhook/mercadopago")
async def mp_webhook(request: Request):
    if not isinstance(provider, payments.MercadoPagoProvider):
        return {"received": True}
    data_id = request.query_params.get("data.id") or request.query_params.get("data_id")
    event_type = request.query_params.get("type")
    if not provider.valid_signature(request.headers.get("x-signature"),
                                    request.headers.get("x-request-id"), data_id):
        raise HTTPException(401, "Firma inválida")
    body = await request.json()
    res_id = str(data_id or body.get("data", {}).get("id", ""))
    topic = event_type or body.get("type")
    # ---- Petito Plus subscription events ----
    if topic == "subscription_preapproval" and res_id:
        try:
            sub = await provider.get_preapproval(res_id)
            await _activate_plus(res_id, sub.get("status"), sub.get("next_payment_date"))
        except Exception:
            logger.exception("webhook preapproval fetch failed")
        return {"received": True}
    if topic == "subscription_authorized_payment" and res_id:
        try:
            inv = await provider.get_authorized_payment(res_id)
            pre_id = inv.get("preapproval_id")
            if pre_id:
                sub = await provider.get_preapproval(pre_id)
                if sub.get("status") == "authorized" and inv.get("status") in ("approved", "authorized", "processed"):
                    await _activate_plus(pre_id, "authorized", sub.get("next_payment_date"))
        except Exception:
            logger.exception("webhook authorized_payment failed")
        return {"received": True}
    if event_type not in (None, "payment"):
        return {"received": True}
    payment_id = res_id
    if not payment_id:
        return {"received": True}
    try:
        payment = await provider.get_payment(payment_id)
    except Exception:
        logger.exception("webhook payment fetch failed")
        return {"received": True}
    order_id = payment.get("external_reference")
    if not order_id:
        return {"received": True}
    story = await get_story(order_id)
    if story:
        approved = (payment.get("status") == "approved" and payment.get("currency_id") == "CLP"
                    and float(payment.get("transaction_amount", 0)) == story.price_clp)
        if approved:
            await db.stories.update_one({"id": order_id, "status": {"$ne": "paid"}},
                                        {"$set": {"status": "paid", "paid_at": iso_now()}})
            await db.slides.update_many({"story_id": order_id}, {"$set": {"locked": False}})
        return {"received": True}
    portrait = await get_portrait(order_id)
    if portrait:
        approved = (payment.get("status") == "approved" and payment.get("currency_id") == "CLP"
                    and float(payment.get("transaction_amount", 0)) == portrait.price_clp)
        if approved:
            await db.portraits.update_one({"id": order_id, "status": {"$ne": "paid"}},
                                          {"$set": {"status": "paid", "paid_at": iso_now()}})
        return {"received": True}
    video = await get_talk(order_id)
    if video:
        approved = (payment.get("status") == "approved" and payment.get("currency_id") == "CLP"
                    and float(payment.get("transaction_amount", 0)) == video.price_clp)
        if approved:
            await _talk_mark_paid_and_finalize(order_id)
    return {"received": True}


@api_router.get("/media/{story_id}/{name}")
async def media(story_id: str, name: str):
    if ".." in name or "/" in name:
        raise HTTPException(400, "Nombre inválido")
    try:
        data, content_type = await asyncio.to_thread(storage.get_bytes, story_id, name)
    except Exception:
        raise HTTPException(404, "No encontrado")
    mime = "audio/mpeg" if name.lower().endswith(".mp3") else (
        "video/mp4" if name.lower().endswith(".mp4") else (content_type or "image/jpeg"))
    return Response(content=data, media_type=mime)


# ---------------- survey (willingness to pay) ----------------
@api_router.post("/survey")
async def submit_survey(payload: SurveySubmit, x_device_id: str = Header(default="")):
    answer = "yes" if str(payload.answer).lower() in ("yes", "si", "sí", "true", "1") else "no"
    device = (x_device_id or "").strip()
    if device:
        existing = await db.survey_responses.find_one({"device_id": device})
        if existing:
            return {"ok": True, "already": True}
    resp = SurveyResponse(device_id=device, story_id=payload.story_id, answer=answer, price_clp=9900)
    await db.survey_responses.insert_one(resp.model_dump())
    return {"ok": True, "already": False}


# ---------------- admin (Google allowlist) ----------------
@api_router.get("/admin/metrics")
async def admin_metrics(user=Depends(require_admin)):
    total = await db.stories.count_documents({"status": {"$ne": "draft"}})
    paid = await db.stories.count_documents({"status": "paid"})
    agg = await db.stories.aggregate([
        {"$group": {"_id": None, "cost": {"$sum": "$ai_cost_usd"}}}]).to_list(1)
    total_cost = agg[0]["cost"] if agg else 0.0
    revenue = paid * PRICE_CLP
    return {
        "total_stories": total, "paid_stories": paid,
        "conversion_rate": round(paid / total * 100, 1) if total else 0.0,
        "revenue_clp": revenue,
        "total_ai_cost_usd": round(total_cost, 4),
        "total_ai_cost_clp": round(total_cost * USD_TO_CLP),
        "avg_cost_clp": round(total_cost * USD_TO_CLP / total) if total else 0,
        "usd_to_clp": USD_TO_CLP, "cost_guardrail_clp": 600,
    }


@api_router.get("/admin/survey")
async def admin_survey(user=Depends(require_admin)):
    total = await db.survey_responses.count_documents({})
    yes = await db.survey_responses.count_documents({"answer": "yes"})
    no = total - yes
    return {
        "total": total, "yes": yes, "no": no,
        "yes_pct": round(yes / total * 100, 1) if total else 0.0,
        "price_clp": 9900,
    }


@api_router.get("/admin/stories")
async def admin_stories(user=Depends(require_admin), filter: str = "all"):
    q = {"status": {"$ne": "draft"}}
    if filter == "paid":
        q = {"status": "paid"}
    elif filter == "pending":
        q = {"status": {"$in": ["preview_ready", "generating", "failed"]}}
    docs = await db.stories.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for d in docs:
        out.append({
            "id": d["id"], "slug": d["share_slug"], "pet_name": d["pet_name"],
            "species": d["species"], "theme": THEMES.get(d["theme"], {}).get("label", d["theme"]),
            "photo_count": d.get("photo_count", 0), "status": d["status"],
            "paid": d["status"] == "paid",
            "ai_cost_clp": round(d.get("ai_cost_usd", 0) * USD_TO_CLP),
            "created_at": d["created_at"], "email": d.get("email"),
        })
    return out


# ---------------- portraits (royalty portrait: free preview -> paid HD) ----------------
def portrait_public(p: Portrait):
    paid = p.status == "paid"
    return {
        "id": p.id, "slug": p.share_slug, "pet_name": p.pet_name, "style": p.style,
        "style_label": ALL_PORTRAIT_STYLES.get(p.style, {}).get("label", p.style),
        "category": p.category,
        "status": p.status, "progress_step": p.progress_step, "progress_pct": p.progress_pct,
        "price_clp": p.price_clp, "paid": paid, "error": p.error,
        "gift_enabled": p.gift_enabled, "gift_to": p.gift_to, "gift_from": p.gift_from,
        "gift_message": p.gift_message, "brand_url": BRAND_URL,
        "memorial_dates": p.memorial_dates, "memorial_caption": p.memorial_caption,
        "preview_url": f"/api/media/{p.id}/{p.preview_file}" if p.preview_file else None,
        "clean_url": f"/api/media/{p.id}/{p.clean_file}" if (paid and p.clean_file) else None,
    }


async def run_portrait_pipeline(portrait_id: str):
    import time
    p = await get_portrait(portrait_id)
    if not p:
        return
    try:
        photo = await db.portrait_photos.find_one({"portrait_id": portrait_id}, {"_id": 0})
        if not photo:
            raise RuntimeError("No hay foto")
        style = ALL_PORTRAIT_STYLES.get(p.style) or list(PORTRAIT_STYLES.values())[0]

        await db.portraits.update_one({"id": portrait_id}, {"$set": {
            "progress_step": "Preparando el lienzo...", "progress_pct": 20}})
        data_uri = await asyncio.to_thread(storage.image_to_data_uri, portrait_id, photo["file"])

        await db.portraits.update_one({"id": portrait_id}, {"$set": {
            "progress_step": "Pintando a tu mascota...", "progress_pct": 45}})
        t0 = time.monotonic()
        clean = await asyncio.to_thread(ai_pipeline.generate_portrait, data_uri, "mascota", style["prompt"])

        await db.portraits.update_one({"id": portrait_id}, {"$set": {
            "progress_step": "Poniéndole el marco dorado...", "progress_pct": 80}})
        clean_name = f"clean_{new_id().replace('-', '')[:16]}.jpg"
        await asyncio.to_thread(storage.save_image, portrait_id, clean_name, clean, 94)
        preview = await asyncio.to_thread(renderer.portrait_preview, clean, BRAND_NAME)
        await asyncio.to_thread(storage.save_image, portrait_id, "preview.jpg", preview, 82)

        await log_generation(portrait_id, "portrait", ai_pipeline.FAL_MODEL, images=1,
                             cost_usd=ai_pipeline.FAL_IMG_COST,
                             duration_ms=int((time.monotonic() - t0) * 1000))
        await db.portraits.update_one({"id": portrait_id}, {"$set": {
            "status": "preview_ready", "preview_file": "preview.jpg", "clean_file": clean_name,
            "progress_pct": 100, "progress_step": "¡Listo!"}})
        logger.info(f"Portrait {portrait_id} ready")
    except Exception as e:
        logger.exception(f"Portrait pipeline failed for {portrait_id}")
        await db.portraits.update_one({"id": portrait_id}, {"$set": {
            "status": "failed", "error": str(e), "progress_step": "Algo salió mal", "progress_pct": 0}})


@api_router.post("/portraits")
async def create_portrait(payload: PortraitCreate, x_device_id: str = Header(default=""), user=Depends(require_user)):
    category = "memorial" if payload.category == "memorial" else "royal"
    valid = MEMORIAL_STYLES if category == "memorial" else PORTRAIT_STYLES
    if payload.style not in valid:
        raise HTTPException(400, "Estilo inválido")
    p = Portrait(
        pet_name=(payload.pet_name or "").strip()[:40] or None,
        style=payload.style, category=category, device_id=x_device_id, user_id=user["user_id"],
        pet_id=await _validate_pet_id(payload.pet_id, user["user_id"]),
        price_clp=PORTRAIT_PRICE_CLP,
        gift_enabled=bool(payload.gift_enabled) and category == "royal",
        gift_to=(payload.gift_to or "").strip()[:60] or None,
        gift_from=(payload.gift_from or "").strip()[:60] or None,
        gift_message=(payload.gift_message or "").strip()[:280] or None,
        memorial_dates=(payload.memorial_dates or "").strip()[:40] or None,
        memorial_caption=(payload.memorial_caption or "").strip()[:80] or None,
    )
    await db.portraits.insert_one(p.model_dump())
    return {"id": p.id, "slug": p.share_slug}


@api_router.post("/portraits/{portrait_id}/photo")
async def upload_portrait_photo(portrait_id: str, files: list[UploadFile] = File(...)):
    p = await get_portrait(portrait_id)
    if not p:
        raise HTTPException(404, "Retrato no encontrado")
    if not files:
        raise HTTPException(400, "Sube una foto")
    raw = await _read_capped(files[0])
    if not raw:
        raise HTTPException(400, "Foto vacía")
    try:
        name = await asyncio.to_thread(storage.save_original, portrait_id, 0, raw)
    except Exception:
        raise HTTPException(400, "No se pudo procesar la foto")
    await db.portrait_photos.delete_many({"portrait_id": portrait_id})
    await db.portrait_photos.insert_one({
        "id": new_id(), "portrait_id": portrait_id, "file": name, "created_at": iso_now()})
    return {"uploaded": 1}


@api_router.post("/portraits/{portrait_id}/generate")
async def generate_portrait_route(portrait_id: str):
    p = await get_portrait(portrait_id)
    if not p:
        raise HTTPException(404, "Retrato no encontrado")
    photo = await db.portrait_photos.find_one({"portrait_id": portrait_id})
    if not photo:
        raise HTTPException(400, "Sube una foto primero")
    expires = (now_utc() + timedelta(days=RETENTION_DAYS)).isoformat()
    await db.portraits.update_one({"id": portrait_id}, {"$set": {
        "status": "generating", "progress_step": "Preparando...", "progress_pct": 5,
        "expires_at": expires, "error": None, "ai_cost_usd": 0.0}})
    asyncio.create_task(run_portrait_pipeline(portrait_id))
    return {"status": "generating"}


@api_router.get("/portraits/{portrait_id}")
async def read_portrait(portrait_id: str):
    p = await get_portrait(portrait_id)
    if not p:
        raise HTTPException(404, "Retrato no encontrado")
    return portrait_public(p)


@api_router.get("/portraits/slug/{slug}")
async def read_portrait_by_slug(slug: str):
    p = await get_portrait_by_slug(slug)
    if not p:
        raise HTTPException(404, "Retrato no encontrado")
    return portrait_public(p)


@api_router.post("/portraits/{portrait_id}/checkout")
async def portrait_checkout(portrait_id: str, request: Request):
    p = await get_portrait(portrait_id)
    if not p:
        raise HTTPException(404, "Retrato no encontrado")
    if p.status == "paid":
        return {"mode": provider.mode, "already_paid": True}
    if p.user_id and await is_plus(p.user_id):
        await db.portraits.update_one({"id": portrait_id, "status": {"$ne": "paid"}},
                                      {"$set": {"status": "paid", "paid_at": iso_now()}})
        return {"mode": "plus", "already_paid": True}
    # Subscription-only: the clean HD portrait is unlocked solely by Petito Plus.
    return {"mode": "plus_required"}


# ---------------- talking video ("Petito Habla") ----------------
async def get_talk(video_id: str):
    doc = await db.videos.find_one({"id": video_id}, {"_id": 0})
    return TalkingVideo(**doc) if doc else None


async def get_talk_by_slug(slug: str):
    doc = await db.videos.find_one({"share_slug": slug}, {"_id": 0})
    return TalkingVideo(**doc) if doc else None


def talk_public(v: TalkingVideo):
    paid = v.status == "paid"
    return {
        "id": v.id, "slug": v.share_slug, "pet_name": v.pet_name, "mode": v.mode,
        "status": v.status, "progress_step": v.progress_step, "progress_pct": v.progress_pct,
        "line": v.line, "price_clp": v.price_clp, "paid": paid, "error": v.error,
        "brand_url": BRAND_URL,
        "preview_url": f"/api/media/{v.id}/{v.preview_file}" if v.preview_file else None,
        "clean_url": f"/api/media/{v.id}/{v.clean_file}" if (paid and v.clean_file) else None,
        "clean_ready": bool(v.clean_file),
    }


def _origin_from(request: Request):
    origin = (request.headers.get("origin") or "").rstrip("/")
    if origin:
        return origin
    if FRONTEND_URL:
        return FRONTEND_URL.rstrip("/")
    # Fall back to the request's own public host (behind Cloudflare / proxy) so
    # media URLs handed to fal are always reachable, even without an Origin header.
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if host:
        return f"{proto}://{host.split(',')[0].strip()}"
    return None


async def run_talk_pipeline(video_id: str):
    import time as _t
    v = await get_talk(video_id)
    if not v:
        return
    long = v.mode == "full"
    try:
        photo = await db.talk_photos.find_one({"video_id": video_id}, {"_id": 0})
        if not photo:
            raise RuntimeError("No hay foto")
        base = v.media_base or ""
        if not base:
            raise RuntimeError("Falta media_base")

        await db.videos.update_one({"id": video_id}, {"$set": {
            "progress_step": "Escuchando a tu mascota...", "progress_pct": 20}})
        photo_b64 = await asyncio.to_thread(storage.image_to_b64, video_id, photo["file"], 512)
        if v.message:
            # Owner wrote the exact message -> use it verbatim (species still detected best-effort).
            line = v.message.strip()[:TALK_MESSAGE_MAX]
            species = v.species or "otro"
            usage = None
        else:
            scenario_hint = (TALK_SCENARIOS.get(v.scenario, {}) or {}).get("hint") if v.scenario else None
            line, species, usage = await ai_pipeline.write_pet_line(
                photo_b64, v.pet_name, "long" if long else "mini", scenario_hint=scenario_hint)
        await db.videos.update_one({"id": video_id}, {"$set": {"line": line, "species": species}})
        if usage:
            await log_generation(video_id, "talk_line", ai_pipeline.CLAUDE_MODEL, usage=usage,
                                 cost_usd=ai_pipeline.claude_cost(usage))

        await db.videos.update_one({"id": video_id}, {"$set": {
            "progress_step": "Buscando la voz perfecta...", "progress_pct": 40}})
        audio = await asyncio.to_thread(narration.generate_narration, line,
                                        narration.valid_voice(v.voice_id or narration.DEFAULT_VOICE_ID), 1.0)
        await asyncio.to_thread(storage.save_bytes, video_id, "audio.mp3", audio, "audio/mpeg")

        await db.videos.update_one({"id": video_id}, {"$set": {
            "progress_step": "Dándole voz a tu mascota...", "progress_pct": 60}})
        orig = await asyncio.to_thread(storage.load_image, video_id, photo["file"])
        out_w = 720 if long else 384
        src = await asyncio.to_thread(renderer.talk_source, orig, True, out_w, BRAND_NAME)
        await asyncio.to_thread(storage.save_image, video_id, "source.jpg", src, 90)
        try:
            orig.close(); src.close()
        except Exception:
            pass
        del orig, src

        image_url = f"{base}/api/media/{video_id}/source.jpg"
        audio_url = f"{base}/api/media/{video_id}/audio.mp3"
        t0 = _t.monotonic()
        vid_bytes = await asyncio.to_thread(ai_pipeline.generate_talking_video, image_url, audio_url)
        await asyncio.to_thread(storage.save_bytes, video_id, "preview.mp4", vid_bytes, "video/mp4")
        del vid_bytes

        dur = 8 if long else 3
        await log_generation(video_id, "talk_video", ai_pipeline.TALK_MODEL, images=0,
                             cost_usd=ai_pipeline.FAL_VIDEO_COST_PER_SEC * dur,
                             duration_ms=int((_t.monotonic() - t0) * 1000))
        await db.videos.update_one({"id": video_id}, {"$set": {
            "status": "preview_ready", "preview_file": "preview.mp4",
            "progress_pct": 100, "progress_step": "¡Listo!"}})
        logger.info(f"Talk video {video_id} preview ready")
    except Exception as e:
        logger.exception(f"Talk pipeline failed for {video_id}")
        msg = "Sin crédito para generar. Agrega saldo a tu Universal Key." if "INSUFFICIENT_CREDITS" in str(e) else str(e)
        await db.videos.update_one({"id": video_id}, {"$set": {
            "status": "failed", "error": msg, "progress_step": "Algo salió mal", "progress_pct": 0}})


async def run_talk_clean(video_id: str):
    """After payment: regenerate a CLEAN (no watermark) HD video reusing the same audio."""
    import time as _t
    v = await get_talk(video_id)
    if not v or v.clean_file:
        return
    try:
        photo = await db.talk_photos.find_one({"video_id": video_id}, {"_id": 0})
        base = v.media_base or ""
        if not photo or not base or not await asyncio.to_thread(storage.exists, video_id, "audio.mp3"):
            raise RuntimeError("Faltan recursos para la versión HD")
        await db.videos.update_one({"id": video_id}, {"$set": {
            "progress_step": "Creando tu versión HD...", "progress_pct": 50}})
        orig = await asyncio.to_thread(storage.load_image, video_id, photo["file"])
        src = await asyncio.to_thread(renderer.talk_source, orig, False, 1080, BRAND_NAME)
        await asyncio.to_thread(storage.save_image, video_id, "source_hd.jpg", src, 95)
        image_url = f"{base}/api/media/{video_id}/source_hd.jpg"
        audio_url = f"{base}/api/media/{video_id}/audio.mp3"
        t0 = _t.monotonic()
        vid_bytes = await asyncio.to_thread(ai_pipeline.generate_talking_video, image_url, audio_url)
        clean_name = f"clean_{new_id().replace('-', '')[:16]}.mp4"
        await asyncio.to_thread(storage.save_bytes, video_id, clean_name, vid_bytes, "video/mp4")
        await log_generation(video_id, "talk_video_hd", ai_pipeline.TALK_MODEL, images=0,
                             cost_usd=ai_pipeline.FAL_VIDEO_COST_PER_SEC * 8,
                             duration_ms=int((_t.monotonic() - t0) * 1000))
        await db.videos.update_one({"id": video_id}, {"$set": {
            "clean_file": clean_name, "progress_pct": 100, "progress_step": "¡HD listo!"}})
        logger.info(f"Talk video {video_id} HD ready")
    except Exception:
        logger.exception(f"Talk HD generation failed for {video_id}")


async def _talk_mark_paid_and_finalize(video_id: str):
    await db.videos.update_one({"id": video_id, "status": {"$ne": "paid"}},
                               {"$set": {"status": "paid", "paid_at": iso_now()}})
    asyncio.create_task(run_talk_clean(video_id))


@api_router.post("/talk/preview")
async def talk_preview(request: Request, files: list[UploadFile] = File(...),
                       x_device_id: str = Header(default="")):
    """Anonymous free preview: upload 1 photo -> short watermarked talking video. Rate-limited."""
    if not files:
        raise HTTPException(400, "Sube una foto")
    start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    used = await db.videos.count_documents({
        "device_id": x_device_id, "mode": "preview_free", "created_at": {"$gte": start}})
    if x_device_id and used >= FREE_TALK_PER_DAY:
        raise HTTPException(429, "Llegaste al límite de adelantos gratis de hoy. ¡Crea el tuyo completo!")
    raw = await _read_capped(files[0])
    if not raw:
        raise HTTPException(400, "Foto vacía")
    v = TalkingVideo(device_id=x_device_id, mode="preview_free", price_clp=TALK_PRICE_CLP,
                     voice_id=narration.DEFAULT_VOICE_ID, media_base=_origin_from(request),
                     status="generating", progress_step="Preparando...", progress_pct=5,
                     expires_at=(now_utc() + timedelta(days=RETENTION_DAYS)).isoformat())
    await db.videos.insert_one(v.model_dump())
    try:
        name = await asyncio.to_thread(storage.save_original, v.id, 0, raw)
    except Exception:
        logger.exception("talk_preview: could not process photo")
        raise HTTPException(400, "No pudimos leer esta foto. Prueba con otra (JPG, PNG o foto de iPhone).")
    finally:
        del raw
    await db.talk_photos.insert_one({"id": new_id(), "video_id": v.id, "file": name, "created_at": iso_now()})
    asyncio.create_task(run_talk_pipeline(v.id))
    return {"id": v.id, "slug": v.share_slug}


@api_router.post("/talk")
async def create_talk(payload: TalkCreate, request: Request,
                      x_device_id: str = Header(default=""), user=Depends(require_user)):
    v = TalkingVideo(
        device_id=x_device_id, user_id=user["user_id"], mode="full", price_clp=TALK_PRICE_CLP,
        pet_name=(payload.pet_name or "").strip()[:40] or None,
        pet_id=await _validate_pet_id(payload.pet_id, user["user_id"]),
        scenario=payload.scenario if payload.scenario in TALK_SCENARIOS else None,
        message=(payload.message or "").strip()[:TALK_MESSAGE_MAX] or None,
        voice_id=narration.valid_voice(payload.voice_id or narration.DEFAULT_VOICE_ID),
        media_base=_origin_from(request),
    )
    await db.videos.insert_one(v.model_dump())
    return {"id": v.id, "slug": v.share_slug}


@api_router.post("/talk/{video_id}/photo")
async def upload_talk_photo(video_id: str, files: list[UploadFile] = File(...)):
    v = await get_talk(video_id)
    if not v:
        raise HTTPException(404, "Video no encontrado")
    if not files:
        raise HTTPException(400, "Sube una foto")
    raw = await _read_capped(files[0])
    if not raw:
        raise HTTPException(400, "Foto vacía")
    try:
        name = await asyncio.to_thread(storage.save_original, video_id, 0, raw)
    except Exception:
        raise HTTPException(400, "No se pudo procesar la foto")
    await db.talk_photos.delete_many({"video_id": video_id})
    await db.talk_photos.insert_one({"id": new_id(), "video_id": video_id, "file": name, "created_at": iso_now()})
    return {"uploaded": 1}


@api_router.post("/talk/{video_id}/generate")
async def generate_talk(video_id: str, request: Request, user=Depends(require_user)):
    v = await get_talk(video_id)
    if not v:
        raise HTTPException(404, "Video no encontrado")
    photo = await db.talk_photos.find_one({"video_id": video_id})
    if not photo:
        raise HTTPException(400, "Sube una foto primero")
    await db.videos.update_one({"id": video_id}, {"$set": {
        "status": "generating", "progress_step": "Preparando...", "progress_pct": 5,
        "error": None, "media_base": _origin_from(request),
        "expires_at": (now_utc() + timedelta(days=RETENTION_DAYS)).isoformat()}})
    asyncio.create_task(run_talk_pipeline(video_id))
    return {"status": "generating"}


@api_router.get("/talk/{video_id}")
async def read_talk(video_id: str):
    v = await get_talk(video_id)
    if not v:
        raise HTTPException(404, "Video no encontrado")
    return talk_public(v)


@api_router.get("/talk/slug/{slug}")
async def read_talk_by_slug(slug: str):
    v = await get_talk_by_slug(slug)
    if not v:
        raise HTTPException(404, "Video no encontrado")
    return talk_public(v)


@api_router.post("/talk/{video_id}/checkout")
async def talk_checkout(video_id: str, request: Request):
    v = await get_talk(video_id)
    if not v:
        raise HTTPException(404, "Video no encontrado")
    if v.status == "paid":
        return {"mode": provider.mode, "already_paid": True}
    if v.user_id and await is_plus(v.user_id):
        await _talk_mark_paid_and_finalize(video_id)
        return {"mode": "plus", "already_paid": True}
    # Subscription-only: the full HD video is unlocked solely by Petito Plus.
    return {"mode": "plus_required"}


@api_router.get("/me/videos")
async def my_videos(user=Depends(require_user)):
    docs = await db.videos.find({"user_id": user["user_id"], "mode": "full",
                                 "status": {"$in": ["preview_ready", "paid"]}},
                                {"_id": 0}).sort("created_at", -1).to_list(200)
    return [{
        "id": d["id"], "slug": d["share_slug"], "pet_name": d.get("pet_name"),
        "line": d.get("line"), "status": d["status"], "paid": d["status"] == "paid",
        "thumb_url": f"/api/media/{d['id']}/source.jpg",
        "preview_url": f"/api/media/{d['id']}/{d['preview_file']}" if d.get("preview_file") else None,
        "created_at": d["created_at"],
    } for d in docs]


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _init_storage():
    try:
        await asyncio.to_thread(storage.init_storage)
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Object storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
