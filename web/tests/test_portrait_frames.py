"""
Portrait frames and admin-managed style samples.

  PETITO_URL=http://localhost:3000 pytest web/tests/test_portrait_frames.py

Same setup as test_api.py, plus MOCK_AI=1 (sample generation runs the mock image edit).
"""
import os
import time
import uuid

import requests

BASE = os.environ.get("PETITO_URL", "http://localhost:3000").rstrip("/")
API = f"{BASE}/api"


def H(token=None):
    h = {"X-Device-Id": f"dev-{uuid.uuid4().hex[:8]}"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


ADMIN, NORM = H("test_session_admin_1"), H("test_session_norm_1")


def jpeg():
    return bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080002000201011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbfcffd9"
    )


def test_config_lists_frames_and_style_defaults():
    cfg = requests.get(f"{API}/config", timeout=20).json()
    keys = [f["key"] for f in cfg["portrait_frames"]]
    assert keys == ["dorado", "madera", "negro_gotico", "plata", "sin_marco"]
    defaults = {s["key"]: s["default_frame"] for s in cfg["portrait_styles"]}
    assert defaults["renacentista"] == "dorado" and defaults["vampiro"] == "negro_gotico"


def test_portrait_keeps_the_chosen_frame_and_generates():
    p = requests.post(f"{API}/portraits", json={"style": "vampiro", "frame": "plata", "pet_name": "Rocco"}, headers=NORM, timeout=20).json()
    assert requests.post(f"{API}/portraits/{p['id']}/photo", files={"files": ("p.jpg", jpeg(), "image/jpeg")}, headers=NORM, timeout=60).status_code == 200
    assert requests.post(f"{API}/portraits/{p['id']}/generate", headers=NORM, timeout=20).status_code == 200
    for _ in range(60):
        st = requests.get(f"{API}/portraits/{p['id']}", headers=NORM, timeout=20).json()["status"]
        if st in ("preview_ready", "paid", "failed"):
            break
        time.sleep(1.5)
    assert st in ("preview_ready", "paid")
    bad = requests.post(f"{API}/portraits", json={"style": "vampiro", "frame": "neon"}, headers=NORM, timeout=20)
    assert bad.status_code == 200  # unknown frame falls back to the style's default


def test_admin_samples_generate_choose_and_reset():
    assert requests.get(f"{API}/admin/style-samples", headers=NORM, timeout=20).status_code == 403
    assert requests.post(f"{API}/admin/style-samples", json={"style": "bruja"}, headers=NORM, timeout=20).status_code == 403
    r = requests.post(f"{API}/admin/style-samples", json={"style": "bruja", "frame": "negro_gotico"}, headers=ADMIN, timeout=90)
    assert r.status_code == 200, r.text
    cand = r.json()
    assert cand["frame"] == "negro_gotico"
    img = requests.get(f"{BASE}{cand['url']}", timeout=20)
    assert img.status_code == 200 and img.headers["content-type"].startswith("image/")
    row = next(s for s in requests.get(f"{API}/admin/style-samples", headers=ADMIN, timeout=20).json()["styles"] if s["key"] == "bruja")
    assert any(c["name"] == cand["name"] for c in row["candidates"])

    assert requests.put(f"{API}/admin/style-samples", json={"style": "bruja", "name": cand["name"]}, headers=ADMIN, timeout=20).status_code == 200
    samples = requests.get(f"{API}/portraits/samples", timeout=20).json()["bruja"]
    assert samples["default"] == cand["url"] and samples["frames"]["negro_gotico"] == cand["url"]
    assert requests.put(f"{API}/admin/style-samples", json={"style": "bruja", "name": "nope.jpg"}, headers=ADMIN, timeout=20).status_code == 400
    assert requests.put(f"{API}/admin/style-samples", json={"style": "bruja", "name": None}, headers=ADMIN, timeout=20).status_code == 200
    after = requests.get(f"{API}/portraits/samples", timeout=20).json()["bruja"]
    assert after["default"] is None and after["frames"]["negro_gotico"] == cand["url"]  # per-frame sample stays
    assert requests.post(f"{API}/admin/style-samples", json={"style": "nope"}, headers=ADMIN, timeout=20).status_code == 400


def test_first_sample_for_a_frame_is_shown_right_away():
    r = requests.post(f"{API}/admin/style-samples", json={"style": "calabazas", "frame": "plata"}, headers=ADMIN, timeout=90).json()
    row = next(s for s in requests.get(f"{API}/admin/style-samples", headers=ADMIN, timeout=20).json()["styles"] if s["key"] == "calabazas")
    assert row["by_frame"].get("plata")  # some sample is now shown for calabazas + plata
    assert "plata" in requests.get(f"{API}/portraits/samples", timeout=20).json()["calabazas"]["frames"]


def _portrait_for(h):
    p = requests.post(f"{API}/portraits", json={"style": "renacentista", "pet_id": ROCCO}, headers=h, timeout=20).json()
    requests.post(f"{API}/portraits/{p['id']}/photo", files={"files": ("p.jpg", jpeg(), "image/jpeg")}, headers=h, timeout=60)
    requests.post(f"{API}/portraits/{p['id']}/generate", headers=h, timeout=20)
    for _ in range(60):
        if requests.get(f"{API}/portraits/{p['id']}", headers=h, timeout=20).json()["status"] in ("preview_ready", "paid"):
            break
        time.sleep(1.5)
    return p["id"]


ROCCO = "a8f1f1bb-e5ef-4854-b07e-dc438112bd4a"


def test_plus_owner_sees_clean_thumbnails_free_owner_sees_watermark():
    me = requests.get(f"{API}/auth/me", headers=NORM, timeout=20).json()
    pid = _portrait_for(NORM)  # norm user has Plus (courtesy) in the test setup

    def thumbs():
        col = {c["id"]: c["thumb_url"] for c in requests.get(f"{API}/pets/{ROCCO}/creations", headers=NORM, timeout=20).json()}
        mine = {c["id"]: c for c in requests.get(f"{API}/me/portraits", headers=NORM, timeout=20).json()}
        return col[pid], mine[pid]

    col, mine = thumbs()
    assert "/clean_" in col and "/clean_" in mine["thumb_url"] and mine["paid"] is True
    requests.post(f"{API}/admin/users/{me['user_id']}/plus", json={"active": False}, headers=ADMIN, timeout=20)
    try:
        col, mine = thumbs()
        assert col.endswith("/preview.jpg") and mine["thumb_url"].endswith("/preview.jpg") and mine["paid"] is False
    finally:
        requests.post(f"{API}/admin/users/{me['user_id']}/plus", json={"active": True}, headers=ADMIN, timeout=20)


def _finish(h, pid):
    for _ in range(60):
        d = requests.get(f"{API}/portraits/{pid}", headers=h, timeout=20).json()
        if d["status"] in ("preview_ready", "paid", "failed"):
            return d
        time.sleep(1.5)
    return d


def test_photo_styles_render_without_ai_and_keep_the_original():
    cfg = requests.get(f"{API}/config", timeout=20).json()
    by = {s["key"]: s for s in cfg["portrait_styles"]}
    assert by["polaroid"]["mode"] == "render" and by["polaroid"]["group"] == "foto" and by["polaroid"]["has_frame"] is False
    assert by["estudio"]["mode"] == "edit" and by["renacentista"]["mode"] == "paint" and by["renacentista"]["has_frame"] is True
    assert [s["group"] for s in cfg["portrait_styles"]][:6] == ["foto"] * 6  # photo styles come first
    for style in ("polaroid", "revista", "antigua", "estudio"):
        p = requests.post(f"{API}/portraits", json={"style": style, "pet_name": "Rocco"}, headers=NORM, timeout=20).json()
        requests.post(f"{API}/portraits/{p['id']}/photo", files={"files": ("p.jpg", jpeg(), "image/jpeg")}, headers=NORM, timeout=60)
        requests.post(f"{API}/portraits/{p['id']}/generate", headers=NORM, timeout=20)
        d = _finish(NORM, p["id"])
        assert d["status"] in ("preview_ready", "paid"), (style, d.get("error"))
        assert d["photo_url"] and d["mode"] == by[style]["mode"]
        img = requests.get(f"{BASE}{d['preview_url']}", timeout=20)
        assert img.status_code == 200 and img.headers["content-type"].startswith("image/")
    for s in ("polaroid", "revista", "antigua"):
        assert requests.get(f"{BASE}/portrait-styles/{s}.jpg", timeout=20).status_code == 200


def test_dedicated_video_message():
    v = requests.post(f"{API}/talk", json={"pet_name": "Rocco", "scenario": "cumpleanos", "to_name": "Abuela Rosa", "pet_id": ROCCO}, headers=NORM, timeout=20).json()
    requests.post(f"{API}/talk/{v['id']}/photo", files={"files": ("p.jpg", jpeg(), "image/jpeg")}, headers=NORM, timeout=60)
    requests.post(f"{API}/talk/{v['id']}/generate", headers=NORM, timeout=20)
    for _ in range(60):
        d = requests.get(f"{API}/talk/{v['id']}", headers=NORM, timeout=20).json()
        if d["status"] in ("preview_ready", "paid", "failed"):
            break
        time.sleep(1.5)
    assert d["status"] in ("preview_ready", "paid"), d.get("error")
    assert d["to_name"] == "Abuela Rosa"
    html = requests.get(f"{BASE}/v/{v['slug']}", timeout=60).text
    assert 'content="Rocco tiene un mensaje para Abuela Rosa' in html


def test_song_videos_are_plus_only_and_generate():
    me = requests.get(f"{API}/auth/me", headers=NORM, timeout=20).json()
    requests.post(f"{API}/admin/users/{me['user_id']}/plus", json={"active": False}, headers=ADMIN, timeout=20)
    try:
        r = requests.post(f"{API}/talk", json={"pet_name": "Rocco", "kind": "song", "song_style": "cumbia"}, headers=NORM, timeout=20)
        assert r.status_code == 402
    finally:
        requests.post(f"{API}/admin/users/{me['user_id']}/plus", json={"active": True}, headers=ADMIN, timeout=20)
    cfg = requests.get(f"{API}/config", timeout=20).json()
    assert [s["key"] for s in cfg["song_styles"]] == ["cumbia", "balada", "pop", "reggaeton", "cueca"]
    v = requests.post(f"{API}/talk", json={"pet_name": "Rocco", "kind": "song", "song_style": "cumbia", "to_name": "mamá", "pet_id": ROCCO}, headers=NORM, timeout=20).json()
    requests.post(f"{API}/talk/{v['id']}/photo", files={"files": ("p.jpg", jpeg(), "image/jpeg")}, headers=NORM, timeout=60)
    requests.post(f"{API}/talk/{v['id']}/generate", headers=NORM, timeout=20)
    for _ in range(80):
        d = requests.get(f"{API}/talk/{v['id']}", headers=NORM, timeout=20).json()
        if d["status"] in ("preview_ready", "paid", "failed"):
            break
        time.sleep(1.5)
    assert d["status"] in ("preview_ready", "paid"), d.get("error")
    assert d["song"] is True and d["song_style"] == "cumbia" and d["line"] and "\n" in d["line"]
    html = requests.get(f"{BASE}/v/{v['slug']}", timeout=60).text
    assert 'content="Rocco le canta a mamá' in html


def test_motion_videos_are_plus_only_and_generate_clean():
    me = requests.get(f"{API}/auth/me", headers=NORM, timeout=20).json()
    requests.post(f"{API}/admin/users/{me['user_id']}/plus", json={"active": False}, headers=ADMIN, timeout=20)
    try:
        assert requests.post(f"{API}/talk", json={"pet_name": "Rocco", "kind": "motion", "scene": "playa"}, headers=NORM, timeout=20).status_code == 402
    finally:
        requests.post(f"{API}/admin/users/{me['user_id']}/plus", json={"active": True}, headers=ADMIN, timeout=20)
    assert [s["key"] for s in requests.get(f"{API}/config", timeout=20).json()["motion_scenes"]] == ["baile", "playa", "regalo", "nieve", "superheroe"]
    v = requests.post(f"{API}/talk", json={"pet_name": "Rocco", "kind": "motion", "scene": "playa", "pet_id": ROCCO}, headers=NORM, timeout=20).json()
    requests.post(f"{API}/talk/{v['id']}/photo", files={"files": ("p.jpg", jpeg(), "image/jpeg")}, headers=NORM, timeout=60)
    requests.post(f"{API}/talk/{v['id']}/generate", headers=NORM, timeout=20)
    for _ in range(80):
        d = requests.get(f"{API}/talk/{v['id']}", headers=NORM, timeout=20).json()
        if d["status"] in ("preview_ready", "paid", "failed"):
            break
        time.sleep(1.5)
    assert d["status"] == "paid", d.get("error")  # Plus-only: delivered clean, no watermark step
    assert d["motion"] is True and d["scene"] == "playa" and d["clean_url"] and d["clean_ready"]
    assert requests.get(f"{BASE}{d['clean_url']}", timeout=20).headers["content-type"].startswith("video/")
    html = requests.get(f"{BASE}/v/{v['slug']}", timeout=60).text
    assert 'content="Rocco en acción' in html
