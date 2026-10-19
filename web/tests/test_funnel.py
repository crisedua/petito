"""
Funnel analytics and link previews.

  PETITO_URL=http://localhost:3000 pytest web/tests/test_funnel.py

Needs the local setup of test_api.py plus MOCK_AI=1 and the Inngest dev server (the free video
preview has to finish). Counts are checked as "went up by", so other traffic doesn't break them.
"""
import os
import re
import time
import uuid

import requests

BASE = os.environ.get("PETITO_URL", "http://localhost:3000").rstrip("/")
API = f"{BASE}/api"


def H(token=None, device=None):
    h = {"X-Device-Id": device or f"dev-{uuid.uuid4().hex[:8]}"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


ADMIN = H("test_session_admin_1")


def jpeg():
    return bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080002000201011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbfcffd9"
    )


def funnel():
    r = requests.get(f"{API}/admin/funnel", params={"days": 7}, headers=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    return d, {f["feature"]: f for f in d["features"]}


def wait_until(fn, timeout=60):
    end = time.time() + timeout
    while time.time() < end:
        if fn():
            return True
        time.sleep(1.5)
    return False


def test_client_events_are_validated():
    assert requests.post(f"{API}/events", json={"name": "visit"}, headers=H(), timeout=20).status_code == 200
    assert requests.post(f"{API}/events", json={"name": "paid"}, headers=H(), timeout=20).status_code == 400  # server-only
    assert requests.post(f"{API}/events", json={"name": "nope"}, headers=H(), timeout=20).status_code == 400
    assert requests.get(f"{API}/admin/funnel", headers=H("test_session_norm_1"), timeout=20).status_code == 403


def test_anonymous_free_video_funnel():
    before, bf = funnel()
    dev = H(device=f"funnel-{uuid.uuid4().hex[:8]}")
    requests.post(f"{API}/events", json={"name": "visit", "props": {"source": "whatsapp", "path": "/"}}, headers=dev, timeout=20)
    requests.post(f"{API}/events", json={"name": "view_feature", "feature": "video"}, headers=dev, timeout=20)
    start = requests.post(f"{API}/talk/preview/start", json={"pet_name": "Funnel"}, headers=dev, timeout=20).json()
    assert requests.post(f"{API}/talk/preview/{start['id']}", files={"files": ("p.jpg", jpeg(), "image/jpeg")}, headers=dev, timeout=60).status_code == 200
    gen = requests.post(f"{API}/talk/preview/{start['id']}/generate", headers=dev, timeout=20).json()
    assert wait_until(lambda: requests.get(f"{API}/talk/{start['id']}", timeout=20).json()["status"] == "preview_ready", 90)

    def counted():
        d, f = funnel()
        return (d["visitors"] >= before["visitors"] + 1 and f["video"]["opened"] >= bf["video"]["opened"] + 1
                and f["video"]["uploaded"] >= bf["video"]["uploaded"] + 1 and f["video"]["result"] >= bf["video"]["result"] + 1)
    assert wait_until(counted, 20)
    d, _ = funnel()
    assert any(s["source"] == "whatsapp" for s in d["sources"])

    # the shared link now previews the pet's own video frame
    html = requests.get(f"{BASE}/v/{gen['slug']}", timeout=60).text
    assert re.search(r'<meta property="og:title" content="Funnel tiene algo que decirte', html)
    assert re.search(rf'<meta property="og:image" content="https?://[^"]+/api/media/{start["id"]}/source\.jpg"', html)


def events_for(device):
    r = requests.get(f"{API}/admin/events", params={"device": device, "limit": 50}, headers=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def test_signed_in_portrait_paywall_counts_only_real_taps():
    device = f"funnel-{uuid.uuid4().hex[:8]}"
    norm = H("test_session_norm_1", device=device)
    me = requests.get(f"{API}/auth/me", headers=norm, timeout=20).json()
    requests.post(f"{API}/admin/users/{me['user_id']}/plus", json={"active": False}, headers=ADMIN, timeout=20)
    try:
        requests.post(f"{API}/events", json={"name": "login"}, headers=norm, timeout=20)
        p = requests.post(f"{API}/portraits", json={"style": "victoriano"}, headers=norm, timeout=20).json()
        assert requests.post(f"{API}/portraits/{p['id']}/photo", files={"files": ("p.jpg", jpeg(), "image/jpeg")}, headers=norm, timeout=60).status_code == 200
        assert requests.post(f"{API}/portraits/{p['id']}/checkout", json={"auto": True}, headers=norm, timeout=20).json()["mode"] == "plus_required"
        assert requests.post(f"{API}/portraits/{p['id']}/checkout", headers=norm, timeout=20).json()["mode"] == "plus_required"

        def names():
            return sorted((e["name"], e["feature"]) for e in events_for(device))
        assert wait_until(lambda: ("paywall", "portrait") in names(), 20)
        got = names()
        assert ("login", None) in got and ("photo_uploaded", "portrait") in got
        assert got.count(("paywall", "portrait")) == 1  # the silent auto-check didn't count
        assert all(e["user"] == me["email"] for e in events_for(device))  # every step is tied to the account
        f = funnel()[1]["portrait"]
        assert f["uploaded"] >= 1 and f["paywall"] >= 1 and f["signed_in"] >= 1
    finally:
        requests.post(f"{API}/admin/users/{me['user_id']}/plus", json={"active": True}, headers=ADMIN, timeout=20)


def test_site_wide_preview_text():
    html = requests.get(f"{BASE}/", timeout=60).text
    assert 'content="Petito · El universo de tu mascota"' in html
    assert re.search(r'<meta property="og:image" content="https?://[^"]+/og-image\.jpg"', html)
    assert "Tu mascota cuenta su historia" not in html
