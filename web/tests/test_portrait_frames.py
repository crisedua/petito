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
    assert requests.get(f"{API}/portraits/samples", timeout=20).json()["bruja"] == cand["url"]
    assert requests.put(f"{API}/admin/style-samples", json={"style": "bruja", "name": "nope.jpg"}, headers=ADMIN, timeout=20).status_code == 400
    assert requests.put(f"{API}/admin/style-samples", json={"style": "bruja", "name": None}, headers=ADMIN, timeout=20).status_code == 200
    assert "bruja" not in requests.get(f"{API}/portraits/samples", timeout=20).json()
    assert requests.post(f"{API}/admin/style-samples", json={"style": "nope"}, headers=ADMIN, timeout=20).status_code == 400
