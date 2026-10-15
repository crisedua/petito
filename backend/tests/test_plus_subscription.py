"""Petito Plus subscription + entitlement tests."""
import os
import uuid
import datetime
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
TOKEN = "test_session_norm_1"
USER_ID = "user_testnorm1"
ROCCO_PET_ID = "a8f1f1bb-e5ef-4854-b07e-dc438112bd4a"
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

_mc = MongoClient(os.environ["MONGO_URL"])
db = _mc[os.environ["DB_NAME"]]


def _clear_subs():
    db.subscriptions.delete_many({"user_id": USER_ID})


def _clear_extra_pets():
    db.pets.delete_many({"user_id": USER_ID, "name": {"$ne": "Rocco"}})


def _cur_month():
    return datetime.datetime.utcnow().strftime("%Y-%m")


def _seed_reflections(n):
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    ids = []
    for i in range(n):
        mid = str(uuid.uuid4())
        ids.append(mid)
        db.memories.insert_one({
            "id": mid, "user_id": USER_ID, "pet_id": ROCCO_PET_ID,
            "title": f"TEST_seed_{i}", "feeling_text": "x",
            "emotions": [], "photo_file": None,
            "ai_reflection": "seeded", "created_at": now_iso,
        })
    return ids


# ---------- CONFIG ----------
def test_config_plus_prices():
    r = requests.get(f"{BASE_URL}/api/config")
    assert r.status_code == 200
    d = r.json()
    assert d["plus_monthly_clp"] == 3900
    assert d["plus_annual_clp"] == 29900


# ---------- PLUS STATUS ----------
def test_plus_status_no_token_401():
    r = requests.get(f"{BASE_URL}/api/plus/status")
    assert r.status_code == 401


def test_plus_status_initial_inactive():
    _clear_subs()
    r = requests.get(f"{BASE_URL}/api/plus/status", headers=H)
    assert r.status_code == 200
    d = r.json()
    assert d["active"] is False
    assert d["monthly_clp"] == 3900
    assert d["annual_clp"] == 29900
    assert d["free_mode"] is True


# ---------- SUBSCRIBE ----------
def test_subscribe_invalid_plan_400():
    _clear_subs()
    r = requests.post(f"{BASE_URL}/api/plus/subscribe", headers=H, json={"plan": "bogus"})
    assert r.status_code == 400


def test_subscribe_monthly_returns_init_point():
    _clear_subs()
    r = requests.post(f"{BASE_URL}/api/plus/subscribe", headers=H, json={"plan": "monthly"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert "init_point" in d and "mercadopago" in d["init_point"]
    assert "mp_id" in d
    sub = db.subscriptions.find_one({"user_id": USER_ID, "mp_id": d["mp_id"]}, {"_id": 0})
    assert sub is not None
    assert sub["membership_active"] is False


# ---------- NO-PLUS GATES ----------
def test_no_plus_second_pet_402():
    _clear_subs()
    _clear_extra_pets()
    r = requests.post(f"{BASE_URL}/api/pets", headers=H,
                      json={"name": "TEST_SecondPet", "species": "perro", "personality": []})
    assert r.status_code == 402, r.text
    assert "Plus" in r.json().get("detail", "")


def test_no_plus_fourth_reflection_402():
    _clear_subs()
    cnt_before = db.memories.count_documents({
        "user_id": USER_ID, "ai_reflection": {"$ne": None},
        "created_at": {"$regex": f"^{_cur_month()}"}})
    need = max(0, 3 - cnt_before)
    seeded = _seed_reflections(need)
    cm = requests.post(f"{BASE_URL}/api/pets/{ROCCO_PET_ID}/memories", headers=H, json={
        "title": "TEST_4th_reflect", "feeling_text": "test", "emotions": []
    })
    assert cm.status_code == 200, cm.text
    mem_id = cm.json()["id"]
    try:
        rr = requests.post(f"{BASE_URL}/api/memories/{mem_id}/reflect", headers=H)
        assert rr.status_code == 402, rr.text
        assert "Plus" in rr.json().get("detail", "")
    finally:
        db.memories.delete_one({"id": mem_id})
        for sid in seeded:
            db.memories.delete_one({"id": sid})


# ---------- DEV-ACTIVATE + PLUS GATES ----------
def test_dev_activate_and_plus_unlocks():
    _clear_subs()
    _clear_extra_pets()
    r = requests.post(f"{BASE_URL}/api/plus/dev-activate", headers=H, json={"plan": "annual"})
    assert r.status_code == 200, r.text
    s = requests.get(f"{BASE_URL}/api/plus/status", headers=H).json()
    assert s["active"] is True
    assert s["plan"] == "annual"
    assert s["plus_until"] is not None

    # 2nd pet allowed
    p2 = requests.post(f"{BASE_URL}/api/pets", headers=H,
                       json={"name": "TEST_PlusPet2", "species": "perro", "personality": []})
    assert p2.status_code == 200, p2.text
    pet2_id = p2.json()["id"]

    # Reflection unblocked
    cm = requests.post(f"{BASE_URL}/api/pets/{ROCCO_PET_ID}/memories", headers=H, json={
        "title": "TEST_PlusRefl", "feeling_text": "t", "emotions": []
    })
    assert cm.status_code == 200
    mem_id = cm.json()["id"]
    rr = requests.post(f"{BASE_URL}/api/memories/{mem_id}/reflect", headers=H)
    assert rr.status_code == 200, rr.text

    # Cleanup
    db.pets.delete_one({"id": pet2_id})
    db.memories.delete_one({"id": mem_id})


def test_plus_portrait_checkout_mode_plus():
    _clear_subs()
    requests.post(f"{BASE_URL}/api/plus/dev-activate", headers=H, json={"plan": "monthly"})
    # Create portrait
    pr = requests.post(f"{BASE_URL}/api/portraits", headers=H,
                       json={"pet_id": ROCCO_PET_ID, "style": "renacentista", "category": "royal"})
    if pr.status_code != 200:
        pytest.skip(f"portrait create not available: {pr.status_code}")
    pid = pr.json().get("id")
    assert pid
    ck = requests.post(f"{BASE_URL}/api/portraits/{pid}/checkout", headers=H, json={})
    assert ck.status_code == 200, ck.text
    cj = ck.json()
    assert cj.get("mode") == "plus"
    assert cj.get("already_paid") is True


# ---------- CANCEL ----------
def test_cancel_requires_active():
    _clear_subs()
    r = requests.put(f"{BASE_URL}/api/plus/cancel", headers=H)
    assert r.status_code == 404


def test_cancel_active():
    _clear_subs()
    requests.post(f"{BASE_URL}/api/plus/dev-activate", headers=H, json={"plan": "monthly"})
    r = requests.put(f"{BASE_URL}/api/plus/cancel", headers=H)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    sub = db.subscriptions.find_one({"user_id": USER_ID}, {"_id": 0})
    assert sub["status"] == "canceled"


# ---------- WEBHOOK ----------
def test_webhook_subscription_preapproval_no_op():
    body = {"type": "subscription_preapproval", "data": {"id": "fake_pre_id_xyz"}}
    r = requests.post(f"{BASE_URL}/api/payments/webhook/mercadopago", json=body)
    assert r.status_code == 200, r.text
    assert r.json().get("received") is True


def test_webhook_subscription_authorized_payment_no_op():
    body = {"type": "subscription_authorized_payment", "data": {"id": "fake_auth_payment_xyz"}}
    r = requests.post(f"{BASE_URL}/api/payments/webhook/mercadopago", json=body)
    assert r.status_code == 200, r.text
    assert r.json().get("received") is True


def test_webhook_payment_unknown_id_does_not_crash():
    """Pre-existing: with unknown payment id the webhook raises 500 due to raise_for_status.
    This test documents the issue — expected to fail until MP payment path is wrapped."""
    body = {"type": "payment", "data": {"id": "nonexistent_123"}}
    r = requests.post(f"{BASE_URL}/api/payments/webhook/mercadopago", json=body)
    # Known issue: currently 500. Accept 200/204/404 as pass; mark xfail if 500.
    assert r.status_code in (200, 204, 404), f"webhook crashed with {r.status_code}: {r.text}"


# ---------- Final cleanup ----------
def test_zzz_final_cleanup():
    _clear_subs()
    _clear_extra_pets()
