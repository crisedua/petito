import os
import asyncio
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
from models import Story, Slide, StoryCreate, SurveyResponse, SurveySubmit, Portrait, PortraitCreate, THEMES, SPECIES, PORTRAIT_STYLES, now_utc, iso_now, new_id

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

BRAND_NAME = os.environ.get("BRAND_NAME", "Petito")
BRAND_URL = os.environ.get("BRAND_URL", "petito.pro")
PRICE_CLP = int(os.environ.get("STORY_PRICE_CLP", "3990"))
PORTRAIT_PRICE_CLP = int(os.environ.get("PORTRAIT_PRICE_CLP", "2990"))
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
logger = logging.getLogger("cuentapatas")

app = FastAPI()
api_router = APIRouter(prefix="/api")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
PUBLIC_API_URL = os.environ.get("PUBLIC_API_URL", "")
provider = payments.build_provider(FRONTEND_URL, PUBLIC_API_URL)


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
        "style_label": PORTRAIT_STYLES.get(d["style"], {}).get("label", d["style"]),
        "status": d["status"], "paid": d["status"] == "paid",
        "thumb_url": f"/api/media/{d['id']}/preview.jpg",
        "gift_enabled": d.get("gift_enabled", False),
        "created_at": d["created_at"],
    } for d in docs]


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
        price_clp=PRICE_CLP, bonus_enabled=BONUS_ENABLED,
        voice_id=narration.valid_voice(payload.voice_id or narration.DEFAULT_VOICE_ID),
    )
    await db.stories.insert_one(story.model_dump())
    return {"id": story.id, "slug": story.share_slug}


@api_router.post("/stories/{story_id}/photos")
async def upload_photos(story_id: str, files: list[UploadFile] = File(...)):
    story = await get_story(story_id)
    if not story:
        raise HTTPException(404, "Historia no encontrada")
    files = files[:20]
    await db.photos.delete_many({"story_id": story_id})
    saved = []
    for i, f in enumerate(files):
        raw = await f.read()
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
async def checkout(story_id: str):
    story = await get_story(story_id)
    if not story:
        raise HTTPException(404, "Historia no encontrada")
    if story.status == "paid":
        return {"mode": provider.mode, "already_paid": True}
    result = await provider.create_checkout(story_id, story.share_slug)
    return result


@api_router.post("/stories/{story_id}/pay-demo")
async def pay_demo(story_id: str):
    if provider.mode != "demo":
        raise HTTPException(400, "Pago demo deshabilitado")
    story = await get_story(story_id)
    if not story:
        raise HTTPException(404, "Historia no encontrada")
    await db.stories.update_one({"id": story_id}, {"$set": {
        "status": "paid", "paid_at": iso_now()}})
    await db.slides.update_many({"story_id": story_id}, {"$set": {"locked": False}})
    return {"status": "paid"}


@api_router.post("/payments/webhook/mercadopago")
async def mp_webhook(request: Request):
    if not isinstance(provider, payments.MercadoPagoProvider):
        return {"received": True}
    data_id = request.query_params.get("data.id") or request.query_params.get("data_id")
    event_type = request.query_params.get("type")
    if not provider.valid_signature(request.headers.get("x-signature"),
                                    request.headers.get("x-request-id"), data_id):
        raise HTTPException(401, "Firma inválida")
    if event_type not in (None, "payment"):
        return {"received": True}
    body = await request.json()
    payment_id = str(data_id or body.get("data", {}).get("id", ""))
    if not payment_id:
        return {"received": True}
    payment = await provider.get_payment(payment_id)
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


@api_router.get("/media/{story_id}/{name}")
async def media(story_id: str, name: str):
    if ".." in name or "/" in name:
        raise HTTPException(400, "Nombre inválido")
    try:
        data, content_type = await asyncio.to_thread(storage.get_bytes, story_id, name)
    except Exception:
        raise HTTPException(404, "No encontrado")
    mime = "audio/mpeg" if name.lower().endswith(".mp3") else (content_type or "image/jpeg")
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
        "style_label": PORTRAIT_STYLES.get(p.style, {}).get("label", p.style),
        "status": p.status, "progress_step": p.progress_step, "progress_pct": p.progress_pct,
        "price_clp": p.price_clp, "paid": paid, "error": p.error,
        "gift_enabled": p.gift_enabled, "gift_to": p.gift_to, "gift_from": p.gift_from,
        "gift_message": p.gift_message, "brand_url": BRAND_URL,
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
        style = PORTRAIT_STYLES.get(p.style) or list(PORTRAIT_STYLES.values())[0]

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
    if payload.style not in PORTRAIT_STYLES:
        raise HTTPException(400, "Estilo inválido")
    p = Portrait(
        pet_name=(payload.pet_name or "").strip()[:40] or None,
        style=payload.style, device_id=x_device_id, user_id=user["user_id"],
        price_clp=PORTRAIT_PRICE_CLP,
        gift_enabled=bool(payload.gift_enabled),
        gift_to=(payload.gift_to or "").strip()[:60] or None,
        gift_from=(payload.gift_from or "").strip()[:60] or None,
        gift_message=(payload.gift_message or "").strip()[:280] or None,
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
    raw = await files[0].read()
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
async def portrait_checkout(portrait_id: str):
    p = await get_portrait(portrait_id)
    if not p:
        raise HTTPException(404, "Retrato no encontrado")
    if p.status == "paid":
        return {"mode": provider.mode, "already_paid": True}
    return await provider.create_checkout(portrait_id, p.share_slug, amount=p.price_clp,
                                          title="Retrato Petito", back_path=f"/r/{p.share_slug}")


@api_router.post("/portraits/{portrait_id}/pay-demo")
async def portrait_pay_demo(portrait_id: str):
    if provider.mode != "demo":
        raise HTTPException(400, "Pago demo deshabilitado")
    p = await get_portrait(portrait_id)
    if not p:
        raise HTTPException(404, "Retrato no encontrado")
    await db.portraits.update_one({"id": portrait_id}, {"$set": {
        "status": "paid", "paid_at": iso_now()}})
    return {"status": "paid"}


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
