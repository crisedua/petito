"""End-to-end backend tests for Cuentapatas (Chilean pet-story PWA) in FREE_MODE.
Covers /api/config (free_mode=true), full pipeline (all unlocked, paid=true),
media serving, public slug page, rate-limit (3/day), admin, cost logging.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "Cuentapatas.2026"

PHOTOS = ["/tmp/dog1.jpg", "/tmp/dog2.jpg", "/tmp/dog3.jpg"]


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def device_id():
    return f"test-{uuid.uuid4()}"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    assert tok
    return tok


# ---------------- config ----------------
def test_config():
    r = requests.get(f"{API}/config", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["price_clp"] == 3990
    assert d["payment_mode"] == "demo"
    assert d["bonus_enabled"] is True
    assert d["free_mode"] is True, f"expected free_mode=true got {d.get('free_mode')}"
    assert d["bonus_scenes_count"] == 3, f"expected 3 bonus scenes, got {d.get('bonus_scenes_count')}"
    assert len(d["themes"]) == 5
    assert len(d["traits"]) == 7
    theme_keys = {t["key"] for t in d["themes"]}
    assert theme_keys == {"mi_ano", "mis_aventuras", "un_dia", "dieciochero", "navidad"}


# ---------------- full pipeline (FREE MODE) ----------------
@pytest.fixture(scope="module")
def generated_story(device_id):
    payload = {"pet_name": "TestPatas", "species": "perro",
               "traits": ["regalon", "chistoso"], "theme": "mis_aventuras"}
    r = requests.post(f"{API}/stories", json=payload,
                      headers={"X-Device-Id": device_id}, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["id"]

    files = [("files", (f"p{i}.jpg", open(p, "rb"), "image/jpeg"))
             for i, p in enumerate(PHOTOS)]
    r = requests.post(f"{API}/stories/{sid}/photos", files=files, timeout=60)
    for _, f in files:
        f[1].close()
    assert r.status_code == 200, r.text
    assert r.json()["uploaded"] == 3

    r = requests.post(f"{API}/stories/{sid}/generate",
                      headers={"X-Device-Id": device_id}, timeout=30)
    assert r.status_code == 200, r.text

    deadline = time.time() + 240
    status, data = None, None
    while time.time() < deadline:
        r = requests.get(f"{API}/stories/{sid}", timeout=30)
        assert r.status_code == 200
        data = r.json()
        status = data["status"]
        if status in ("preview_ready", "paid", "failed"):
            break
        time.sleep(5)
    assert status == "preview_ready", f"status={status} err={data.get('error') if data else None}"
    return sid, data


def test_pipeline_free_mode(generated_story):
    _, data = generated_story
    assert data["title"]
    assert data["paid"] is True, "FREE_MODE should mark story as paid=true"
    assert data.get("music") == "aventura", f"expected music=aventura for mis_aventuras, got {data.get('music')}"
    slides = data["slides"]
    assert len(slides) >= 4
    assert slides[0]["kind"] == "title"
    kinds = [s["kind"] for s in slides]
    assert "closing" in kinds
    # 3 bonus slides
    bonus = [s for s in slides if s["kind"] == "bonus"]
    assert len(bonus) == 3, f"expected 3 bonus slides, got {len(bonus)}"
    captions = [b.get("caption", "") for b in bonus]
    assert len(set(captions)) == 3, f"bonus captions should be distinct: {captions}"
    for c in captions:
        assert c and len(c) > 5, f"bonus caption empty/short: {c!r}"
    # ALL slides must be unlocked and must NOT serve _locked variants
    for s in slides:
        assert s["locked"] is False, f"slide {s['order']} is locked in free mode"
        assert s["image_url"], "slide missing image_url"
        assert "_locked" not in s["image_url"], f"serving locked variant: {s['image_url']}"


def test_media_accessible(generated_story):
    _, data = generated_story
    for s in data["slides"][:3]:
        url = BASE_URL + s["image_url"]
        r = requests.get(url, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")


def test_public_slug_page(generated_story):
    sid, data = generated_story
    slug = data["slug"]
    r = requests.get(f"{API}/stories/slug/{slug}", timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == sid
    assert body["paid"] is True
    assert body.get("music") == "aventura"
    bonus = [s for s in body["slides"] if s["kind"] == "bonus"]
    assert len(bonus) == 3
    for s in body["slides"]:
        assert s["locked"] is False


def test_existing_demo_slug_navidad():
    """Review-provided seed story /h/fcbaa7ca92 (tema navidad, 3 bonus)."""
    r = requests.get(f"{API}/stories/slug/fcbaa7ca92", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d.get("music") == "navidad"
    bonus = [s for s in d["slides"] if s["kind"] == "bonus"]
    assert len(bonus) == 3
    captions = {b.get("caption") for b in bonus}
    assert len(captions) == 3


# ---------------- rate limiting (3/day/device) ----------------
def test_rate_limit_429():
    device = f"rl-{uuid.uuid4()}"
    for i in range(3):
        r = requests.post(f"{API}/stories",
                          json={"pet_name": f"RL{i}", "species": "perro",
                                "traits": ["regalon"], "theme": "un_dia"},
                          headers={"X-Device-Id": device}, timeout=30)
        assert r.status_code == 200
        sid = r.json()["id"]
        files = [("files", ("p.jpg", open(PHOTOS[0], "rb"), "image/jpeg"))]
        requests.post(f"{API}/stories/{sid}/photos", files=files, timeout=60)
        files[0][1][1].close()
        g = requests.post(f"{API}/stories/{sid}/generate",
                          headers={"X-Device-Id": device}, timeout=30)
        assert g.status_code == 200, f"call {i+1}: {g.status_code} {g.text}"
    # 4th -> 429
    r = requests.post(f"{API}/stories",
                      json={"pet_name": "RL4", "species": "perro",
                            "traits": ["regalon"], "theme": "un_dia"},
                      headers={"X-Device-Id": device}, timeout=30)
    sid = r.json()["id"]
    files = [("files", ("p.jpg", open(PHOTOS[0], "rb"), "image/jpeg"))]
    requests.post(f"{API}/stories/{sid}/photos", files=files, timeout=60)
    files[0][1][1].close()
    r = requests.post(f"{API}/stories/{sid}/generate",
                     headers={"X-Device-Id": device}, timeout=30)
    assert r.status_code == 429, f"expected 429, got {r.status_code}: {r.text}"


# ---------------- admin ----------------
def test_admin_login_wrong():
    r = requests.post(f"{API}/admin/login", json={"password": "bad"}, timeout=30)
    assert r.status_code == 401


def test_admin_metrics(admin_token, generated_story):
    r = requests.get(f"{API}/admin/metrics",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["total_stories"] >= 1
    assert d["avg_cost_clp"] < 600, f"avg_cost_clp={d['avg_cost_clp']} exceeds guardrail"


def test_admin_stories(admin_token):
    r = requests.get(f"{API}/admin/stories?filter=all",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_unauth():
    r = requests.get(f"{API}/admin/metrics", timeout=30)
    assert r.status_code == 401
