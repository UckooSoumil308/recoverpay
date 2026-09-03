# api.py
import json
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import google.generativeai as genai

from agent_engine import recovery_engine, chat_recovery_engine
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
# ---------------------------------------------------------------------------
# Multi-Agent Conversational Recovery Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/chat-simulate")
def chat_simulate(req: ChatRequest):
    """Invoke multi-agent LangGraph system with Gemini & fallback support."""

    conn = get_connection()
    cursor = conn.cursor()

    # Look up customer & transaction context from DB
    cursor.execute("SELECT * FROM transactions WHERE id = ?", (req.transaction_id,))
    row = cursor.fetchone()
    txn = dict(row) if row else {}

    customer_name = txn.get("customer_name", "Valued Customer")
    phone = txn.get("phone", "+919876543210")
    amount_inr = txn.get("amount_inr", 1499.0)
    failure_code = txn.get("failure_code", "GATEWAY_TIMEOUT")
    preferred_language = txn.get("preferred_language", "Hinglish")

    # Run Multi-Agent LangGraph System
    try:
        agent_state = {
            "transaction_id": req.transaction_id,
            "customer_name": customer_name,
            "phone": phone,
            "amount_inr": amount_inr,
            "failure_code": failure_code,
            "preferred_language": preferred_language,
            "message": req.message,
            "current_agent": "",
            "intent": "",
            "extracted_date": None,
            "draft_response": "",
            "compliance_flag": False,
            "compliance_notes": "",
            "payment_link": txn.get("payment_link"),
            "final_response": "",
            "reasoning": "",
        }

        result = chat_recovery_engine.invoke(agent_state)

        intent = result.get("intent", "GENERAL")
        extracted_date = result.get("extracted_date")
        reply_text = result.get("final_response") or result.get("draft_response")
        payment_link = result.get("payment_link")
        reasoning = result.get("reasoning", "")
        compliance_flag = result.get("compliance_flag", False)

    except Exception as agent_err:
        print(f"[AGENT ERROR] Multi-agent graph error: {agent_err}")
        # Rule-based fallback
        fallback = _fallback_response(req.message)
        intent = fallback["intent"]
        extracted_date = fallback.get("extracted_date")
        reply_text = fallback["reply_text"]
        payment_link = None
        reasoning = f"Fallback rule-based reply: {intent}"
        compliance_flag = False

    # Persist state & audit log to Database
    try:
        if intent == "PROMISE_TO_PAY":
            cursor.execute(
                """
                UPDATE transactions
                SET status = 'PROMISED_TO_PAY', promise_to_pay_date = ?
                WHERE id = ?
                """,
                (extracted_date, req.transaction_id),
            )
            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning)
                VALUES (?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    f"Customer promised to pay on {extracted_date or 'unspecified date'}",
                    reasoning or "Supervisor routed to Negotiator; Compliance approved.",
                ),
            )

        elif intent == "REQUEST_LINK":
            if payment_link:
                cursor.execute(
                    """
                    UPDATE transactions
                    SET payment_link = ?, status = 'CONTACTED'
                    WHERE id = ?
                    """,
                    (payment_link, req.transaction_id),
                )
            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning)
                VALUES (?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    f"Generated payment link: {payment_link or 'test link'}",
                    reasoning or "Supervisor routed to Payment node directly.",
                ),
            )

        elif intent == "DISPUTE":
            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning)
                VALUES (?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    "Customer raised payment dispute. Escalated to support.",
                    reasoning or "Dispute resolution response drafted and verified by Compliance.",
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
                    f"Conversational response: {req.message[:80]}...",
                    reasoning or "General conversational outreach.",
                ),
            )

        conn.commit()
    except Exception as db_err:
        print(f"[DB ERROR] {db_err}")
    finally:
        conn.close()

    return {
        "reply_text": reply_text,
        "intent": intent,
        "extracted_date": extracted_date,
        "payment_link": payment_link,
        "compliance_flag": compliance_flag,
    }
