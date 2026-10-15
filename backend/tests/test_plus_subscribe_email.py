"""Petito Plus /subscribe email override tests (iteration_20)."""
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
TOKEN = "test_session_norm_1"
USER_ID = "user_testnorm1"
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

_mc = MongoClient(os.environ["MONGO_URL"])
db = _mc[os.environ["DB_NAME"]]


def _clear_subs():
    db.subscriptions.delete_many({"user_id": USER_ID})


# --- validation ---
def test_subscribe_invalid_email_bad_returns_400_no_row():
    _clear_subs()
    r = requests.post(f"{BASE_URL}/api/plus/subscribe", headers=H,
                      json={"plan": "monthly", "email": "bad"})
    assert r.status_code == 400, r.text
    detail = r.json().get("detail", "")
    assert "correo" in detail.lower() or "mercado" in detail.lower()
    assert db.subscriptions.count_documents({"user_id": USER_ID}) == 0


def test_subscribe_invalid_email_notanemail_returns_400_no_row():
    _clear_subs()
    r = requests.post(f"{BASE_URL}/api/plus/subscribe", headers=H,
                      json={"plan": "annual", "email": "notanemail"})
    assert r.status_code == 400
    assert db.subscriptions.count_documents({"user_id": USER_ID}) == 0


def test_subscribe_empty_email_falls_back_to_user_and_may_succeed():
    """When email omitted, server falls back to session user email."""
    _clear_subs()
    r = requests.post(f"{BASE_URL}/api/plus/subscribe", headers=H,
                      json={"plan": "monthly"})
    # Our seeded user email is valid, so this should succeed
    assert r.status_code == 200, r.text
    d = r.json()
    assert "mercadopago" in d["init_point"]
    _clear_subs()


# --- happy path valid email override ---
def test_subscribe_valid_email_override_monthly():
    _clear_subs()
    r = requests.post(f"{BASE_URL}/api/plus/subscribe", headers=H,
                      json={"plan": "monthly", "email": "test.petito.norm@example.com"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert "init_point" in d
    assert "mercadopago.cl/subscriptions/checkout" in d["init_point"]
    assert "mp_id" in d
    sub = db.subscriptions.find_one({"user_id": USER_ID, "mp_id": d["mp_id"]}, {"_id": 0})
    assert sub is not None
    assert sub["payer_email"] == "test.petito.norm@example.com"
    assert sub["plan"] == "monthly"
    assert sub["membership_active"] is False
    _clear_subs()


def test_subscribe_valid_email_override_annual():
    _clear_subs()
    r = requests.post(f"{BASE_URL}/api/plus/subscribe", headers=H,
                      json={"plan": "annual", "email": "test.petito.norm@example.com"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert "mercadopago.cl/subscriptions/checkout" in d["init_point"]
    sub = db.subscriptions.find_one({"user_id": USER_ID, "mp_id": d["mp_id"]}, {"_id": 0})
    assert sub is not None
    assert sub["plan"] == "annual"
    _clear_subs()


# --- final cleanup to leave DB clean ---
def test_zzz_final_cleanup():
    _clear_subs()
    assert db.subscriptions.count_documents({"user_id": USER_ID}) == 0
