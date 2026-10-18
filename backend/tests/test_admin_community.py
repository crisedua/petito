"""Admin community management endpoints — users, courtesy Plus, cascade deletes, creations.
Creates throwaway docs for destructive tests; cleans up afterwards. Does NOT touch real fixtures
(Rocco pet a8f1f1bb-e5ef-4854-b07e-dc438112bd4a, user_testnorm1, user_testadmin1).
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cuentapatas-demo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_TOKEN = "test_session_admin_1"
NORM_TOKEN = "test_session_norm_1"
ADMIN_UID = "user_testadmin1"
NORM_UID = "user_testnorm1"


def h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --------------- authz: non-admin -> 403 on every admin endpoint ---------------
NON_ADMIN_ENDPOINTS = [
    ("GET", "/admin/users"),
    ("GET", "/admin/users/user_testadmin1"),
    ("POST", "/admin/users/user_testadmin1/plus"),
    ("DELETE", "/admin/pets/does-not-matter"),
    ("DELETE", "/admin/users/does-not-matter"),
    ("DELETE", "/admin/creations/story/does-not-matter"),
    ("GET", "/admin/creations"),
]


@pytest.mark.parametrize("method,path", NON_ADMIN_ENDPOINTS)
def test_non_admin_forbidden(method, path):
    r = requests.request(method, API + path, headers=h(NORM_TOKEN),
                         json={} if method in ("POST", "PUT") else None, timeout=15)
    assert r.status_code == 403, f"{method} {path} expected 403, got {r.status_code}: {r.text[:200]}"


# --------------- users list / search / counts ---------------
def test_admin_users_list_counts_and_fields():
    r = requests.get(f"{API}/admin/users", headers=h(ADMIN_TOKEN), timeout=20)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list) and len(users) >= 2
    emails = {u["email"] for u in users}
    assert "eduardo@eduescalante.com" in emails
    assert "test.petito.norm@example.com" in emails
    for u in users:
        for k in ("user_id", "email", "is_plus", "pet_count", "creation_count", "is_admin"):
            assert k in u, f"missing {k} in {u}"
        assert isinstance(u["is_plus"], bool)
        assert isinstance(u["pet_count"], int)
        assert isinstance(u["creation_count"], int)


def test_admin_users_search_q_filter():
    r = requests.get(f"{API}/admin/users", headers=h(ADMIN_TOKEN), params={"q": "eduardo"}, timeout=20)
    assert r.status_code == 200
    users = r.json()
    assert len(users) >= 1
    assert all("eduardo" in (u.get("email", "") or "").lower() or "eduardo" in (u.get("name", "") or "").lower()
               for u in users)

    r2 = requests.get(f"{API}/admin/users", headers=h(ADMIN_TOKEN), params={"q": "zzz-no-match-xyz"}, timeout=20)
    assert r2.status_code == 200
    assert r2.json() == []


def test_admin_user_detail_real_fixture():
    r = requests.get(f"{API}/admin/users/{NORM_UID}", headers=h(ADMIN_TOKEN), timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["user_id"] == NORM_UID
    assert d["email"] == "test.petito.norm@example.com"
    assert isinstance(d.get("pets"), list)
    assert isinstance(d.get("creations"), list)
    # Rocco pet should be present
    pet_ids = [p["id"] for p in d["pets"]]
    assert "a8f1f1bb-e5ef-4854-b07e-dc438112bd4a" in pet_ids


def test_admin_user_detail_404():
    r = requests.get(f"{API}/admin/users/user_does_not_exist_xyz", headers=h(ADMIN_TOKEN), timeout=15)
    assert r.status_code == 404


# --------------- courtesy Plus on/off ---------------
def test_admin_courtesy_plus_toggle_on_norm_user():
    # Activate
    r = requests.post(f"{API}/admin/users/{NORM_UID}/plus", headers=h(ADMIN_TOKEN),
                      json={"active": True}, timeout=15)
    assert r.status_code == 200
    assert r.json()["is_plus"] is True

    # Verify via user detail
    d = requests.get(f"{API}/admin/users/{NORM_UID}", headers=h(ADMIN_TOKEN), timeout=15).json()
    assert d["is_plus"] is True

    # Verify via /plus/status (as the user)
    s = requests.get(f"{API}/plus/status", headers=h(NORM_TOKEN), timeout=15)
    assert s.status_code == 200
    assert s.json().get("active") is True

    # Deactivate
    r2 = requests.post(f"{API}/admin/users/{NORM_UID}/plus", headers=h(ADMIN_TOKEN),
                      json={"active": False}, timeout=15)
    assert r2.status_code == 200
    assert r2.json()["is_plus"] is False

    s2 = requests.get(f"{API}/plus/status", headers=h(NORM_TOKEN), timeout=15).json()
    assert s2.get("active") is False


def test_admin_set_plus_404_for_missing_user():
    r = requests.post(f"{API}/admin/users/no_such_user_zzz/plus", headers=h(ADMIN_TOKEN),
                      json={"active": True}, timeout=15)
    assert r.status_code == 404


# --------------- creations list ---------------
def test_admin_creations_list():
    r = requests.get(f"{API}/admin/creations", headers=h(ADMIN_TOKEN), timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) >= 1
    kinds = {i["kind"] for i in items}
    assert kinds.issubset({"story", "portrait", "video"})
    for i in items:
        assert "id" in i and "view_path" in i


# --------------- invalid/missing deletes ---------------
def test_admin_delete_pet_404():
    r = requests.delete(f"{API}/admin/pets/nonexistent-pet-id", headers=h(ADMIN_TOKEN), timeout=15)
    assert r.status_code == 404


def test_admin_delete_user_404():
    r = requests.delete(f"{API}/admin/users/nonexistent-user-xyz", headers=h(ADMIN_TOKEN), timeout=15)
    assert r.status_code == 404


def test_admin_delete_creation_invalid_kind_400():
    r = requests.delete(f"{API}/admin/creations/badkind/some-id", headers=h(ADMIN_TOKEN), timeout=15)
    assert r.status_code == 400


def test_admin_delete_creation_404():
    for kind in ("story", "portrait", "video"):
        r = requests.delete(f"{API}/admin/creations/{kind}/nonexistent-id-{kind}",
                            headers=h(ADMIN_TOKEN), timeout=15)
        assert r.status_code == 404, f"{kind} expected 404"


# --------------- cascade deletes: THROWAWAY DOCS ---------------
# We insert docs directly via mongo (motor) in a fixture, then test deletes.

@pytest.fixture(scope="module")
def mongo_db():
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = MongoClient(mongo_url)
    yield client[db_name]
    client.close()


def _iso():
    return datetime.now(timezone.utc).isoformat()


def test_cascade_delete_pet_removes_memories_and_creations(mongo_db):
    uid = f"user_qa_del_pet_{uuid.uuid4().hex[:8]}"
    pet_id = f"petqa-{uuid.uuid4().hex[:8]}"
    story_id = f"storyqa-{uuid.uuid4().hex[:8]}"
    portrait_id = f"portqa-{uuid.uuid4().hex[:8]}"
    video_id = f"vidqa-{uuid.uuid4().hex[:8]}"
    memory_id = f"memqa-{uuid.uuid4().hex[:8]}"

    mongo_db.users.insert_one({"user_id": uid, "email": f"qa_del_pet_{uid}@test.local", "name": "QA Pet Del"})
    mongo_db.pets.insert_one({"id": pet_id, "user_id": uid, "name": "QaPet", "species": "dog", "created_at": _iso()})
    mongo_db.memories.insert_one({"id": memory_id, "pet_id": pet_id, "user_id": uid, "title": "qa mem",
                                  "created_at": _iso()})
    mongo_db.stories.insert_one({"id": story_id, "user_id": uid, "pet_id": pet_id, "status": "paid",
                                 "pet_name": "QaPet", "created_at": _iso()})
    mongo_db.portraits.insert_one({"id": portrait_id, "user_id": uid, "pet_id": pet_id, "status": "paid",
                                   "created_at": _iso()})
    mongo_db.videos.insert_one({"id": video_id, "user_id": uid, "pet_id": pet_id, "status": "paid",
                                "created_at": _iso()})

    try:
        r = requests.delete(f"{API}/admin/pets/{pet_id}", headers=h(ADMIN_TOKEN), timeout=20)
        assert r.status_code == 200
        assert mongo_db.pets.find_one({"id": pet_id}) is None
        assert mongo_db.memories.find_one({"id": memory_id}) is None
        assert mongo_db.stories.find_one({"id": story_id}) is None
        assert mongo_db.portraits.find_one({"id": portrait_id}) is None
        assert mongo_db.videos.find_one({"id": video_id}) is None
        # user remains
        assert mongo_db.users.find_one({"user_id": uid}) is not None
    finally:
        mongo_db.users.delete_one({"user_id": uid})
        mongo_db.pets.delete_many({"user_id": uid})
        mongo_db.memories.delete_many({"user_id": uid})
        mongo_db.stories.delete_many({"user_id": uid})
        mongo_db.portraits.delete_many({"user_id": uid})
        mongo_db.videos.delete_many({"user_id": uid})


def test_cascade_delete_user_removes_everything(mongo_db):
    uid = f"user_qa_del_full_{uuid.uuid4().hex[:8]}"
    pet_id = f"petqa-{uuid.uuid4().hex[:8]}"
    story_id = f"storyqa-{uuid.uuid4().hex[:8]}"
    portrait_id = f"portqa-{uuid.uuid4().hex[:8]}"
    video_id = f"vidqa-{uuid.uuid4().hex[:8]}"
    memory_id = f"memqa-{uuid.uuid4().hex[:8]}"
    sub_id = f"subqa-{uuid.uuid4().hex[:8]}"
    sess_token = f"sessqa-{uuid.uuid4().hex[:8]}"

    mongo_db.users.insert_one({"user_id": uid, "email": f"qa_full_{uid}@test.local", "name": "QA Full Del"})
    mongo_db.pets.insert_one({"id": pet_id, "user_id": uid, "name": "QaFullPet", "created_at": _iso()})
    mongo_db.memories.insert_one({"id": memory_id, "pet_id": pet_id, "user_id": uid, "created_at": _iso()})
    mongo_db.stories.insert_one({"id": story_id, "user_id": uid, "pet_id": pet_id, "status": "paid",
                                 "created_at": _iso()})
    mongo_db.portraits.insert_one({"id": portrait_id, "user_id": uid, "pet_id": pet_id, "status": "paid",
                                   "created_at": _iso()})
    mongo_db.videos.insert_one({"id": video_id, "user_id": uid, "pet_id": pet_id, "status": "paid",
                                "created_at": _iso()})
    mongo_db.subscriptions.insert_one({"mp_id": sub_id, "user_id": uid, "status": "authorized",
                                       "membership_active": True, "created_at": _iso()})
    mongo_db.sessions.insert_one({"session_token": sess_token, "user_id": uid,
                                  "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()})

    try:
        r = requests.delete(f"{API}/admin/users/{uid}", headers=h(ADMIN_TOKEN), timeout=20)
        assert r.status_code == 200
        assert mongo_db.users.find_one({"user_id": uid}) is None
        assert mongo_db.pets.find_one({"user_id": uid}) is None
        assert mongo_db.memories.find_one({"user_id": uid}) is None
        assert mongo_db.stories.find_one({"user_id": uid}) is None
        assert mongo_db.portraits.find_one({"user_id": uid}) is None
        assert mongo_db.videos.find_one({"user_id": uid}) is None
        assert mongo_db.subscriptions.find_one({"user_id": uid}) is None
        assert mongo_db.sessions.find_one({"user_id": uid}) is None
    finally:
        # safety cleanup
        for coll in ("users", "pets", "memories", "stories", "portraits", "videos", "subscriptions", "sessions"):
            mongo_db[coll].delete_many({"user_id": uid})


def test_delete_individual_creations_each_kind(mongo_db):
    uid = f"user_qa_del_cre_{uuid.uuid4().hex[:8]}"
    pet_id = f"petqa-{uuid.uuid4().hex[:8]}"
    sid = f"storyqa-{uuid.uuid4().hex[:8]}"
    pid = f"portqa-{uuid.uuid4().hex[:8]}"
    vid = f"vidqa-{uuid.uuid4().hex[:8]}"

    mongo_db.users.insert_one({"user_id": uid, "email": f"qa_cre_{uid}@test.local"})
    mongo_db.pets.insert_one({"id": pet_id, "user_id": uid, "name": "QaCre", "created_at": _iso()})
    mongo_db.stories.insert_one({"id": sid, "user_id": uid, "pet_id": pet_id, "status": "paid", "created_at": _iso()})
    mongo_db.portraits.insert_one({"id": pid, "user_id": uid, "pet_id": pet_id, "status": "paid", "created_at": _iso()})
    mongo_db.videos.insert_one({"id": vid, "user_id": uid, "pet_id": pet_id, "status": "paid", "created_at": _iso()})

    try:
        r1 = requests.delete(f"{API}/admin/creations/story/{sid}", headers=h(ADMIN_TOKEN), timeout=15)
        assert r1.status_code == 200
        assert mongo_db.stories.find_one({"id": sid}) is None
        # other kinds untouched
        assert mongo_db.portraits.find_one({"id": pid}) is not None
        assert mongo_db.videos.find_one({"id": vid}) is not None

        r2 = requests.delete(f"{API}/admin/creations/portrait/{pid}", headers=h(ADMIN_TOKEN), timeout=15)
        assert r2.status_code == 200
        assert mongo_db.portraits.find_one({"id": pid}) is None

        r3 = requests.delete(f"{API}/admin/creations/video/{vid}", headers=h(ADMIN_TOKEN), timeout=15)
        assert r3.status_code == 200
        assert mongo_db.videos.find_one({"id": vid}) is None

        # pet + user remain
        assert mongo_db.pets.find_one({"id": pet_id}) is not None
    finally:
        for coll in ("users", "pets", "stories", "portraits", "videos", "memories"):
            mongo_db[coll].delete_many({"user_id": uid})


# ---------- final cleanup safety: ensure real fixtures still intact & no leftover courtesy ----------
def test_zz_final_state_real_fixtures_intact():
    # Rocco still there
    r = requests.get(f"{API}/admin/users/{NORM_UID}", headers=h(ADMIN_TOKEN), timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert any(p["id"] == "a8f1f1bb-e5ef-4854-b07e-dc438112bd4a" for p in d["pets"])
    # No courtesy left on either user
    for uid, tok in ((NORM_UID, NORM_TOKEN), (ADMIN_UID, ADMIN_TOKEN)):
        # Deactivate just in case prior failed test left it on
        requests.post(f"{API}/admin/users/{uid}/plus", headers=h(ADMIN_TOKEN),
                      json={"active": False}, timeout=10)
        s = requests.get(f"{API}/plus/status", headers=h(tok), timeout=10).json()
        assert s.get("active") is False, f"Leftover active plus for {uid}"
