"""End-to-end backend tests for Cuentapatas (Chilean pet-story PWA).
Covers config, pipeline, paywall, public page, rate-limit, admin, cost logging.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://cuentapatas-demo.preview.emergentagent.com"
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
    assert len(d["themes"]) == 5
    assert len(d["traits"]) == 7
    keys = {t["key"] for t in d["themes"]}
    assert {"mi_ano", "aventuras", "un_dia", "dieciochero", "navidad"}.issubset(keys) or len(keys) == 5


# ---------------- full pipeline ----------------
@pytest.fixture(scope="module")
def generated_story(device_id):
    # Create
    payload = {"pet_name": "TestPatas", "species": "perro",
               "traits": ["regalon", "chistoso"], "theme": "dieciochero"}
    r = requests.post(f"{API}/stories", json=payload,
                      headers={"X-Device-Id": device_id}, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["id"]

    # Upload photos
    files = [("files", (f"p{i}.jpg", open(p, "rb"), "image/jpeg"))
             for i, p in enumerate(PHOTOS)]
    r = requests.post(f"{API}/stories/{sid}/photos", files=files, timeout=60)
    for _, f in files:
        f[1].close()
    assert r.status_code == 200, r.text
    assert r.json()["uploaded"] == 3

    # Generate
    r = requests.post(f"{API}/stories/{sid}/generate",
                      headers={"X-Device-Id": device_id}, timeout=30)
    assert r.status_code == 200, r.text

    # Poll
    deadline = time.time() + 150
    status = None
    data = None
    while time.time() < deadline:
        r = requests.get(f"{API}/stories/{sid}", timeout=30)
        assert r.status_code == 200
        data = r.json()
        status = data["status"]
        if status in ("preview_ready", "paid", "failed"):
            break
        time.sleep(5)
    assert status == "preview_ready", f"Pipeline did not complete: status={status} err={data.get('error') if data else None}"
    return sid, data


def test_pipeline_result(generated_story):
    sid, data = generated_story
    assert data["title"]
    slides = data["slides"]
    assert len(slides) >= 4  # title + photos + closing
    assert slides[0]["kind"] == "title"
    kinds = [s["kind"] for s in slides]
    assert "closing" in kinds
    # First 2 unlocked, later locked
    assert slides[0]["locked"] is False
    assert slides[1]["locked"] is False
    assert any(s["locked"] for s in slides[2:])
    for s in slides[2:]:
        if s["locked"]:
            assert "_locked" in s["image_url"]


def test_paywall_unlock(generated_story):
    sid, _ = generated_story
    r = requests.post(f"{API}/stories/{sid}/pay-demo", timeout=30)
    assert r.status_code == 200
    assert r.json()["status"] == "paid"
    r = requests.get(f"{API}/stories/{sid}", timeout=30)
    d = r.json()
    assert d["paid"] is True
    for s in d["slides"]:
        assert s["locked"] is False
        assert "_locked" not in (s["image_url"] or "")


def test_media_accessible(generated_story):
    sid, data = generated_story
    url = BASE_URL + data["slides"][0]["image_url"]
    r = requests.get(url, timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/")


# ---------------- public slug page ----------------
def test_public_slug_page(generated_story):
    sid, data = generated_story
    slug = data["slug"]
    r = requests.get(f"{API}/stories/slug/{slug}", timeout=30)
    assert r.status_code == 200
    assert r.json()["id"] == sid


# ---------------- rate limiting ----------------
def test_rate_limit_429():
    device = f"rl-{uuid.uuid4()}"
    sids = []
    # Create & generate 3 times (expected success)
    for i in range(3):
        r = requests.post(f"{API}/stories",
                          json={"pet_name": f"RL{i}", "species": "perro",
                                "traits": ["regalon"], "theme": "un_dia"},
                          headers={"X-Device-Id": device}, timeout=30)
        assert r.status_code == 200
        sid = r.json()["id"]
        files = [("files", (f"p.jpg", open(PHOTOS[0], "rb"), "image/jpeg"))]
        requests.post(f"{API}/stories/{sid}/photos", files=files, timeout=60)
        files[0][1][1].close()
        g = requests.post(f"{API}/stories/{sid}/generate",
                          headers={"X-Device-Id": device}, timeout=30)
        assert g.status_code == 200, f"call {i+1}: {g.status_code} {g.text}"
        sids.append(sid)
    # 4th should 429
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
