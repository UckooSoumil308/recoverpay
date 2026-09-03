"""
razorpay_tool.py — Razorpay Payment Link Generator for RecoverPay.

Creates dynamic payment links via the official Razorpay Python SDK (Test Mode).
Falls back to a synthetic URL when credentials are missing or the API is
unreachable, so the rest of the pipeline never breaks.
"""

import logging
import os
from datetime import datetime, timedelta, timezone

import razorpay

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Razorpay Client Setup (Test Mode)
# ---------------------------------------------------------------------------

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_dummy_key")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "dummy_secret")

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_payment_link(
    amount_inr: float,
    customer_name: str,
    phone: str,
    reference_id: str,
) -> str:
    """Create a Razorpay payment link and return its short URL.

    Parameters
    ----------
    amount_inr : float
        Payment amount in INR (e.g. 999.0).
    customer_name : str
        Display name shown on the payment page.
    phone : str
        Customer mobile number (with or without +91 prefix).
    reference_id : str
        Unique reference tying this link back to the failed transaction.

    Returns
    -------
    str
        The ``short_url`` from Razorpay on success, or a deterministic
        fallback test URL on any failure.
    """
    amount_paise = int(amount_inr * 100)
    expire_by = int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())

    payload = {
        "amount": amount_paise,
        "currency": "INR",
        "accept_partial": False,
        "expire_by": expire_by,
        "reference_id": reference_id,
        "description": "RecoverPay Order Resolution - Buildathon Demo",
        "customer": {
            "name": customer_name,
            "contact": phone,
        },
        "notify": {
            "sms": False,
            "email": False,
        },
    }

    try:
        response = client.payment_link.create(payload)
        short_url = response.get("short_url")
        logger.info("Payment link created: %s (ref=%s)", short_url, reference_id)
        return short_url
    except Exception as exc:
        logger.warning(
            "Razorpay API call failed for ref=%s: %s. Returning fallback URL.",
            reference_id,
            exc,
        )
        return f"https://rzp.io/i/test_{reference_id}"
