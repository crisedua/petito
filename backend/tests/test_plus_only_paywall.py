"""Tests for Petito Plus subscription-only paywall (iteration 19).

Verifies:
- Non-Plus checkout endpoints return {mode: plus_required}
- Plus owner gets {mode: plus, already_paid: True}
- pay-demo endpoints are removed (404)
- /api/plus/subscribe returns a real MP init_point
- Free user cannot create a 2nd pet (403)
"""
import os
import datetime as dt
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cuentapatas-demo.preview.emergentagent.com").rstrip("/")
TOKEN = "test_session_norm_1"
USER_ID = "user_testnorm1"
PORTRAIT_ID = "696bde13-d0d5-488b-8848-e0706c2ae79c"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture
def ensure_no_plus(db):
    """Guarantee user is not Plus before and after each test."""
    db.subscriptions.delete_many({"user_id": USER_ID})
    yield
    db.subscriptions.delete_many({"user_id": USER_ID})


@pytest.fixture
def test_story(db):
    """Create a transient preview_ready story owned by test user."""
    sid = "TEST_story_plus_paywall_1"
    db.stories.delete_one({"id": sid})
    db.stories.insert_one({
        "id": sid,
        "user_id": USER_ID,
        "status": "preview_ready",
        "pet_name": "Rocco",
        "species": "perro",
        "theme": "aventura",
        "share_slug": "test_story_sl1",
        "created_at": dt.datetime.utcnow().isoformat() + "Z",
    })
    yield sid
    db.stories.delete_one({"id": sid})
    db.slides.delete_many({"story_id": sid})


@pytest.fixture
def test_talk(db):
    """Create a transient preview_ready talking video owned by test user."""
    vid = "TEST_talk_plus_paywall_1"
    db.videos.delete_one({"id": vid})
    db.videos.insert_one({
        "id": vid,
        "user_id": USER_ID,
        "status": "preview_ready",
        "share_slug": "test_talk_sl1",
        "created_at": dt.datetime.utcnow().isoformat() + "Z",
    })
    yield vid
    db.videos.delete_one({"id": vid})


# ------------------------- non-Plus returns plus_required -------------------------

class TestNonPlusPaywall:
    def test_portrait_checkout_non_plus(self, ensure_no_plus):
        r = requests.post(f"{BASE_URL}/api/portraits/{PORTRAIT_ID}/checkout", headers=HEADERS)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("mode") == "plus_required"
        assert "checkout_url" not in data

    def test_story_checkout_non_plus(self, ensure_no_plus, test_story):
        r = requests.post(f"{BASE_URL}/api/stories/{test_story}/checkout", headers=HEADERS)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("mode") == "plus_required"
        assert "checkout_url" not in data

    def test_talk_checkout_non_plus(self, ensure_no_plus, test_talk):
        r = requests.post(f"{BASE_URL}/api/talk/{test_talk}/checkout", headers=HEADERS)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("mode") == "plus_required"
        assert "checkout_url" not in data


# ------------------------- pay-demo removed (404) -------------------------

class TestPayDemoRemoved:
    def test_portrait_pay_demo_404(self):
        r = requests.post(f"{BASE_URL}/api/portraits/{PORTRAIT_ID}/pay-demo", headers=HEADERS)
        assert r.status_code == 404

    def test_story_pay_demo_404(self):
        r = requests.post(f"{BASE_URL}/api/stories/any-id/pay-demo", headers=HEADERS)
        assert r.status_code == 404

    def test_talk_pay_demo_404(self):
        r = requests.post(f"{BASE_URL}/api/talk/any-id/pay-demo", headers=HEADERS)
        assert r.status_code == 404


# ------------------------- Plus owner unlocks everything -------------------------

class TestPlusOwner:
    def test_portrait_checkout_as_plus(self, db):
        # seed Plus
        db.subscriptions.delete_many({"user_id": USER_ID})
        plus_until = (dt.datetime.utcnow() + dt.timedelta(days=30)).isoformat() + "Z"
        db.subscriptions.insert_one({
            "mp_id": "qa-plus-1",
            "user_id": USER_ID,
            "plan": "monthly",
            "status": "authorized",
            "membership_active": True,
            "plus_until": plus_until,
            "created_at": dt.datetime.utcnow().isoformat() + "Z",
        })
        try:
            r = requests.post(f"{BASE_URL}/api/portraits/{PORTRAIT_ID}/checkout", headers=HEADERS)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("mode") == "plus"
            assert data.get("already_paid") is True

            # Verify portrait is now paid and clean_url exposed
            g = requests.get(f"{BASE_URL}/api/portraits/{PORTRAIT_ID}", headers=HEADERS)
            assert g.status_code == 200, g.text
            portrait = g.json()
            assert portrait.get("paid") is True or portrait.get("status") == "paid"
            assert portrait.get("clean_url"), f"Expected clean_url in {portrait}"
        finally:
            # cleanup: remove sub + reset portrait to preview_ready
            db.subscriptions.delete_many({"user_id": USER_ID})
            db.portraits.update_one(
                {"id": PORTRAIT_ID},
                {"$set": {"status": "preview_ready"}, "$unset": {"paid_at": ""}},
            )


# ------------------------- /api/plus/subscribe + /api/plus/status -------------------------

class TestPlusSubscribe:
    def test_plus_status_prices(self, ensure_no_plus):
        r = requests.get(f"{BASE_URL}/api/plus/status", headers=HEADERS)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["monthly_clp"] == 3900
        assert data["annual_clp"] == 29900
        assert data["free_mode"] is False

    def test_subscribe_monthly(self, ensure_no_plus, db):
        r = requests.post(f"{BASE_URL}/api/plus/subscribe", headers=HEADERS,
                          json={"plan": "monthly"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "mercadopago.cl/subscriptions/checkout" in data.get("init_point", ""), data
        assert data.get("mp_id")
        # cleanup
        db.subscriptions.delete_many({"user_id": USER_ID})

    def test_subscribe_annual(self, ensure_no_plus, db):
        r = requests.post(f"{BASE_URL}/api/plus/subscribe", headers=HEADERS,
                          json={"plan": "annual"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "mercadopago.cl/subscriptions/checkout" in data.get("init_point", ""), data
        assert data.get("mp_id")
        db.subscriptions.delete_many({"user_id": USER_ID})


# ------------------------- Free pet limit still enforced -------------------------

class TestPetLimit:
    def test_second_pet_blocked_for_free_user(self, ensure_no_plus, db):
        # user_testnorm1 already owns pet Rocco; attempt second
        r = requests.post(f"{BASE_URL}/api/pets", headers=HEADERS,
                          json={"name": "TEST_SecondPet"})
        assert r.status_code in (402, 403), f"Expected 402/403 for 2nd pet, got {r.status_code}: {r.text}"
        # Safety cleanup in case it slipped through
        db.pets.delete_many({"user_id": USER_ID, "name": "TEST_SecondPet"})
