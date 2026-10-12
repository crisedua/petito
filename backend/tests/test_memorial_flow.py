"""Tests for the Memorial ('Retrato recuerdo') portrait flow."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
NORM_TOKEN = "test_session_norm_1"
MEMORIAL_SLUG = "3ce2c387ce"


@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {NORM_TOKEN}", "Content-Type": "application/json"}


# ---- /api/config -----------------------------------------------------------
def test_config_exposes_memorial_and_royal_styles():
    r = requests.get(f"{API}/config", timeout=20)
    assert r.status_code == 200
    data = r.json()
    mem_keys = [s["key"] for s in data.get("memorial_styles", [])]
    royal_keys = [s["key"] for s in data.get("portrait_styles", [])]
    assert set(mem_keys) == {"acuarela", "oleo_realista"}, mem_keys
    for k in ("renacentista", "victoriano", "halloween"):
        assert k in royal_keys, (k, royal_keys)


# ---- POST /api/portraits (memorial) ----------------------------------------
def test_create_memorial_portrait_requires_auth():
    r = requests.post(f"{API}/portraits", json={
        "pet_name": "TEST_NoAuth", "style": "acuarela", "category": "memorial"
    }, timeout=20)
    assert r.status_code == 401


def test_create_memorial_portrait_authed(auth_headers):
    r = requests.post(f"{API}/portraits", json={
        "pet_name": "TEST_LunaMem", "style": "acuarela", "category": "memorial",
        "memorial_dates": "2010 - 2024", "memorial_caption": "Siempre conmigo",
    }, headers=auth_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert "id" in data and "slug" in data
    # GET by slug returns memorial category + fields
    g = requests.get(f"{API}/portraits/slug/{data['slug']}", timeout=20)
    assert g.status_code == 200
    gd = g.json()
    assert gd["category"] == "memorial"
    assert gd["memorial_dates"] == "2010 - 2024"
    assert gd["memorial_caption"] == "Siempre conmigo"
    assert gd["style"] == "acuarela"


def test_memorial_rejects_royal_style(auth_headers):
    r = requests.post(f"{API}/portraits", json={
        "pet_name": "TEST_BadStyle", "style": "renacentista", "category": "memorial"
    }, headers=auth_headers, timeout=20)
    assert r.status_code == 400, r.text


def test_royal_accepts_royal_style(auth_headers):
    r = requests.post(f"{API}/portraits", json={
        "pet_name": "TEST_Royal", "style": "renacentista", "category": "royal"
    }, headers=auth_headers, timeout=20)
    assert r.status_code in (200, 201), r.text


def test_royal_rejects_memorial_style(auth_headers):
    r = requests.post(f"{API}/portraits", json={
        "pet_name": "TEST_BadRoyal", "style": "acuarela", "category": "royal"
    }, headers=auth_headers, timeout=20)
    assert r.status_code == 400


# ---- Public slug view -------------------------------------------------------
def test_public_memorial_slug_view():
    r = requests.get(f"{API}/portraits/slug/{MEMORIAL_SLUG}", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["category"] == "memorial"
    assert d["pet_name"] == "Luna"
    assert d["memorial_dates"] == "2010 – 2024"
    assert d["memorial_caption"] == "Siempre conmigo"
    assert d.get("paid") in (False, None)
    # preview_url should be present (watermarked)
    assert d.get("preview_url")


# ---- Mis creaciones ---------------------------------------------------------
def test_me_portraits_lists_memorial(auth_headers):
    r = requests.get(f"{API}/me/portraits",
                     headers={"Authorization": auth_headers["Authorization"]},
                     timeout=20)
    assert r.status_code == 200
    arr = r.json()
    luna = [p for p in arr if p.get("slug") == MEMORIAL_SLUG]
    assert luna, f"Memorial Luna not found in {len(arr)} items"
    assert luna[0]["category"] == "memorial"


def test_me_portraits_requires_auth():
    r = requests.get(f"{API}/me/portraits", timeout=20)
    assert r.status_code == 401
