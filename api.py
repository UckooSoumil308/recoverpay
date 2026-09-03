# api.py
import json
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import google.generativeai as genai

from agent_engine import recovery_engine
from database import get_connection

load_dotenv()

# ---------------------------------------------------------------------------
# Gemini LLM Configuration
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

SYSTEM_PROMPT = """You are RecoverPay Collections Assistant — a polite, empathetic AI agent that helps recover failed payments for Indian customers. You converse in Hinglish (Hindi + English mixed). You NEVER threaten or harass customers.

STRICT RULES:
1. Analyze the customer message and classify the intent.
2. You MUST reply with a raw JSON object ONLY. No markdown, no backticks, no explanation outside the JSON.
3. The JSON must have EXACTLY these three keys:

{
  "intent": "<one of: PROMISE_TO_PAY, REQUEST_LINK, DISPUTE, GENERAL>",
  "extracted_date": "<ISO 8601 date string if customer mentions a date/time, otherwise null>",
  "reply_text": "<your empathetic Hinglish reply to the customer>"
}

INTENT RULES:
- PROMISE_TO_PAY: Customer says they will pay later (kal, parso, weekend, salary aane pe, next week, specific date, etc.)
- REQUEST_LINK: Customer asks for a new payment link, or asks about UPI/GPay/PhonePe/Paytm options.
- DISPUTE: Customer claims money was deducted but order failed, or questions about refund/UTR.
- GENERAL: Everything else (greetings, questions about the link, security concerns, etc.)

DATE EXTRACTION:
- "kal" or "tomorrow" → tomorrow's date in ISO format
- "parso" or "day after tomorrow" → day after tomorrow
- "weekend" → next Saturday
- "1st" or "taareekh" → the mentioned date of current/next month
- If no date is mentioned → null

REPLY RULES:
- Always be warm, friendly, and use Hinglish naturally.
- Use emojis sparingly (1-2 max).
- If intent is REQUEST_LINK, include a mock link: rzp.io/i/recover_{random_4_chars}
- If intent is PROMISE_TO_PAY, confirm the date and mention you'll set a reminder.
- If intent is DISPUTE, assure them you're checking and ask for 24-48 hours.
- Keep replies concise (2-3 sentences max).

IMPORTANT: Output ONLY the raw JSON. No other text before or after it."""


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(title="RecoverPay API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    transaction_id: str
    message: str


# ---------------------------------------------------------------------------
# Default fallback when LLM fails
# ---------------------------------------------------------------------------
def _fallback_response(user_message: str) -> dict:
    """Rule-based fallback if Gemini is unreachable or returns bad JSON."""
    msg_lower = user_message.lower()

    # Simple keyword-based intent classification
    if any(w in msg_lower for w in ["kal", "parso", "salary", "tomorrow", "weekend", "next week", "monday", "1st", "taareekh"]):
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        return {
            "intent": "PROMISE_TO_PAY",
            "extracted_date": tomorrow,
            "reply_text": f"Theek hai! Maine {tomorrow} tak ka reminder set kar diya hai. Aapka link tab tak valid rahega. 🗓️",
        }
    elif any(w in msg_lower for w in ["link", "gpay", "phonePe", "paytm", "upi", "bhej", "send"]):
        return {
            "intent": "REQUEST_LINK",
            "extracted_date": None,
            "reply_text": "Bilkul! Aapke liye ek naya secure payment link generate kar raha hoon: rzp.io/i/recover_fb8k — GPay, PhonePe, Paytm sab kaam karega! 💳",
        }
    elif any(w in msg_lower for w in ["deduct", "cut", "kaat", "refund", "utr"]):
        return {
            "intent": "DISPUTE",
            "extracted_date": None,
            "reply_text": "Aapki chinta samajh sakte hain. Humne aapka case priority queue mein daala hai — 24-48 ghante mein poora update milega. 🙏",
        }
    else:
        return {
            "intent": "GENERAL",
            "extracted_date": None,
            "reply_text": "Ji zaroor! RecoverPay AI Agent yahan hai aapki madad ke liye. Koi bhi sawaal ho toh poochiye! 😊",
        }


# ---------------------------------------------------------------------------
# Existing Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/transactions")
def get_transactions():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.get("/api/audit-logs")
def get_audit_logs():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 15")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/run-batch")
def run_batch():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM transactions WHERE status = 'FAILED'")
    failed_txns = cursor.fetchall()

    results = []

    for row in failed_txns:
        txn = dict(row)

        initial_state = {
            "transaction_id": txn["id"],
            "customer_name": txn["customer_name"],
            "phone": txn["phone"],
            "amount_inr": txn["amount_inr"],
            "failure_code": txn["failure_code"],
            "preferred_language": txn["preferred_language"],
            "attempt_count": txn["attempt_count"],
            "max_attempts": txn["max_attempts"],
            "action_taken": "",
            "reasoning": "",
            "payment_link": None,
            "final_status": "FAILED",
        }

        res = recovery_engine.invoke(initial_state)

        cursor.execute(
            """
            UPDATE transactions
            SET status = ?, attempt_count = attempt_count + 1, payment_link = ?
            WHERE id = ?
            """,
            (res["final_status"], res.get("payment_link"), txn["id"]),
        )

        cursor.execute(
            """
            INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning)
            VALUES (?, ?, ?, ?)
            """,
            (txn["id"], "BATCH_ENGINE", res["action_taken"], res["reasoning"]),
        )

        results.append(res)

    conn.commit()
    conn.close()

    return {"status": "success", "processed_count": len(results), "results": results}


# ---------------------------------------------------------------------------
# NEW: LLM-Powered Chat Simulate Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/chat-simulate")
def chat_simulate(req: ChatRequest):
    """Invoke Gemini to classify intent, extract date, and draft a Hinglish reply."""

    parsed = None

    # ------ Step 1: Call Gemini LLM ------
    try:
        response = gemini_model.generate_content(
            [
                {"role": "user", "parts": [SYSTEM_PROMPT]},
                {"role": "model", "parts": ['{"intent": "GENERAL", "extracted_date": null, "reply_text": "Ready to help."}']},
                {"role": "user", "parts": [f"Customer message: {req.message}"]},
            ]
        )

        raw_text = response.text.strip()

        # Strip markdown code fences if the LLM wraps them anyway
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1]  # remove first line
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

        parsed = json.loads(raw_text)

        # Validate required keys
        if not all(k in parsed for k in ("intent", "extracted_date", "reply_text")):
            raise ValueError("Missing required keys in LLM response")

        # Clamp intent to known values
        valid_intents = {"PROMISE_TO_PAY", "REQUEST_LINK", "DISPUTE", "GENERAL"}
        if parsed["intent"] not in valid_intents:
            parsed["intent"] = "GENERAL"

    except Exception as e:
        print(f"[LLM ERROR] Gemini failed or returned bad JSON: {e}")
        parsed = _fallback_response(req.message)

    # ------ Step 2: Database Side-Effects ------
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if parsed["intent"] == "PROMISE_TO_PAY":
            cursor.execute(
                """
                UPDATE transactions
                SET status = 'PROMISED_TO_PAY', promise_to_pay_date = ?
                WHERE id = ?
                """,
                (parsed.get("extracted_date"), req.transaction_id),
            )

            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning)
                VALUES (?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    f"Customer promised to pay. Date: {parsed.get('extracted_date', 'unspecified')}",
                    f"Intent: {parsed['intent']}. AI drafted empathetic Hinglish follow-up with reminder confirmation.",
                ),
            )

        elif parsed["intent"] == "REQUEST_LINK":
            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning)
                VALUES (?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    "Customer requested a new payment link. Link regenerated.",
                    f"Intent: {parsed['intent']}. AI provided fresh Razorpay recovery link.",
                ),
            )

        elif parsed["intent"] == "DISPUTE":
            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning)
                VALUES (?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    "Customer raised a payment dispute. Case escalated for review.",
                    f"Intent: {parsed['intent']}. AI acknowledged dispute and assured 24-48h resolution.",
                ),
            )

        else:
            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning)
                VALUES (?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    f"General conversation. Customer said: {req.message[:100]}",
                    f"Intent: {parsed['intent']}. Standard conversational response.",
                ),
            )

        conn.commit()
    except Exception as db_err:
        print(f"[DB ERROR] {db_err}")
    finally:
        conn.close()

    # ------ Step 3: Return to Frontend ------
    return {
        "reply_text": parsed["reply_text"],
        "intent": parsed["intent"],
        "extracted_date": parsed.get("extracted_date"),
    }
