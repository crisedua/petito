"""Backend auth-flow tests (Jan 2026) - Petito Google-auth integration."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cuentapatas-demo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

NORMAL_TOKEN = "test_session_norm_1"
ADMIN_TOKEN = "test_session_admin_1"
PORTRAIT_ID = "696bde13-d0d5-488b-8848-e0706c2ae79c"
PORTRAIT_SLUG = "39f1974e10"


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# --- /auth/me ---
class TestAuthMe:
    def test_me_without_token_returns_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401, r.text

    def test_me_with_normal_token(self):
        r = requests.get(f"{API}/auth/me", headers=_h(NORMAL_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == "test.petito.norm@example.com"
        assert data.get("is_admin") in (False, None, 0)

    def test_me_with_admin_token(self):
        r = requests.get(f"{API}/auth/me", headers=_h(ADMIN_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == "eduardo@eduescalante.com"
        assert data.get("is_admin") is True


# --- Create endpoints require auth ---
class TestCreateRequiresAuth:
    def test_create_story_without_auth(self):
        r = requests.post(f"{API}/stories", json={"pet_name": "x", "pet_type": "perro"})
        assert r.status_code == 401, r.text

    def test_create_portrait_without_auth(self):
        r = requests.post(f"{API}/portraits", json={"pet_name": "x", "style": "renacentista"})
        assert r.status_code == 401, r.text


# --- Public shared GETs ---
class TestPublicShares:
    def test_portrait_slug_public(self):
        r = requests.get(f"{API}/portraits/slug/{PORTRAIT_SLUG}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["pet_name"] == "Michi"


# --- /me listings ---
class TestMyCreations:
    def test_me_portraits_requires_auth(self):
        r = requests.get(f"{API}/me/portraits")
        assert r.status_code == 401

    def test_me_portraits_lists_michi(self):
        r = requests.get(f"{API}/me/portraits", headers=_h(NORMAL_TOKEN))
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        ids = [p.get("id") for p in items]
        assert PORTRAIT_ID in ids, f"Michi portrait missing in {ids}"

    def test_me_stories_requires_auth(self):
        r = requests.get(f"{API}/me/stories")
        assert r.status_code == 401

    def test_me_stories_authed(self):
        r = requests.get(f"{API}/me/stories", headers=_h(NORMAL_TOKEN))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- Admin allowlist ---
class TestAdminAllowlist:
    def test_admin_metrics_no_auth(self):
        r = requests.get(f"{API}/admin/metrics")
        assert r.status_code in (401, 403)

    def test_admin_metrics_normal_user_forbidden(self):
        r = requests.get(f"{API}/admin/metrics", headers=_h(NORMAL_TOKEN))
        assert r.status_code == 403, r.text

    def test_admin_metrics_admin_ok(self):
        r = requests.get(f"{API}/admin/metrics", headers=_h(ADMIN_TOKEN))
        assert r.status_code == 200, r.text


# --- Logout ---
class TestLogout:
    def test_logout_endpoint_exists(self):
        # Use a disposable token so we don't nuke the shared seeded session
        import pymongo, os as _os
        from datetime import datetime, timedelta, timezone
        client = pymongo.MongoClient(_os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[_os.environ.get("DB_NAME", "test_database")]
        tmp_token = "test_session_logout_tmp"
        db.user_sessions.delete_many({"session_token": tmp_token})
        db.user_sessions.insert_one({
            "user_id": "user_testnorm1",
            "session_token": tmp_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
            "created_at": datetime.now(timezone.utc),
        })
        r = requests.post(f"{API}/auth/logout", headers=_h(tmp_token))
        assert r.status_code in (200, 204), r.text
