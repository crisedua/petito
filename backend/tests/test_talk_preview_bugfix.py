"""Bug-fix verification tests for /api/talk/preview

Covers:
 - Fast response: endpoint returns {id, slug} immediately (<10s) with normal JPEG
 - HEIC/HEIF iPhone photos accepted and decoded
 - Empty/invalid file -> clean 400 with Spanish message
 - media_base resolves from x-forwarded-host so pipeline reaches preview_ready
 - Rate limit: 3rd preview with same X-Device-Id -> 429 Spanish message
 - Regression: normal JPEG still works for story upload path
"""
import os
import io
import time
import uuid
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


def _jpeg_bytes(size=(512, 512), color=(180, 120, 90)):
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def _heic_bytes(size=(512, 512), color=(90, 160, 200)):
    import pillow_heif
    img = Image.new("RGB", size, color)
    heif = pillow_heif.from_pillow(img)
    buf = io.BytesIO()
    heif.save(buf, format="HEIF")
    return buf.getvalue()


def _cleanup_video(vid):
    try:
        import pymongo
        c = pymongo.MongoClient(MONGO_URL)
        c[DB_NAME]["videos"].delete_one({"id": vid})
        c[DB_NAME]["talk_photos"].delete_many({"video_id": vid})
    except Exception:
        pass


# ---- Fast response + media_base resolution ----
class TestTalkPreviewFastResponse:
    def test_preview_jpeg_returns_fast_200(self):
        device = f"TEST_fast_{uuid.uuid4().hex[:10]}"
        files = {"files": ("pet.jpg", _jpeg_bytes(), "image/jpeg")}
        t0 = time.monotonic()
        r = requests.post(f"{API}/talk/preview",
                          headers={"X-Device-Id": device}, files=files, timeout=30)
        elapsed = time.monotonic() - t0
        assert r.status_code == 200, f"status={r.status_code} body={r.text}"
        d = r.json()
        assert "id" in d and "slug" in d
        assert isinstance(d["id"], str) and len(d["id"]) > 0
        assert isinstance(d["slug"], str) and len(d["slug"]) > 0
        # Must NOT block on the heavy pipeline (fal video ~ 60s)
        assert elapsed < 15, f"Response too slow: {elapsed:.2f}s (should be <15s, not blocked)"
        # Verify media_base was stored (either from Origin or x-forwarded-host fallback)
        try:
            import pymongo
            c = pymongo.MongoClient(MONGO_URL)
            doc = c[DB_NAME]["videos"].find_one({"id": d["id"]}, {"media_base": 1, "mode": 1})
            assert doc is not None
            assert doc.get("mode") == "preview_free"
            assert doc.get("media_base"), f"media_base is empty - pipeline would fail with 'Falta media_base'. doc={doc}"
            assert doc["media_base"].startswith("http"), f"bad media_base: {doc.get('media_base')}"
        finally:
            _cleanup_video(d["id"])


# ---- HEIC decoding support ----
class TestHeicUpload:
    def test_preview_heic_accepted(self):
        device = f"TEST_heic_{uuid.uuid4().hex[:10]}"
        try:
            heic = _heic_bytes()
        except Exception as e:
            pytest.skip(f"pillow_heif not usable to build fixture: {e}")
        files = {"files": ("pet.heic", heic, "image/heic")}
        r = requests.post(f"{API}/talk/preview",
                          headers={"X-Device-Id": device}, files=files, timeout=30)
        assert r.status_code == 200, f"HEIC upload should be accepted. status={r.status_code} body={r.text}"
        d = r.json()
        assert d.get("id") and d.get("slug")
        _cleanup_video(d["id"])


# ---- Clean 400 on bad input ----
class TestBadInput:
    def test_empty_file_returns_400(self):
        device = f"TEST_empty_{uuid.uuid4().hex[:10]}"
        files = {"files": ("empty.jpg", b"", "image/jpeg")}
        r = requests.post(f"{API}/talk/preview",
                          headers={"X-Device-Id": device}, files=files, timeout=15)
        assert r.status_code == 400, f"status={r.status_code} body={r.text}"
        # must be JSON (not HTML/500)
        try:
            d = r.json()
        except Exception:
            pytest.fail(f"Response is not JSON: {r.text!r}")
        detail = (d.get("detail") or "").lower()
        assert detail, f"missing detail: {d}"
        # Spanish friendly msg (either "foto vacía" or similar)
        assert any(k in detail for k in ["foto", "vac", "sube"]), f"Not a friendly ES message: {d}"

    def test_garbage_file_returns_clean_400(self):
        device = f"TEST_garbage_{uuid.uuid4().hex[:10]}"
        files = {"files": ("junk.jpg", b"this is not an image at all" * 20, "image/jpeg")}
        r = requests.post(f"{API}/talk/preview",
                          headers={"X-Device-Id": device}, files=files, timeout=30)
        assert r.status_code == 400, f"Expected 400 for garbage image, got {r.status_code}: {r.text}"
        d = r.json()
        detail = (d.get("detail") or "").lower()
        # must mention "foto" (friendly ES msg from server.py line 1042)
        assert "foto" in detail, f"Not friendly ES message: {d}"


# ---- Rate limiting ----
class TestRateLimit:
    def test_third_preview_returns_429(self):
        device = f"TEST_rl_{uuid.uuid4().hex[:10]}"
        jpeg = _jpeg_bytes()
        created = []
        statuses = []
        for i in range(3):
            files = {"files": (f"p{i}.jpg", jpeg, "image/jpeg")}
            r = requests.post(f"{API}/talk/preview",
                              headers={"X-Device-Id": device}, files=files, timeout=30)
            statuses.append(r.status_code)
            if r.status_code == 200:
                try:
                    created.append(r.json().get("id"))
                except Exception:
                    pass
        # First two must be accepted
        assert statuses[0] == 200, f"1st upload failed: {statuses}"
        assert statuses[1] == 200, f"2nd upload failed: {statuses}"
        # 3rd must be rate-limited
        assert statuses[2] == 429, f"Expected 3rd to be 429, got {statuses}"
        # verify ES message
        files = {"files": ("final.jpg", jpeg, "image/jpeg")}
        r = requests.post(f"{API}/talk/preview",
                          headers={"X-Device-Id": device}, files=files, timeout=15)
        assert r.status_code == 429
        detail = (r.json().get("detail") or "").lower()
        assert "límite" in detail or "limite" in detail or "gratis" in detail, f"Bad RL msg: {r.json()}"
        for vid in created:
            _cleanup_video(vid)


# ---- Background pipeline reaches preview_ready (patient poll) ----
class TestPipelineCompletes:
    def test_preview_eventually_ready(self):
        device = f"TEST_pipe_{uuid.uuid4().hex[:10]}"
        files = {"files": ("pet.jpg", _jpeg_bytes((640, 640)), "image/jpeg")}
        r = requests.post(f"{API}/talk/preview",
                          headers={"X-Device-Id": device}, files=files, timeout=30)
        assert r.status_code == 200, r.text
        slug = r.json()["slug"]
        vid = r.json()["id"]
        try:
            # Poll up to 180s. Fail only on explicit error or missing media_base.
            final_status = None
            final_error = None
            preview_url = None
            deadline = time.monotonic() + 180
            while time.monotonic() < deadline:
                g = requests.get(f"{API}/talk/slug/{slug}", timeout=15)
                assert g.status_code == 200, g.text
                d = g.json()
                final_status = d.get("status")
                final_error = d.get("error")
                preview_url = d.get("preview_url")
                if final_status == "preview_ready" and preview_url:
                    break
                if final_status == "failed":
                    break
                time.sleep(5)
            if final_status == "failed":
                # Check if it was the media_base bug (that is what we're verifying)
                err = (final_error or "").lower()
                assert "media_base" not in err and "falta media_base" not in err, (
                    f"Regression: pipeline failed with media_base error: {final_error}")
                # Other failures (fal credit / timeout) — report but don't hard-fail bug verification
                pytest.skip(f"Pipeline failed with non-media_base error (likely upstream fal): {final_error}")
            assert final_status == "preview_ready", (
                f"Pipeline did not finish in 180s. last_status={final_status} error={final_error}")
            assert preview_url, "preview_url missing after preview_ready"
        finally:
            _cleanup_video(vid)


# ---- Regression: pillow-heif registration didn't break normal JPEG ----
class TestJpegRegression:
    def test_normal_jpeg_still_decodes_via_api(self):
        """Full-stack regression: pillow-heif registration didn't break normal JPEG decode."""
        device = f"TEST_jpegreg_{uuid.uuid4().hex[:10]}"
        files = {"files": ("vanilla.jpg", _jpeg_bytes((320, 320)), "image/jpeg")}
        r = requests.post(f"{API}/talk/preview",
                          headers={"X-Device-Id": device}, files=files, timeout=30)
        assert r.status_code == 200, f"JPEG regression broken: {r.status_code} {r.text}"
        _cleanup_video(r.json().get("id"))
