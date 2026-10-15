"""Regression tests for Plus admin-only activation/deactivation endpoints.
   Verifies admin can activate/deactivate Plus and non-admin gets 403.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cuentapatas-demo.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "test_session_admin_1"
NORMAL_TOKEN = "test_session_norm_1"


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


class TestPlusAdminTool:
    def test_admin_status_has_is_admin_true(self):
        r = requests.get(f"{BASE_URL}/api/plus/status", headers=_h(ADMIN_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("is_admin") is True

    def test_normal_status_has_is_admin_false(self):
        r = requests.get(f"{BASE_URL}/api/plus/status", headers=_h(NORMAL_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("is_admin") is False

    def test_admin_activate_then_status_active(self):
        r = requests.post(f"{BASE_URL}/api/plus/admin-activate", json={"plan": "annual"}, headers=_h(ADMIN_TOKEN))
        assert r.status_code == 200, r.text
        assert r.json().get("active") is True
        s = requests.get(f"{BASE_URL}/api/plus/status", headers=_h(ADMIN_TOKEN)).json()
        assert s.get("active") is True

    def test_admin_deactivate_then_status_inactive(self):
        r = requests.post(f"{BASE_URL}/api/plus/admin-deactivate", headers=_h(ADMIN_TOKEN))
        assert r.status_code == 200, r.text
        assert r.json().get("active") is False
        s = requests.get(f"{BASE_URL}/api/plus/status", headers=_h(ADMIN_TOKEN)).json()
        assert s.get("active") is False

    def test_non_admin_activate_forbidden(self):
        r = requests.post(f"{BASE_URL}/api/plus/admin-activate", json={"plan": "annual"}, headers=_h(NORMAL_TOKEN))
        assert r.status_code == 403, r.text

    def test_non_admin_deactivate_forbidden(self):
        r = requests.post(f"{BASE_URL}/api/plus/admin-deactivate", headers=_h(NORMAL_TOKEN))
        assert r.status_code == 403, r.text

    def test_cleanup_deactivate_admin(self):
        # Ensure admin ends not Plus
        requests.post(f"{BASE_URL}/api/plus/admin-deactivate", headers=_h(ADMIN_TOKEN))
        s = requests.get(f"{BASE_URL}/api/plus/status", headers=_h(ADMIN_TOKEN)).json()
        assert s.get("active") is False
