"""
seed_data.py — Phase 1: Synthetic Data Seeding for RecoverPay.

Generates 50 realistic failed Razorpay-style transactions and inserts them
into the `transactions` table.  Clears existing data before each run so the
script is safely idempotent.
"""

import random
import uuid

from faker import Faker

from database import get_connection, init_db

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

fake = Faker("en_IN")
Faker.seed(42)
random.seed(42)

NUM_RECORDS = 50

AMOUNT_OPTIONS = [499.0, 999.0, 1499.0, 1999.0, 2499.0, 4999.0, 9999.0]

FAILURE_SCENARIOS = [
    {
        "code": "GATEWAY_TIMEOUT",
        "desc": "Bank switch timeout",
        "lang": "English",
    },
    {
        "code": "INSUFFICIENT_FUNDS",
        "desc": "Account balance low for auto-debit",
        "lang": "Hinglish",
    },
    {
        "code": "MANDATE_EXPIRED",
        "desc": "UPI Autopay mandate token has expired",
        "lang": "Hindi",
    },
    {
        "code": "CHECKOUT_DROPOFF",
        "desc": "Customer abandoned checkout at OTP screen",
        "lang": "Hinglish",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_transaction() -> dict:
    """Return a single synthetic failed-transaction dict."""
    scenario = random.choice(FAILURE_SCENARIOS)
    txn_id = f"pay_{uuid.uuid4().hex[:16]}"
    phone = fake.phone_number()
    # Normalise to 10-digit Indian mobile prefixed with +91
    digits = "".join(ch for ch in phone if ch.isdigit())[-10:]
    phone_normalised = f"+91{digits}"

    return {
        "id": txn_id,
        "customer_name": fake.name(),
        "phone": phone_normalised,
        "amount_inr": random.choice(AMOUNT_OPTIONS),
        "failure_code": scenario["code"],
        "failure_description": scenario["desc"],
        "preferred_language": scenario["lang"],
        "status": "FAILED",
        "attempt_count": 0,
        "max_attempts": 2,
        "payment_link": f"https://rzp.io/i/{uuid.uuid4().hex[:8]}",
        "promise_to_pay_date": None,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def seed() -> None:
    """Clear existing data and insert 50 fresh failed transactions."""
    # Ensure schema exists
    init_db()

    conn = get_connection()
    cursor = conn.cursor()

    # Wipe previous data (audit_logs first due to FK constraint)
    cursor.execute("DELETE FROM audit_logs;")
    cursor.execute("DELETE FROM transactions;")
    conn.commit()

    # Generate and bulk-insert
    transactions = [_generate_transaction() for _ in range(NUM_RECORDS)]

    cursor.executemany(
        """
        INSERT INTO transactions (
            id, customer_name, phone, amount_inr,
            failure_code, failure_description, preferred_language,
            status, attempt_count, max_attempts,
            payment_link, promise_to_pay_date
        ) VALUES (
            :id, :customer_name, :phone, :amount_inr,
            :failure_code, :failure_description, :preferred_language,
            :status, :attempt_count, :max_attempts,
            :payment_link, :promise_to_pay_date
        );
        """,
        transactions,
    )

    conn.commit()

    # Quick sanity check
    count = cursor.execute("SELECT COUNT(*) FROM transactions;").fetchone()[0]
    conn.close()

    print(f"[OK] Seeded {count} failed transactions into recoverpay.db")


if __name__ == "__main__":
    seed()
