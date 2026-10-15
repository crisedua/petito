"""Backend tests for Petito Habla scenarios + editable message feature."""
import os
import io
import time
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cuentapatas-demo.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
NORM_TOKEN = "test_session_norm_1"
AUTH = {"Authorization": f"Bearer {NORM_TOKEN}"}


def _png_bytes():
    img = Image.new("RGB", (512, 512), (120, 160, 200))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def _cleanup(video_id):
    try:
        import pymongo
        c = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        c["test_database"]["videos"].delete_one({"id": video_id})
        c["test_database"]["talk_photos"].delete_many({"video_id": video_id})
    except Exception:
        pass


# ---------- /api/config exposes scenarios + max ----------
class TestConfigExposesScenarios:
    def test_config_has_scenarios_and_max(self):
        r = requests.get(f"{API}/config", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("talk_message_max") == 160
        scen = d.get("talk_scenarios")
        assert isinstance(scen, list) and len(scen) == 5
        keys = [s["key"] for s in scen]
        for k in ("chistoso", "cumpleanos", "te_amo", "te_extrano", "gracias"):
            assert k in keys, f"missing scenario {k}"
        # each has label + emoji
        for s in scen:
            assert s.get("label") and s.get("emoji")


# ---------- POST /api/talk persists scenario+message, truncates message ----------
class TestCreateTalkPersistsFields:
    def test_create_with_scenario_and_message(self):
        r = requests.post(f"{API}/talk", headers=AUTH, json={
            "pet_name": "TEST_Birthday", "scenario": "cumpleanos",
            "message": "¡Feliz cumpleaños, mamá!",
        }, timeout=15)
        assert r.status_code == 200, r.text
        vid = r.json()["id"]
        # read via public slug read
        slug = r.json()["slug"]
        g = requests.get(f"{API}/talk/slug/{slug}", timeout=15).json()
        assert g["slug"] == slug
        # Fields persisted (check via mongo directly since talk_public may not include them)
        import pymongo
        c = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        doc = c["test_database"]["videos"].find_one({"id": vid})
        assert doc["scenario"] == "cumpleanos"
        assert doc["message"] == "¡Feliz cumpleaños, mamá!"
        _cleanup(vid)

    def test_message_truncated_to_160(self):
        long_msg = "a" * 300
        r = requests.post(f"{API}/talk", headers=AUTH, json={
            "pet_name": "TEST_Long", "message": long_msg,
        }, timeout=15)
        assert r.status_code == 200
        vid = r.json()["id"]
        import pymongo
        c = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        doc = c["test_database"]["videos"].find_one({"id": vid})
        assert doc["message"] is not None
        assert len(doc["message"]) == 160
        _cleanup(vid)

    def test_invalid_scenario_stored_null(self):
        r = requests.post(f"{API}/talk", headers=AUTH, json={
            "pet_name": "TEST_InvalidScen", "scenario": "not_a_real_scenario",
        }, timeout=15)
        assert r.status_code == 200
        vid = r.json()["id"]
        import pymongo
        c = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        doc = c["test_database"]["videos"].find_one({"id": vid})
        assert doc["scenario"] is None
        _cleanup(vid)

    def test_no_scenario_no_message_defaults_null(self):
        r = requests.post(f"{API}/talk", headers=AUTH, json={"pet_name": "TEST_Default"}, timeout=15)
        assert r.status_code == 200
        vid = r.json()["id"]
        import pymongo
        c = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        doc = c["test_database"]["videos"].find_one({"id": vid})
        assert doc["scenario"] is None
        assert doc["message"] is None
        _cleanup(vid)


# ---------- Pipeline: line field is set verbatim when message provided ----------
class TestPipelineLineGeneration:
    def _create_and_start(self, payload):
        r = requests.post(f"{API}/talk", headers=AUTH, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        vid = r.json()["id"]
        files = {"files": ("p.png", _png_bytes(), "image/png")}
        pr = requests.post(f"{API}/talk/{vid}/photo", files=files, timeout=30)
        assert pr.status_code == 200, pr.text
        gr = requests.post(f"{API}/talk/{vid}/generate", headers=AUTH, timeout=30)
        assert gr.status_code == 200, gr.text
        return vid

    def _poll_for_line(self, vid, timeout_s=30):
        for _ in range(int(timeout_s / 2)):
            d = requests.get(f"{API}/talk/{vid}", timeout=15).json()
            if d.get("line"):
                return d
            time.sleep(2)
        return requests.get(f"{API}/talk/{vid}", timeout=15).json()

    def test_custom_message_verbatim(self):
        custom = "¡Feliz cumpleaños, mamá! Te quiero montones 🐾"
        vid = self._create_and_start({
            "pet_name": "TEST_Verbatim", "scenario": "cumpleanos", "message": custom,
        })
        try:
            d = self._poll_for_line(vid, timeout_s=30)
            assert d.get("line") == custom, f"line mismatch, got: {d.get('line')}"
        finally:
            _cleanup(vid)

    def test_scenario_te_extrano_ai_line(self):
        vid = self._create_and_start({
            "pet_name": "TEST_Missing", "scenario": "te_extrano",
        })
        try:
            d = self._poll_for_line(vid, timeout_s=40)
            line = (d.get("line") or "").lower()
            assert line, "no AI line generated"
            # Should reflect missing-you tone; verify not funny default (very loose heuristic)
            # Common Spanish missing-you words
            missing_keywords = ["extra", "espera", "vuelv", "falt", "sin ti", "sin tí", "regres"]
            assert any(k in line for k in missing_keywords), f"line doesn't reflect missing tone: {line}"
        finally:
            _cleanup(vid)

    def test_no_scenario_defaults_to_funny_ai_line(self):
        vid = self._create_and_start({"pet_name": "TEST_Funny"})
        try:
            d = self._poll_for_line(vid, timeout_s=40)
            assert d.get("line"), f"no line generated: {d}"
        finally:
            _cleanup(vid)
