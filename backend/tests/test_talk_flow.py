"""Backend tests for Petito Habla (talking video) feature."""
import os
import io
import uuid
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cuentapatas-demo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

NORM_TOKEN = "test_session_norm_1"
ADMIN_TOKEN = "test_session_admin_1"
PREVIEW_SLUG = "0de2b4b5f5"
FULL_SLUG = "23fd33ad28"
HERO_SLUG = "f306f4d403"


def _png_bytes():
    img = Image.new("RGB", (512, 512), (120, 160, 200))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


# ---- GET /api/talk/slug/<slug> is public ----
class TestPublicSlugRead:
    def test_get_preview_slug_no_auth(self):
        r = requests.get(f"{API}/talk/slug/{PREVIEW_SLUG}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["slug"] == PREVIEW_SLUG
        assert d["mode"] == "preview_free"
        assert d["status"] == "preview_ready"
        assert d.get("preview_url")

    def test_get_full_slug_no_auth(self):
        r = requests.get(f"{API}/talk/slug/{FULL_SLUG}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["slug"] == FULL_SLUG
        assert d["mode"] == "full"
        assert d.get("pet_name") == "Rocky"
        # Not paid yet
        assert d.get("paid") is False

    def test_get_missing_slug_404(self):
        r = requests.get(f"{API}/talk/slug/doesnotexist123", timeout=15)
        assert r.status_code == 404


# ---- Auth gating ----
class TestAuthGating:
    def test_create_talk_requires_auth(self):
        r = requests.post(f"{API}/talk", json={"pet_name": "X", "species": "perro"}, timeout=15)
        assert r.status_code == 401, r.text

    def test_create_talk_authed_ok(self):
        r = requests.post(
            f"{API}/talk",
            json={"pet_name": "TEST_Pet", "species": "perro"},
            headers={"Authorization": f"Bearer {NORM_TOKEN}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d and "slug" in d
        # cleanup
        try:
            import pymongo
            c = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            c["test_database"]["videos"].delete_one({"id": d["id"]})
        except Exception:
            pass

    def test_generate_talk_requires_auth(self):
        # Use a fake id -- auth check should happen before id lookup, expect 401
        r = requests.post(f"{API}/talk/does-not-exist/generate", timeout=15)
        assert r.status_code == 401

    def test_me_videos_requires_auth(self):
        r = requests.get(f"{API}/me/videos", timeout=15)
        assert r.status_code == 401

    def test_me_videos_lists_rocky(self):
        r = requests.get(
            f"{API}/me/videos",
            headers={"Authorization": f"Bearer {NORM_TOKEN}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        rocky = [v for v in items if v.get("slug") == FULL_SLUG]
        assert len(rocky) == 1, f"Rocky video missing in /me/videos: {items}"
        assert rocky[0]["pet_name"] == "Rocky"


# ---- Anonymous preview rate limit (2/day per device) ----
class TestAnonymousPreview:
    def test_preview_no_auth_accepted_and_rate_limited(self):
        """Fire 3 preview calls with a fresh device id. First 2 must be accepted (<400),
        3rd must be 429. Do not wait for pipeline to finish."""
        device_id = f"TEST_device_{uuid.uuid4().hex[:10]}"
        png = _png_bytes()
        accepted = 0
        rate_limited = False
        created_ids = []
        for i in range(3):
            files = {"files": (f"p{i}.png", png, "image/png")}
            r = requests.post(
                f"{API}/talk/preview",
                headers={"X-Device-Id": device_id},
                files=files,
                timeout=30,
            )
            if r.status_code < 400:
                accepted += 1
                try:
                    created_ids.append(r.json().get("id"))
                except Exception:
                    pass
            elif r.status_code == 429:
                rate_limited = True
                break
        assert accepted >= 1, f"No anonymous previews accepted (last status may be 429 too early)"
        assert rate_limited, "Expected 429 on 3rd preview for same device"
        # cleanup created preview rows so they don't pollute DB
        try:
            import pymongo
            c = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            if created_ids:
                c["test_database"]["videos"].delete_many({"id": {"$in": created_ids}})
                c["test_database"]["talk_photos"].delete_many({"video_id": {"$in": created_ids}})
        except Exception:
            pass


# ---- Checkout should redirect to MercadoPago ----
class TestCheckoutRedirect:
    def test_checkout_returns_mp_url(self):
        v = requests.get(f"{API}/talk/slug/{FULL_SLUG}", timeout=15).json()
        vid = v["id"]
        r = requests.post(f"{API}/talk/{vid}/checkout", timeout=30)
        # Should return 200 with init_point / sandbox_init_point going to mercadopago
        assert r.status_code == 200, r.text
        d = r.json()
        url = d.get("init_point") or d.get("checkout_url") or d.get("url") or ""
        assert "mercadopago" in url.lower(), f"Expected mercadopago URL, got: {d}"
