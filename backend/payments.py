"""Payment providers behind a common interface. Demo mode active; Mercado Pago ready."""
import os
import time
import hmac
import hashlib
from pathlib import Path
import httpx
from dotenv import load_dotenv
from typing import Protocol

load_dotenv(Path(__file__).parent / ".env")
PAYMENT_MODE = os.environ.get("PAYMENT_MODE", "demo")
PRICE_CLP = int(os.environ.get("STORY_PRICE_CLP", "3990"))


class PaymentProvider(Protocol):
    mode: str
    async def create_checkout(self, story_id: str, slug: str) -> dict: ...


class DemoProvider:
    """No real charge. Frontend confirms via /pay-demo to unlock instantly."""
    mode = "demo"

    async def create_checkout(self, story_id: str, slug: str) -> dict:
        return {"mode": "demo", "amount": PRICE_CLP, "story_id": story_id}


class MercadoPagoProvider:
    mode = "mercadopago"
    base = "https://api.mercadopago.com"

    def __init__(self, token: str, webhook_secret: str, frontend_url: str, public_api_url: str):
        self.token = token
        self.webhook_secret = webhook_secret
        self.frontend_url = frontend_url.rstrip("/")
        self.public_api_url = public_api_url.rstrip("/")

    @property
    def _headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    async def create_checkout(self, story_id: str, slug: str) -> dict:
        body = {
            "items": [{
                "id": story_id, "title": "Historia Cuentapatas",
                "quantity": 1, "currency_id": "CLP", "unit_price": PRICE_CLP,
            }],
            "external_reference": story_id,
            "back_urls": {
                "success": f"{self.frontend_url}/h/{slug}?pago=success",
                "pending": f"{self.frontend_url}/h/{slug}?pago=pending",
                "failure": f"{self.frontend_url}/h/{slug}?pago=failure",
            },
            "auto_return": "approved",
            "notification_url": f"{self.public_api_url}/api/payments/webhook/mercadopago",
        }
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{self.base}/checkout/preferences", headers=self._headers, json=body)
        r.raise_for_status()
        data = r.json()
        return {"mode": "mercadopago", "checkout_url": data["init_point"], "amount": PRICE_CLP}

    async def get_payment(self, payment_id: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{self.base}/v1/payments/{payment_id}", headers=self._headers)
        r.raise_for_status()
        return r.json()

    def valid_signature(self, x_signature, x_request_id, data_id) -> bool:
        if not (x_signature and x_request_id and data_id):
            return False
        parts = dict(p.strip().split("=", 1) for p in x_signature.split(",") if "=" in p)
        ts, received = parts.get("ts"), parts.get("v1")
        if not ts or not received:
            return False
        try:
            if abs(time.time() - int(ts)) > 300:
                return False
        except ValueError:
            return False
        manifest = f"id:{data_id.lower()};request-id:{x_request_id};ts:{ts};"
        expected = hmac.new(self.webhook_secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, received)


def build_provider(frontend_url: str, public_api_url: str) -> PaymentProvider:
    token = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "")
    secret = os.environ.get("MERCADOPAGO_WEBHOOK_SECRET", "")
    if PAYMENT_MODE == "mercadopago" and token:
        return MercadoPagoProvider(token, secret, frontend_url, public_api_url)
    return DemoProvider()
