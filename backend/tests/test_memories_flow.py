"""Backend tests for the 'Nuestra historia' (memories) feature."""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
NORM_TOKEN = "test_session_norm_1"
ADMIN_TOKEN = "test_session_admin_1"
ROCCO_PET_ID = "a8f1f1bb-e5ef-4854-b07e-dc438112bd4a"

H_NORM = {"Authorization": f"Bearer {NORM_TOKEN}"}
H_ADMIN = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


# ---- small reusable fake jpeg ----
def _tiny_jpeg_bytes() -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (200, 180, 160)).save(buf, format="JPEG", quality=70)
    return buf.getvalue()


# -------- meta --------
def test_memories_meta_returns_8_emotions():
    r = requests.get(f"{BASE_URL}/api/memories/meta", timeout=15)
    assert r.status_code == 200
    data = r.json()
    keys = [e["key"] for e in data["emotions"]]
    assert keys == ["ternura", "risa", "alegria", "orgullo", "nostalgia", "amor", "calma", "gratitud"]
    for e in data["emotions"]:
        assert "label" in e and "emoji" in e


# -------- create --------
def test_create_memory_requires_title():
    r = requests.post(f"{BASE_URL}/api/pets/{ROCCO_PET_ID}/memories",
                      json={"title": "   "}, headers=H_NORM, timeout=15)
    assert r.status_code == 400


def test_create_memory_non_owner_404():
    r = requests.post(f"{BASE_URL}/api/pets/{ROCCO_PET_ID}/memories",
                      json={"title": "intento"}, headers=H_ADMIN, timeout=15)
    assert r.status_code == 404


def test_create_memory_requires_auth():
    r = requests.post(f"{BASE_URL}/api/pets/{ROCCO_PET_ID}/memories",
                      json={"title": "x"}, timeout=15)
    assert r.status_code in (401, 403)


@pytest.fixture(scope="module")
def created_memory_id():
    payload = {
        "title": "TEST_pytest_paseo",
        "happened_on": "2024-05",
        "date_unknown": False,
        "feeling_text": "Rocco corrió feliz por la playa, no quería volver.",
        "emotions": ["alegria", "risa", "invalid_key"],
    }
    r = requests.post(f"{BASE_URL}/api/pets/{ROCCO_PET_ID}/memories",
                      json=payload, headers=H_NORM, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["title"] == payload["title"]
    assert data["pet_id"] == ROCCO_PET_ID
    assert data["happened_on"] == "2024-05"
    assert data["feeling_text"].startswith("Rocco")
    assert set(data["emotions"]) == {"alegria", "risa"}  # invalid filtered
    labels = {el["key"]: el["label"] for el in data["emotion_labels"]}
    assert labels["alegria"] == "Alegría"
    assert labels["risa"] == "Risa"
    assert data["ai_reflection"] is None
    yield data["id"]
    # cleanup
    requests.delete(f"{BASE_URL}/api/memories/{data['id']}", headers=H_NORM, timeout=15)


def test_list_memories_contains_created_and_newest_first(created_memory_id):
    r = requests.get(f"{BASE_URL}/api/pets/{ROCCO_PET_ID}/memories", headers=H_NORM, timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list) and len(arr) >= 1
    ids = [m["id"] for m in arr]
    assert created_memory_id in ids
    # newest-first by created_at desc
    created_ats = [m["created_at"] for m in arr]
    assert created_ats == sorted(created_ats, reverse=True)


def test_list_memories_non_owner_404():
    r = requests.get(f"{BASE_URL}/api/pets/{ROCCO_PET_ID}/memories", headers=H_ADMIN, timeout=15)
    assert r.status_code == 404


def test_get_memory_owner_only(created_memory_id):
    r = requests.get(f"{BASE_URL}/api/memories/{created_memory_id}", headers=H_NORM, timeout=15)
    assert r.status_code == 200
    assert r.json()["id"] == created_memory_id
    r2 = requests.get(f"{BASE_URL}/api/memories/{created_memory_id}", headers=H_ADMIN, timeout=15)
    assert r2.status_code == 404


# -------- photo --------
def test_upload_memory_photo_owner_and_non_owner(created_memory_id):
    files = {"files": ("test.jpg", _tiny_jpeg_bytes(), "image/jpeg")}
    r = requests.post(f"{BASE_URL}/api/memories/{created_memory_id}/photo",
                      files=files, headers=H_NORM, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["photo_url"].startswith(f"/api/media/{created_memory_id}/")

    # verify persistence via GET
    r_get = requests.get(f"{BASE_URL}/api/memories/{created_memory_id}", headers=H_NORM, timeout=15)
    assert r_get.json()["photo_url"] is not None

    # non-owner
    files2 = {"files": ("x.jpg", _tiny_jpeg_bytes(), "image/jpeg")}
    r2 = requests.post(f"{BASE_URL}/api/memories/{created_memory_id}/photo",
                       files=files2, headers=H_ADMIN, timeout=30)
    assert r2.status_code == 404


# -------- update --------
def test_update_memory_persists_and_rejects_empty_title(created_memory_id):
    r = requests.put(f"{BASE_URL}/api/memories/{created_memory_id}",
                     json={"title": "TEST_updated", "feeling_text": "Nuevo sentir",
                           "emotions": ["ternura"]},
                     headers=H_NORM, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "TEST_updated"
    assert data["feeling_text"] == "Nuevo sentir"
    assert data["emotions"] == ["ternura"]
    assert data["updated_at"] is not None

    # empty title -> 400
    r_bad = requests.put(f"{BASE_URL}/api/memories/{created_memory_id}",
                         json={"title": "   "}, headers=H_NORM, timeout=15)
    assert r_bad.status_code == 400

    # non-owner -> 404
    r3 = requests.put(f"{BASE_URL}/api/memories/{created_memory_id}",
                      json={"title": "hack"}, headers=H_ADMIN, timeout=15)
    assert r3.status_code == 404


# -------- reflect (real Claude, slow) --------
def test_reflect_memory_generates_and_persists(created_memory_id):
    r = requests.post(f"{BASE_URL}/api/memories/{created_memory_id}/reflect",
                      headers=H_NORM, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    reflection = data["ai_reflection"]
    assert isinstance(reflection, str) and len(reflection) > 10

    # persistence check
    g = requests.get(f"{BASE_URL}/api/memories/{created_memory_id}", headers=H_NORM, timeout=15)
    assert g.json()["ai_reflection"] == reflection


def test_reflect_non_owner_404(created_memory_id):
    r = requests.post(f"{BASE_URL}/api/memories/{created_memory_id}/reflect",
                      headers=H_ADMIN, timeout=15)
    assert r.status_code == 404


def test_hide_reflection_clears_it(created_memory_id):
    # ensure present (set by previous test); if not, call reflect first (quick fallback - skipped)
    r = requests.post(f"{BASE_URL}/api/memories/{created_memory_id}/reflect/hide",
                     headers=H_NORM, timeout=15)
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/memories/{created_memory_id}", headers=H_NORM, timeout=15)
    assert g.json()["ai_reflection"] is None


# -------- delete --------
def test_delete_memory_non_owner_404():
    # create a disposable memory then try delete via admin
    r = requests.post(f"{BASE_URL}/api/pets/{ROCCO_PET_ID}/memories",
                      json={"title": "TEST_toDeleteNonOwner"},
                      headers=H_NORM, timeout=15)
    mid = r.json()["id"]
    r2 = requests.delete(f"{BASE_URL}/api/memories/{mid}", headers=H_ADMIN, timeout=15)
    assert r2.status_code == 404
    # cleanup
    requests.delete(f"{BASE_URL}/api/memories/{mid}", headers=H_NORM, timeout=15)


def test_delete_memory_removes_it():
    r = requests.post(f"{BASE_URL}/api/pets/{ROCCO_PET_ID}/memories",
                      json={"title": "TEST_toDelete"}, headers=H_NORM, timeout=15)
    mid = r.json()["id"]
    r2 = requests.delete(f"{BASE_URL}/api/memories/{mid}", headers=H_NORM, timeout=15)
    assert r2.status_code == 200
    r3 = requests.get(f"{BASE_URL}/api/memories/{mid}", headers=H_NORM, timeout=15)
    assert r3.status_code == 404
