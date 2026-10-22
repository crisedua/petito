"""
Amigos de Petipop: connections, sharing, hearts, comments, and the privacy rules around them.

  PETITO_URL=http://localhost:3000 pytest web/tests/test_social.py

Same setup as test_api.py (TEST_SESSION_TOKENS + seed-fixtures). The norm user ("A") owns Rocco,
tmp ("B") connects with A, admin ("C") is a stranger who must never see A's shares.
"""
import os
import uuid

import pytest
import requests

BASE = os.environ.get("PETITO_URL", "http://localhost:3000").rstrip("/")
API = f"{BASE}/api"
ROCCO = "a8f1f1bb-e5ef-4854-b07e-dc438112bd4a"


def H(token=None):
    h = {"X-Device-Id": f"dev-{uuid.uuid4().hex[:8]}"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


A, C, B = H("test_session_norm_1"), H("test_session_admin_1"), H("test_session_tmp_1")


def get(path, h, **kw):
    return requests.get(f"{API}{path}", headers=h, timeout=30, **kw)


def post(path, h, **kw):
    return requests.post(f"{API}{path}", headers=h, timeout=30, **kw)


def delete(path, h):
    return requests.delete(f"{API}{path}", headers=h, timeout=30)


def reset_connections():
    for h in (A, B, C):
        o = get("/amigos", h).json()
        for c in o["friends"] + o["incoming"] + o["outgoing"]:
            delete(f"/amigos/{c['connection_id']}", h)


def feed_ids(h):
    return [x["id"] for x in get("/feed", h).json()["items"]]


@pytest.fixture
def memory():
    m = post(f"/pets/{ROCCO}/memories", A, json={"title": "TEST_social", "feeling_text": "Corrió feliz en la playa"}).json()
    yield m
    delete(f"/memories/{m['id']}", A)


@pytest.fixture
def connected():
    reset_connections()
    code = get("/amigos", A).json()["friend_code"]
    r = post(f"/amigos/invite/{code}", B)
    assert r.status_code == 200, r.text
    yield code
    reset_connections()


def test_requires_login():
    for path in ("/amigos", "/feed", "/shares/options", "/amigos/summary"):
        assert get(path, H()).status_code == 401


def test_invite_preview_hides_email_and_connects_both_ways():
    reset_connections()
    code = get("/amigos", A).json()["friend_code"]
    anon = get(f"/amigos/invite/{code}", H())
    assert anon.status_code == 200 and anon.json()["status"] == "anon"
    assert "@" not in anon.text
    assert any(p["name"] for p in anon.json()["owner"]["pets"])
    assert get(f"/amigos/invite/{code}", A).json()["status"] == "self"
    assert post(f"/amigos/invite/{code}", A).status_code == 400  # own link
    assert get(f"/amigos/invite/{code}", B).json()["status"] == "none"
    assert post(f"/amigos/invite/{code}", B).status_code == 200
    assert post(f"/amigos/invite/{code}", B).status_code == 200  # idempotent
    a, b = get("/amigos", A).json(), get("/amigos", B).json()
    assert len(a["friends"]) == 1 and len(b["friends"]) == 1
    assert a["friends"][0]["connection_id"] == b["friends"][0]["connection_id"]
    assert "@" not in get("/amigos", A).text
    assert get(f"/amigos/invite/{code}", B).json()["status"] == "friends"
    reset_connections()


def test_bad_and_reset_codes():
    assert get("/amigos/invite/zzzz", H()).status_code == 404
    old = get("/amigos", A).json()["friend_code"]
    new = post("/amigos/code", A).json()["friend_code"]
    assert new != old
    assert get(f"/amigos/invite/{old}", H()).status_code == 404
    assert get(f"/amigos/invite/{new}", H()).status_code == 200


def test_share_visible_to_friend_not_to_stranger(connected, memory):
    opts = get("/shares/options", A).json()
    assert any(o["kind"] == "memory" and o["id"] == memory["id"] for o in opts)
    r = post("/shares", A, json={"kind": "memory", "item_id": memory["id"], "note": "Miren a Rocco 🐶"})
    assert r.status_code == 200 and r.json()["created"] is True
    sid = r.json()["id"]
    again = post("/shares", A, json={"kind": "memory", "item_id": memory["id"], "note": "otra nota"}).json()
    assert again == {"id": sid, "created": False}

    assert sid in feed_ids(A)
    item = next(x for x in get("/feed", B).json()["items"] if x["id"] == sid)
    assert item["note"] == "otra nota" and item["item"]["memory"]["feeling_text"] == "Corrió feliz en la playa"
    assert item["owner"]["name"] and "@" not in str(item)
    assert sid not in feed_ids(C)
    for r in (get(f"/shares/{sid}/comments", C), post(f"/shares/{sid}/heart", C), post(f"/shares/{sid}/comments", C, json={"body": "hola"})):
        assert r.status_code == 404
    assert next(o for o in get("/shares/options", A).json() if o["id"] == memory["id"])["already_shared"] is True


def test_cannot_share_someone_elses_item(connected, memory):
    assert post("/shares", B, json={"kind": "memory", "item_id": memory["id"]}).status_code == 404
    assert post("/shares", A, json={"kind": "nope", "item_id": memory["id"]}).status_code == 400


def test_hearts_and_comments(connected, memory):
    sid = post("/shares", A, json={"kind": "memory", "item_id": memory["id"]}).json()["id"]
    assert post(f"/shares/{sid}/heart", B).json() == {"hearted": True, "hearts": 1}
    assert post(f"/shares/{sid}/heart", A).json() == {"hearted": True, "hearts": 2}
    assert post(f"/shares/{sid}/heart", B).json() == {"hearted": False, "hearts": 1}

    assert post(f"/shares/{sid}/comments", B, json={"body": "   "}).status_code == 400
    lst = post(f"/shares/{sid}/comments", B, json={"body": "¡Qué regalón!"}).json()
    assert len(lst) == 1 and lst[0]["mine"] and lst[0]["can_delete"]
    cid = lst[0]["id"]
    viewed_by_a = get(f"/shares/{sid}/comments", A).json()[0]
    assert viewed_by_a["mine"] is False and viewed_by_a["can_delete"] is True  # post owner can moderate
    feed_item = next(x for x in get("/feed", A).json()["items"] if x["id"] == sid)
    assert feed_item["comments"] == 1 and feed_item["hearts"] == 1

    lst = post(f"/shares/{sid}/comments", A, json={"body": "Gracias 💛"}).json()
    a_cid = next(c["id"] for c in lst if c["mine"])
    assert delete(f"/shares/{sid}/comments/{a_cid}", B).status_code == 403  # B can't delete A's comment on A's post
    assert delete(f"/shares/{sid}/comments/{cid}", A).status_code == 200    # A removes B's comment on A's post
    assert [c["id"] for c in get(f"/shares/{sid}/comments", B).json()] == [a_cid]

    assert delete(f"/shares/{sid}", B).status_code == 404  # only the owner can unshare
    assert delete(f"/shares/{sid}", A).status_code == 200
    assert sid not in feed_ids(B)


def test_removing_friend_hides_everything(connected, memory):
    sid = post("/shares", A, json={"kind": "memory", "item_id": memory["id"]}).json()["id"]
    assert sid in feed_ids(B)
    cid = get("/amigos", B).json()["friends"][0]["connection_id"]
    assert delete(f"/amigos/{cid}", B).status_code == 200
    assert sid not in feed_ids(B)
    assert post(f"/shares/{sid}/heart", B).status_code == 404
    assert get("/amigos", A).json()["friends"] == []


def test_deleted_item_drops_out_of_feed(connected):
    m = post(f"/pets/{ROCCO}/memories", A, json={"title": "TEST_gone"}).json()
    sid = post("/shares", A, json={"kind": "memory", "item_id": m["id"]}).json()["id"]
    assert sid in feed_ids(B)
    delete(f"/memories/{m['id']}", A)
    assert sid not in feed_ids(B)


def test_request_from_public_album_needs_acceptance(memory):
    reset_connections()
    requests.put(f"{API}/pets/{ROCCO}", json={"public_enabled": True}, headers=A, timeout=20)
    slug = get(f"/pets/{ROCCO}", A).json()["share_slug"]
    assert get(f"/u/{slug}", H()).json()["connection"] == "anon"
    assert get(f"/u/{slug}", A).json()["connection"] == "self"
    assert get(f"/u/{slug}", C).json()["connection"] == "none"
    assert post("/amigos/request", A, json={"pet_slug": slug}).status_code == 400  # own pet

    r = post("/amigos/request", C, json={"pet_slug": slug}).json()
    assert r["status"] == "pending"
    assert get(f"/u/{slug}", C).json()["connection"] == "pending"
    assert get("/amigos/summary", A).json() == {"pending": 1}
    sid = post("/shares", A, json={"kind": "memory", "item_id": memory["id"]}).json()["id"]
    assert sid not in feed_ids(C)  # pending is not connected

    inc = get("/amigos", A).json()["incoming"]
    assert len(inc) == 1 and "@" not in str(inc)
    assert post(f"/amigos/{inc[0]['connection_id']}/accept", C).status_code == 403  # requester can't accept
    assert post(f"/amigos/{inc[0]['connection_id']}/accept", A).json() == {"status": "accepted"}
    assert sid in feed_ids(C)
    assert get(f"/u/{slug}", C).json()["connection"] == "friends"
    assert get("/amigos/summary", A).json() == {"pending": 0}
    reset_connections()


def test_declined_request_stays_private():
    reset_connections()
    slug = get(f"/pets/{ROCCO}", A).json()["share_slug"]
    post("/amigos/request", B, json={"pet_slug": slug})
    inc = get("/amigos", A).json()["incoming"][0]
    assert delete(f"/amigos/{inc['connection_id']}", C).status_code == 404  # not C's to touch
    assert delete(f"/amigos/{inc['connection_id']}", A).status_code == 200
    assert get("/amigos", B).json()["outgoing"] == []
    assert get(f"/u/{slug}", B).json()["connection"] == "none"
