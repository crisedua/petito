"""
Admin user management: edit, Pro (Plus) with durations, admin role, suspension, add by email, delete.

  PETITO_URL=http://localhost:3000 pytest web/tests/test_admin_users.py

Same setup as test_api.py. The admin token's email is in ADMIN_EMAILS (a fixed admin); tmp is the
user being managed; norm is a regular user.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE = os.environ.get("PETITO_URL", "http://localhost:3000").rstrip("/")
API = f"{BASE}/api"


def H(token=None):
    h = {"X-Device-Id": f"dev-{uuid.uuid4().hex[:8]}"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


ADMIN, TMP, NORM = H("test_session_admin_1"), H("test_session_tmp_1"), H("test_session_norm_1")


def uid(h):
    return requests.get(f"{API}/auth/me", headers=h, timeout=20).json()["user_id"]


def detail(user_id):
    r = requests.get(f"{API}/admin/users/{user_id}", headers=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def patch(user_id, body, h=ADMIN):
    return requests.patch(f"{API}/admin/users/{user_id}", json=body, headers=h, timeout=20)


def plus(user_id, body):
    r = requests.post(f"{API}/admin/users/{user_id}/plus", json=body, headers=ADMIN, timeout=20)
    return r


def listing(**params):
    r = requests.get(f"{API}/admin/users", params=params, headers=ADMIN, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def tmp():
    u = uid(TMP)
    patch(u, {"suspended": False})
    patch(u, {"is_admin": False})
    yield u
    patch(u, {"suspended": False})
    patch(u, {"is_admin": False})
    patch(u, {"name": None, "admin_note": None})
    plus(u, {"active": False})


def test_only_admins():
    u = uid(TMP)
    assert requests.get(f"{API}/admin/users", headers=NORM, timeout=20).status_code == 403
    assert patch(u, {"name": "x"}, NORM).status_code == 403
    assert requests.post(f"{API}/admin/users", json={"email": "a@b.cl"}, headers=NORM, timeout=20).status_code == 403


def test_edit_name_email_note(tmp):
    r = patch(tmp, {"name": "  Camila Pérez ", "admin_note": "Cliente VIP"})
    assert r.status_code == 200 and r.json()["name"] == "Camila Pérez" and r.json()["admin_note"] == "Cliente VIP"
    d = detail(tmp)
    assert d["name"] == "Camila Pérez" and d["admin_note"] == "Cliente VIP"
    norm_email = requests.get(f"{API}/auth/me", headers=NORM, timeout=20).json()["email"]
    assert patch(tmp, {"email": norm_email}).status_code == 409
    assert patch(tmp, {"email": "not-an-email"}).status_code == 400
    assert patch(tmp, {}).status_code == 400
    me_admin = uid(ADMIN)
    assert patch(me_admin, {"email": "other@example.com"}).status_code == 400  # fixed admin's email


def test_plus_durations_and_revoke(tmp):
    now = datetime.now(timezone.utc)
    r = plus(tmp, {"active": True, "duration": "month"}).json()
    assert r["is_plus"] and r["plus"]["current"]["source"] == "courtesy"
    until = datetime.fromisoformat(r["plus"]["current"]["until"].replace("Z", "+00:00"))
    assert timedelta(days=30) < until - now < timedelta(days=32)

    r = plus(tmp, {"active": True, "duration": "year"}).json()
    until = datetime.fromisoformat(r["plus"]["current"]["until"].replace("Z", "+00:00"))
    assert timedelta(days=364) < until - now < timedelta(days=367)
    assert len([h for h in r["plus"]["history"] if h["source"] == "courtesy"]) == 1  # replaced, not stacked

    r = plus(tmp, {"active": True, "duration": "lifetime"}).json()
    assert r["is_plus"] and r["plus"]["current"]["until"] is None

    target = (now + timedelta(days=10)).strftime("%Y-%m-%d")
    r = plus(tmp, {"active": True, "duration": "until", "until": target}).json()
    end = datetime.fromisoformat(r["plus"]["current"]["until"].replace("Z", "+00:00"))
    assert any((end + timedelta(hours=off)).strftime("%Y-%m-%d %H:%M") == f"{target} 23:59" for off in (-3, -4))  # end of that day in Chile
    assert plus(tmp, {"active": True, "duration": "until", "until": "2020-01-01"}).status_code == 400
    assert plus(tmp, {"active": True, "duration": "forever-ish"}).status_code == 400

    assert tmp in [u["user_id"] for u in listing(filter="plus")]
    assert tmp not in [u["user_id"] for u in listing(filter="free")]
    r = plus(tmp, {"active": False}).json()
    assert r["is_plus"] is False and r["plus"]["current"] is None
    assert tmp in [u["user_id"] for u in listing(filter="free")]
    assert requests.get(f"{API}/plus/status", headers=TMP, timeout=20).json()["active"] is False


def test_admin_role(tmp):
    assert requests.get(f"{API}/admin/users", headers=TMP, timeout=20).status_code == 403
    r = patch(tmp, {"is_admin": True})
    assert r.status_code == 200 and r.json()["is_admin"] is True
    assert requests.get(f"{API}/auth/me", headers=TMP, timeout=20).json()["is_admin"] is True
    assert requests.get(f"{API}/admin/users", headers=TMP, timeout=30).status_code == 200
    assert tmp in [u["user_id"] for u in listing(filter="admin")]
    # a panel admin can't demote themselves, the fixed admin, or suspend an admin
    assert patch(tmp, {"is_admin": False}, TMP).status_code == 400
    assert patch(uid(ADMIN), {"is_admin": False}, TMP).status_code == 400
    assert patch(tmp, {"suspended": True}).status_code == 400
    assert patch(tmp, {"is_admin": False}).status_code == 200
    assert requests.get(f"{API}/admin/users", headers=TMP, timeout=20).status_code == 403


def test_suspend_blocks_everything_until_reactivated(tmp):
    r = patch(tmp, {"suspended": True})
    assert r.status_code == 200 and r.json()["suspended"] is True
    me = requests.get(f"{API}/auth/me", headers=TMP, timeout=20)
    assert me.status_code == 403 and me.json().get("suspended") is True
    assert requests.get(f"{API}/pets", headers=TMP, timeout=20).status_code == 403
    assert requests.post(f"{API}/pets", json={"name": "x"}, headers=TMP, timeout=20).status_code == 403
    assert tmp in [u["user_id"] for u in listing(filter="suspended")]
    assert patch(tmp, {"is_admin": True}).status_code == 400  # reactivate first
    assert patch(tmp, {"suspended": False}).status_code == 200
    assert requests.get(f"{API}/auth/me", headers=TMP, timeout=20).status_code == 200
    assert patch(uid(ADMIN), {"suspended": True}).status_code == 400  # not yourself


def test_add_user_by_email_with_plus_then_delete():
    email = f"nuevo.{uuid.uuid4().hex[:6]}@example.com"
    assert requests.post(f"{API}/admin/users", json={"email": "nope"}, headers=ADMIN, timeout=20).status_code == 400
    r = requests.post(f"{API}/admin/users", json={"email": email.upper(), "name": "Nuevo", "plus": "year"}, headers=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    new_id = r.json()["user_id"]
    assert requests.post(f"{API}/admin/users", json={"email": email}, headers=ADMIN, timeout=20).status_code == 409
    row = next(u for u in listing(q=email) if u["user_id"] == new_id)
    assert row["email"] == email and row["is_plus"] and row["linked"] is False and row["name"] == "Nuevo"
    d = detail(new_id)
    assert d["linked"] is False and d["plus"]["current"]["plan"] == "annual"
    assert requests.delete(f"{API}/admin/users/{new_id}", headers=ADMIN, timeout=30).status_code == 200
    assert requests.get(f"{API}/admin/users/{new_id}", headers=ADMIN, timeout=20).status_code == 404


def test_cannot_delete_self_or_fixed_admin():
    assert requests.delete(f"{API}/admin/users/{uid(ADMIN)}", headers=ADMIN, timeout=20).status_code == 400
    assert detail(uid(ADMIN))["owner_admin"] is True
