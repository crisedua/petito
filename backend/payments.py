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

    async def create_checkout(self, ref: str, slug: str, amount: int = PRICE_CLP,
                              title: str = "Historia Petito", back_path: str = None,
                              origin: str = None) -> dict:
        return {"mode": "demo", "amount": amount, "ref": ref}


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

    async def create_checkout(self, ref: str, slug: str, amount: int = PRICE_CLP,
                              title: str = "Historia Petito", back_path: str = None,
                              origin: str = None) -> dict:
        back_path = back_path or f"/h/{slug}"
        front = (origin or self.frontend_url).rstrip("/")
        api = (origin or self.public_api_url).rstrip("/")
        body = {
            "items": [{
                "id": ref, "title": title,
                "quantity": 1, "currency_id": "CLP", "unit_price": amount,
            }],
            "external_reference": ref,
            "back_urls": {
                "success": f"{front}{back_path}?pago=success",
                "pending": f"{front}{back_path}?pago=pending",
                "failure": f"{front}{back_path}?pago=failure",
            },
            "auto_return": "approved",
            "notification_url": f"{api}/api/payments/webhook/mercadopago",
        }
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{self.base}/checkout/preferences", headers=self._headers, json=body)
        r.raise_for_status()
        data = r.json()
        return {"mode": "mercadopago", "checkout_url": data["init_point"], "amount": amount}

    async def get_payment(self, payment_id: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{self.base}/v1/payments/{payment_id}", headers=self._headers)
        r.raise_for_status()
        return r.json()

    # ---- Preapproval (Petito Plus recurring subscriptions) ----
    async def create_preapproval(self, ref: str, reason: str, amount: int, frequency: int,
                                 payer_email: str, back_url: str) -> dict:
        body = {
            "reason": reason,
            "external_reference": ref,
            "payer_email": payer_email,
            "auto_recurring": {
                "frequency": frequency, "frequency_type": "months",
                "transaction_amount": amount, "currency_id": "CLP",
            },
            "back_url": back_url,
            "status": "pending",
        }
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(f"{self.base}/preapproval", headers=self._headers, json=body)
        r.raise_for_status()
        d = r.json()
        return {"id": d["id"], "init_point": d["init_point"], "status": d.get("status"),
                "next_payment_date": d.get("next_payment_date")}

    async def get_preapproval(self, preapproval_id: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{self.base}/preapproval/{preapproval_id}", headers=self._headers)
        r.raise_for_status()
        return r.json()

    async def cancel_preapproval(self, preapproval_id: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.put(f"{self.base}/preapproval/{preapproval_id}", headers=self._headers,
                            json={"status": "canceled"})
        r.raise_for_status()
        return r.json()

    async def get_authorized_payment(self, ap_id: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{self.base}/authorized_payments/{ap_id}", headers=self._headers)
        r.raise_for_status()
        return r.json()

    def valid_signature(self, x_signature, x_request_id, data_id) -> bool:
        # No secret configured -> skip HMAC check. Security still holds because we re-fetch
        # the payment from Mercado Pago with our access token before trusting any status.
        if not self.webhook_secret:
            return True
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
