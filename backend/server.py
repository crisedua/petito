import os
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Header, Request
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

import models
import storage
import renderer
import ai_pipeline
import payments
from models import Story, Slide, StoryCreate, THEMES, SPECIES, now_utc, iso_now, new_id

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

BRAND_NAME = os.environ.get("BRAND_NAME", "Petito")
BRAND_URL = os.environ.get("BRAND_URL", "petito.pro")
PRICE_CLP = int(os.environ.get("STORY_PRICE_CLP", "3990"))
USD_TO_CLP = float(os.environ.get("USD_TO_CLP", "950"))
FREE_PER_DAY = int(os.environ.get("FREE_PREVIEWS_PER_DAY", "3"))
BONUS_ENABLED = os.environ.get("BONUS_SCENES_ENABLED", "true").lower() == "true"
BONUS_SCENES_COUNT = max(1, min(3, int(os.environ.get("BONUS_SCENES_COUNT", "3"))))
FREE_MODE = os.environ.get("FREE_MODE", "true").lower() == "true"
RETENTION_DAYS = int(os.environ.get("PHOTO_RETENTION_DAYS", "7"))
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")

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
        })
    return {
        "id": story.id, "slug": story.share_slug, "pet_name": story.pet_name,
        "species": story.species, "traits": story.traits, "theme": story.theme,
        "theme_label": THEMES.get(story.theme, {}).get("label", story.theme),
        "music": THEMES.get(story.theme, {}).get("music", "alegre"),
        "status": story.status, "progress_step": story.progress_step,
        "progress_pct": story.progress_pct, "bonus_pending": story.bonus_pending,
        "title": story.title,
        "price_clp": story.price_clp, "paid": paid, "email": story.email,
        "error": story.error, "slides": out, "brand_url": BRAND_URL,
        "retention_days": RETENTION_DAYS,
    }


# ---------------- pipeline ----------------
BONUS_ORDER_BASE = 100   # bonus slides sort between photos and closing
CLOSING_ORDER = 9999


def _save_jpg(story_id, image, fname, q=90):
    image.save(storage.file_path(story_id, fname), "JPEG", quality=q)


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


async def generate_bonus_scenes(story, photos, theme, best_file):
    """Runs AFTER the core story is live; streams each magic scene into the carousel."""
    import time
    scenes_cfg = theme["bonus_scenes"][:BONUS_SCENES_COUNT]
    data_uri = storage.image_to_data_uri(story.id, best_file)
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
    for i, sc in enumerate(scenes_cfg):
        img = images[i]
        if isinstance(img, Exception):
            logger.warning(f"Bonus scene {i} skipped: {img}")
            continue
        cap = sc["caption"].replace("{name}", story.pet_name)
        rendered = await asyncio.to_thread(renderer.photo_slide, img, cap, sc["sticker"],
                                           story.pet_name, BRAND_NAME, story.theme, i)
        await _add_slide(story.id, "bonus", rendered, BONUS_ORDER_BASE + i, caption=cap)
        ok += 1

    if ok:
        await log_generation(story.id, "bonus_scenes", ai_pipeline.FAL_MODEL, images=ok,
                             cost_usd=ai_pipeline.FAL_IMG_COST * ok,
                             duration_ms=int((time.monotonic() - t0) * 1000))
    await db.stories.update_one({"id": story.id}, {"$set": {
        "bonus_pending": False, "progress_step": "¡Tu historia está lista!"}})


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
        b64s = [storage.image_to_b64(story_id, p["file"]) for p in photos]
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
        await db.stories.update_one({"id": story_id}, {"$set": {
            "status": "preview_ready", "title": title, "progress_pct": 100,
            "bonus_pending": bonus_will_run,
            "progress_step": "Agregando escenas mágicas..." if bonus_will_run else "¡Tu historia está lista!"}})
        logger.info(f"Story {story_id} core ready (bonus_pending={bonus_will_run})")

        # Stage 4: bonus scenes stream in while the user already enjoys the story
        if bonus_will_run:
            await generate_bonus_scenes(story, photos, theme, best_file)
            logger.info(f"Story {story_id} bonus scenes done")
    except Exception as e:
        logger.exception(f"Pipeline failed for {story_id}")
        await db.stories.update_one({"id": story_id}, {"$set": {
            "status": "failed", "error": str(e), "progress_step": "Algo salió mal",
            "progress_pct": 0, "bonus_pending": False}})


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
        "free_per_day": FREE_PER_DAY, "retention_days": RETENTION_DAYS,
        "themes": [{"key": k, "label": v["label"], "emoji": v["emoji"]} for k, v in THEMES.items()],
        "traits": models.TRAITS,
    }


@api_router.post("/stories")
async def create_story(payload: StoryCreate, x_device_id: str = Header(default="")):
    if payload.theme not in THEMES:
        raise HTTPException(400, "Tema inválido")
    story = Story(
        pet_name=payload.pet_name.strip()[:40] or "Mi mascota",
        species=payload.species if payload.species in SPECIES else "otro",
        traits=[t for t in payload.traits if t in models.TRAITS][:3],
        theme=payload.theme, email=payload.email, device_id=x_device_id,
        price_clp=PRICE_CLP, bonus_enabled=BONUS_ENABLED,
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
            name = storage.save_original(story_id, i, raw)
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
    story = await get_story(order_id) if order_id else None
    if not story:
        return {"received": True}
    approved = (payment.get("status") == "approved" and payment.get("currency_id") == "CLP"
                and float(payment.get("transaction_amount", 0)) == story.price_clp)
    if approved:
        await db.stories.update_one({"id": order_id, "status": {"$ne": "paid"}},
                                    {"$set": {"status": "paid", "paid_at": iso_now()}})
        await db.slides.update_many({"story_id": order_id}, {"$set": {"locked": False}})
    return {"received": True}


@api_router.get("/media/{story_id}/{name}")
async def media(story_id: str, name: str):
    if ".." in name or "/" in name:
        raise HTTPException(400, "Nombre inválido")
    path = storage.file_path(story_id, name)
    if not path.exists():
        raise HTTPException(404, "No encontrado")
    return FileResponse(path, media_type="image/jpeg")


# ---------------- admin ----------------
class AdminLogin(BaseModel):
    password: str


def check_admin(authorization: str):
    token = (authorization or "").replace("Bearer ", "").strip()
    if token != ADMIN_TOKEN or not ADMIN_TOKEN:
        raise HTTPException(401, "No autorizado")


@api_router.post("/admin/login")
async def admin_login(payload: AdminLogin):
    if payload.password != ADMIN_PASSWORD or not ADMIN_PASSWORD:
        raise HTTPException(401, "Contraseña incorrecta")
    return {"token": ADMIN_TOKEN}


@api_router.get("/admin/metrics")
async def admin_metrics(authorization: str = Header(default="")):
    check_admin(authorization)
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


@api_router.get("/admin/stories")
async def admin_stories(authorization: str = Header(default=""), filter: str = "all"):
    check_admin(authorization)
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


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
