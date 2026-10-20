"""
Acceptance tests for the Next.js + Supabase API (no direct database access; state is driven through
the API, e.g. Plus is toggled with the admin endpoint). Run against a local or preview deployment:

  PETITO_URL=http://localhost:3000 pytest web/tests/test_api.py

Requires TEST_SESSION_TOKENS on the server with test_session_norm_1, test_session_admin_1 and
test_session_tmp_1, and `npx tsx scripts/seed-fixtures.ts` (pet "Rocco" owned by the norm user).
"""
import io
import os
import time
import uuid

import pytest
import requests

BASE = os.environ.get("PETITO_URL", "http://localhost:3000").rstrip("/")
API = f"{BASE}/api"
ROCCO = "a8f1f1bb-e5ef-4854-b07e-dc438112bd4a"


def H(token=None, device=None):
    h = {"X-Device-Id": device or f"dev-{uuid.uuid4().hex[:8]}"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


NORM, ADMIN, TMP = H("test_session_norm_1"), H("test_session_admin_1"), H("test_session_tmp_1")


def jpeg():
    # 2x2 JPEG generated without Pillow
    return bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080002000201011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbfcffd9"
    )


def me(h):
    return requests.get(f"{API}/auth/me", headers=h, timeout=20).json()


def set_plus(user_id, active):
    r = requests.post(f"{API}/admin/users/{user_id}/plus", json={"active": active}, headers=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["is_plus"] is active


@pytest.fixture
def norm_free():
    uid = me(NORM)["user_id"]
    set_plus(uid, False)
    yield uid
    set_plus(uid, True)


# ---------------- auth ----------------
def test_me_requires_login():
    r = requests.get(f"{API}/auth/me", timeout=20)
    assert r.status_code == 401 and r.json()["detail"] == "Inicia sesión para continuar"


def test_admin_flag():
    assert me(ADMIN)["is_admin"] is True
    assert me(NORM)["is_admin"] is False
    assert requests.get(f"{API}/admin/metrics", headers=NORM, timeout=20).status_code == 403


# ---------------- Plus gating (subscription-only unlocks) ----------------
def test_free_user_second_pet_blocked(norm_free):
    r = requests.post(f"{API}/pets", json={"name": "Otro"}, headers=NORM, timeout=20)
    assert r.status_code == 402
    assert "Plus" in r.json()["detail"]


def test_free_user_checkout_requires_plus_then_plus_unlocks(norm_free):
    s = requests.post(f"{API}/stories", json={"pet_name": "Rocco", "species": "perro", "theme": "mi_ano"}, headers=NORM, timeout=20).json()
    assert requests.post(f"{API}/stories/{s['id']}/checkout", headers=NORM, timeout=20).json() == {"mode": "plus_required"}
    p = requests.post(f"{API}/portraits", json={"style": "victoriano"}, headers=NORM, timeout=20).json()
    assert requests.post(f"{API}/portraits/{p['id']}/checkout", headers=NORM, timeout=20).json()["mode"] == "plus_required"
    set_plus(norm_free, True)
    assert requests.post(f"{API}/stories/{s['id']}/checkout", headers=NORM, timeout=20).json() == {"mode": "plus", "already_paid": True}
    assert requests.post(f"{API}/portraits/{p['id']}/checkout", headers=NORM, timeout=20).json()["mode"] == "plus"
    assert requests.get(f"{API}/portraits/{p['id']}", timeout=20).json()["paid"] is True


def test_plus_status_shape():
    d = requests.get(f"{API}/plus/status", headers=NORM, timeout=20).json()
    for k in ("active", "plan", "status", "plus_until", "monthly_clp", "annual_clp", "free_mode", "is_admin"):
        assert k in d
    assert d["monthly_clp"] == 3900 and d["annual_clp"] == 29900


def test_dev_activate_then_admin_deactivate_own_admin_keeps_plus():
    assert requests.post(f"{API}/plus/admin-activate", json={"plan": "annual"}, headers=ADMIN, timeout=20).json() == {"active": True, "plan": "annual"}
    assert requests.get(f"{API}/plus/status", headers=ADMIN, timeout=20).json()["active"] is True
    assert requests.post(f"{API}/plus/admin-deactivate", headers=ADMIN, timeout=20).json() == {"active": False}
    st = requests.get(f"{API}/plus/status", headers=ADMIN, timeout=20).json()
    assert st["active"] is True and st["via_admin"] is True  # admins always have Plus, no subscription needed


# ---------------- privacy and ownership ----------------
def test_other_users_pet_is_404():
    assert requests.get(f"{API}/pets/{ROCCO}", headers=ADMIN, timeout=20).status_code == 404
    assert requests.get(f"{API}/pets/{ROCCO}/memories", headers=ADMIN, timeout=20).status_code == 404


def test_public_album_only_when_enabled_and_only_shared_memories():
    slug = requests.get(f"{API}/pets/{ROCCO}", headers=NORM, timeout=20).json()["share_slug"]
    m = requests.post(f"{API}/pets/{ROCCO}/memories", json={"title": "TEST_secret"}, headers=NORM, timeout=20).json()
    requests.put(f"{API}/pets/{ROCCO}", json={"public_enabled": False}, headers=NORM, timeout=20)
    assert requests.get(f"{API}/u/{slug}", timeout=20).status_code == 404
    requests.put(f"{API}/pets/{ROCCO}", json={"public_enabled": True}, headers=NORM, timeout=20)
    titles = [x["title"] for x in requests.get(f"{API}/u/{slug}", timeout=20).json()["memories"]]
    assert "TEST_secret" not in titles
    assert requests.post(f"{API}/memories/{m['id']}/share", headers=NORM, timeout=20).json() == {"shared": True}
    titles = [x["title"] for x in requests.get(f"{API}/u/{slug}", timeout=20).json()["memories"]]
    assert "TEST_secret" in titles
    requests.delete(f"{API}/memories/{m['id']}", headers=NORM, timeout=20)


# ---------------- uploads (browser flow: sign → PUT to Storage → process) ----------------
def test_signed_upload_flow_for_memory_photo():
    m = requests.post(f"{API}/pets/{ROCCO}/memories", json={"title": "TEST_upload"}, headers=NORM, timeout=20).json()
    signed = requests.post(f"{API}/memories/{m['id']}/photo/sign", json={"count": 1}, headers=NORM, timeout=20).json()
    u = signed["uploads"][0]
    supa = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
    put = requests.put(f"{supa}/storage/v1/object/upload/sign/media/{u['path']}?token={u['token']}", data=jpeg(), headers={"content-type": "image/jpeg", "x-upsert": "true"}, timeout=20)
    assert put.status_code == 200, put.text
    r = requests.post(f"{API}/memories/{m['id']}/photo", json={"raw": [u["name"]]}, headers=NORM, timeout=30)
    assert r.status_code == 200, r.text
    img = requests.get(BASE + r.json()["photo_url"], timeout=20)
    assert img.status_code == 200 and img.headers["content-type"].startswith("image/jpeg")
    # raw upload removed after processing; unknown raw names are ignored
    assert requests.post(f"{API}/memories/{m['id']}/photo", json={"raw": ["../../etc/passwd"]}, headers=NORM, timeout=20).status_code == 400
    requests.delete(f"{API}/memories/{m['id']}", headers=NORM, timeout=20)


# ---------------- media proxy ----------------
def test_media_proxy_rejects_traversal_and_supports_ranges():
    assert requests.get(f"{API}/media/x/..secret", timeout=20).status_code == 400
    assert requests.get(f"{API}/media/nope/nothing.jpg", timeout=20).status_code == 404
    r = requests.post(f"{API}/talk/preview", files={"files": ("p.jpg", jpeg(), "image/jpeg")}, headers=H(), timeout=60).json()
    for _ in range(60):
        d = requests.get(f"{API}/talk/{r['id']}", timeout=20).json()
        if d["status"] == "preview_ready":
            break
        time.sleep(1)
    rr = requests.get(BASE + d["preview_url"], headers={"Range": "bytes=0-99"}, timeout=20)
    assert rr.status_code == 206 and len(rr.content) == 100 and rr.headers["content-type"] == "video/mp4"


# ---------------- rate limits ----------------
def test_free_talk_preview_daily_limit():
    dev = H(device=f"rl-{uuid.uuid4().hex[:8]}")
    codes = [requests.post(f"{API}/talk/preview/start", headers=dev, timeout=20).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


# ---------------- admin cascades ----------------
def test_admin_delete_pet_cascades():
    uid = me(TMP)["user_id"]
    set_plus(uid, True)
    pet = requests.post(f"{API}/pets", json={"name": "TEST_Cascade"}, headers=TMP, timeout=20).json()
    mem = requests.post(f"{API}/pets/{pet['id']}/memories", json={"title": "x"}, headers=TMP, timeout=20).json()
    story = requests.post(f"{API}/stories", json={"pet_name": "x", "species": "perro", "theme": "mi_ano", "pet_id": pet["id"]}, headers=TMP, timeout=20).json()
    assert requests.delete(f"{API}/admin/pets/{pet['id']}", headers=ADMIN, timeout=20).json() == {"ok": True}
    assert requests.get(f"{API}/memories/{mem['id']}", headers=TMP, timeout=20).status_code == 404
    assert requests.get(f"{API}/stories/{story['id']}", timeout=20).status_code == 404


def test_admin_delete_user_removes_everything():
    uid = me(TMP)["user_id"]
    set_plus(uid, True)
    pet = requests.post(f"{API}/pets", json={"name": "TEST_Gone"}, headers=TMP, timeout=20).json()
    detail = requests.get(f"{API}/admin/users/{uid}", headers=ADMIN, timeout=20).json()
    assert any(p["id"] == pet["id"] for p in detail["pets"]) and detail["is_plus"] is True
    assert requests.delete(f"{API}/admin/users/{uid}", headers=ADMIN, timeout=20).json() == {"ok": True}
    assert requests.get(f"{API}/admin/users/{uid}", headers=ADMIN, timeout=20).status_code == 404
    # signing in again creates a brand-new, empty account
    assert requests.get(f"{API}/pets", headers=TMP, timeout=20).json() == []


def test_admin_delete_each_creation_kind():
    s = requests.post(f"{API}/stories", json={"pet_name": "x", "species": "perro", "theme": "mi_ano"}, headers=NORM, timeout=20).json()
    p = requests.post(f"{API}/portraits", json={"style": "halloween"}, headers=NORM, timeout=20).json()
    v = requests.post(f"{API}/talk", json={}, headers=NORM, timeout=20).json()
    for kind, item in (("story", s), ("portrait", p), ("video", v)):
        assert requests.delete(f"{API}/admin/creations/{kind}/{item['id']}", headers=ADMIN, timeout=20).json() == {"ok": True}
    assert requests.get(f"{API}/stories/{s['id']}", timeout=20).status_code == 404
    assert requests.get(f"{API}/portraits/{p['id']}", timeout=20).status_code == 404
    assert requests.get(f"{API}/talk/{v['id']}", timeout=20).status_code == 404
    assert requests.delete(f"{API}/admin/creations/bogus/x", headers=ADMIN, timeout=20).status_code == 400


# ---------------- payments ----------------
def test_mp_webhook_is_noop_without_mercadopago():
    assert requests.post(f"{API}/payments/webhook/mercadopago?type=payment&data.id=1", json={}, timeout=20).json() == {"received": True}


def test_subscribe_without_mercadopago_is_503(norm_free):
    r = requests.post(f"{API}/plus/subscribe", json={"plan": "monthly", "email": "a@b.cl"}, headers=NORM, timeout=20)
    assert r.status_code == 503 and r.json()["detail"] == "Pagos no disponibles"


def test_admins_have_plus_regular_users_dont():
    norm = me(NORM)
    requests.post(f"{API}/admin/users/{norm['user_id']}/plus", json={"active": False}, headers=ADMIN, timeout=20)
    try:
        assert requests.get(f"{API}/plus/status", headers=NORM, timeout=20).json()["active"] is False
        assert requests.get(f"{API}/plus/status", headers=ADMIN, timeout=20).json()["active"] is True
        row = next(u for u in requests.get(f"{API}/admin/users", headers=ADMIN, timeout=60).json() if u["is_admin"])
        assert row["is_plus"] is True
    finally:
        requests.post(f"{API}/admin/users/{norm['user_id']}/plus", json={"active": True}, headers=ADMIN, timeout=20)
