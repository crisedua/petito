"""Tests for 'El universo de mi mascota' Phase 1 (pet universe endpoints)."""
import io
import os
import time

import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://cuentapatas-demo.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

NORM_TOKEN = "test_session_norm_1"
ADMIN_TOKEN = "test_session_admin_1"
EXISTING_PET_ID = "a8f1f1bb-e5ef-4854-b07e-dc438112bd4a"  # Rocco (user_testnorm1)


def _jpg_bytes(size=(400, 400), color=(180, 120, 60)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@pytest.fixture(scope="session")
def norm_headers():
    return {"Authorization": f"Bearer {NORM_TOKEN}"}


@pytest.fixture(scope="session")
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


# ---------- meta ----------
class TestPetsMeta:
    def test_meta(self):
        r = requests.get(f"{BASE_URL}/api/pets/meta", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "species" in data and "personality_options" in data
        assert len(data["personality_options"]) == 5
        keys = {o["key"] for o in data["personality_options"]}
        assert keys == {"regalon", "terremoto", "dormilon", "aventurero", "travieso"}
        for opt in data["personality_options"]:
            assert "key" in opt and "label" in opt and "emoji" in opt
        sp_keys = {s["key"] for s in data["species"]}
        assert {"perro", "gato", "otro"}.issubset(sp_keys)


# ---------- create pet ----------
class TestCreatePet:
    def test_unauthenticated_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/pets", json={"name": "NoAuth"}, timeout=15)
        assert r.status_code == 401, r.text

    def test_empty_name_400(self, norm_headers):
        r = requests.post(f"{BASE_URL}/api/pets", json={"name": "   "}, headers=norm_headers, timeout=15)
        assert r.status_code == 400, r.text

    def test_create_pet_success(self, norm_headers):
        payload = {
            "name": "TEST_Luna",
            "species": "gato",
            "personality": ["regalon", "travieso", "unknownkey"],
            "personality_text": "Le gusta esconderse",
            "favorite_memory": "Primer día en casa",
        }
        r = requests.post(f"{BASE_URL}/api/pets", json=payload, headers=norm_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Luna"
        assert d["species"] == "gato"
        assert "unknownkey" not in d["personality"]
        assert set(d["personality"]) == {"regalon", "travieso"}
        assert set(d["personality_labels"]) == {"El regalón de la casa", "Travieso pero irresistible"}
        assert "id" in d and "slug" in d
        pytest.created_pet_id = d["id"]


# ---------- photo ----------
class TestPetPhoto:
    def test_upload_photo_as_non_owner_returns_404(self, admin_headers):
        files = {"files": ("photo.jpg", _jpg_bytes(), "image/jpeg")}
        r = requests.post(f"{BASE_URL}/api/pets/{EXISTING_PET_ID}/photo",
                          files=files, headers=admin_headers, timeout=30)
        assert r.status_code == 404, r.text

    def test_upload_photo_owner_success(self, norm_headers):
        pet_id = getattr(pytest, "created_pet_id", None)
        if not pet_id:
            pytest.skip("no created pet")
        files = {"files": ("photo.jpg", _jpg_bytes(), "image/jpeg")}
        r = requests.post(f"{BASE_URL}/api/pets/{pet_id}/photo",
                          files=files, headers=norm_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("photo_url", "").startswith("/api/media/")


# ---------- reveal (uses real Claude; ~10-20s) ----------
class TestPetReveal:
    def test_reveal_requires_photo(self, norm_headers):
        # create a pet without photo
        r = requests.post(f"{BASE_URL}/api/pets",
                          json={"name": "TEST_NoPhoto", "personality": ["dormilon"]},
                          headers=norm_headers, timeout=15)
        assert r.status_code == 200
        pid = r.json()["id"]
        rr = requests.post(f"{BASE_URL}/api/pets/{pid}/reveal", headers=norm_headers, timeout=30)
        assert rr.status_code == 400, rr.text

    def test_reveal_non_owner_404(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/pets/{EXISTING_PET_ID}/reveal",
                          headers=admin_headers, timeout=30)
        assert r.status_code == 404

    def test_reveal_owner_success(self, norm_headers):
        pet_id = getattr(pytest, "created_pet_id", None)
        if not pet_id:
            pytest.skip("no created pet")
        r = requests.post(f"{BASE_URL}/api/pets/{pet_id}/reveal",
                          headers=norm_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "intro_text" in d
        assert isinstance(d["intro_text"], str) and len(d["intro_text"]) > 20
        # verify persisted via GET
        g = requests.get(f"{BASE_URL}/api/pets/{pet_id}", headers={"Authorization": f"Bearer {NORM_TOKEN}"}, timeout=15)
        assert g.status_code == 200
        assert g.json()["intro_text"] == d["intro_text"]


# ---------- list / get / isolation ----------
class TestPetListGet:
    def test_list_pets_only_mine(self, norm_headers, admin_headers):
        r = requests.get(f"{BASE_URL}/api/pets", headers=norm_headers, timeout=15)
        assert r.status_code == 200
        pets = r.json()
        assert isinstance(pets, list) and len(pets) >= 1
        ids = {p["id"] for p in pets}
        assert EXISTING_PET_ID in ids

        ra = requests.get(f"{BASE_URL}/api/pets", headers=admin_headers, timeout=15)
        assert ra.status_code == 200
        admin_ids = {p["id"] for p in ra.json()}
        assert EXISTING_PET_ID not in admin_ids

    def test_get_pet_non_owner_404(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/pets/{EXISTING_PET_ID}", headers=admin_headers, timeout=15)
        assert r.status_code == 404


# ---------- creations ----------
class TestPetCreations:
    def test_creations_shape_empty_or_list(self, norm_headers):
        r = requests.get(f"{BASE_URL}/api/pets/{EXISTING_PET_ID}/creations", headers=norm_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Endpoint returns a flat sorted list of items with kind field
        assert isinstance(d, list)

    def test_creations_non_owner_404(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/pets/{EXISTING_PET_ID}/creations", headers=admin_headers, timeout=15)
        assert r.status_code == 404


# ---------- association: portrait with pet_id (verify via mongo) ----------
def _mongo_portrait(portrait_id):
    from pymongo import MongoClient
    client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "test_database")]
    return db.portraits.find_one({"id": portrait_id}, {"_id": 0, "pet_id": 1, "user_id": 1})


class TestPortraitPetAssociation:
    def test_portrait_with_valid_pet_id_persisted(self, norm_headers):
        payload = {
            "pet_name": "Rocco", "species": "perro", "traits": ["regalón"],
            "style": "renacentista", "pet_id": EXISTING_PET_ID,
        }
        r = requests.post(f"{BASE_URL}/api/portraits", json=payload, headers=norm_headers, timeout=30)
        assert r.status_code == 200, r.text
        portrait_id = r.json()["id"]
        doc = _mongo_portrait(portrait_id)
        assert doc is not None
        assert doc.get("pet_id") == EXISTING_PET_ID

    def test_portrait_with_non_owned_pet_id_ignored(self, norm_headers, admin_headers):
        rp = requests.post(f"{BASE_URL}/api/pets",
                           json={"name": "TEST_AdminPet"}, headers=admin_headers, timeout=15)
        assert rp.status_code == 200
        admin_pet_id = rp.json()["id"]

        payload = {
            "pet_name": "X", "species": "perro", "traits": [],
            "style": "renacentista", "pet_id": admin_pet_id,
        }
        r = requests.post(f"{BASE_URL}/api/portraits", json=payload, headers=norm_headers, timeout=30)
        assert r.status_code == 200, r.text
        portrait_id = r.json()["id"]
        doc = _mongo_portrait(portrait_id)
        assert doc is not None
        assert doc.get("pet_id") in (None, ""), f"pet_id should be ignored, got {doc.get('pet_id')}"
