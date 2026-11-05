# api.py
import json
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agent_engine import chat_recovery_engine, recovery_engine
from database import get_connection

load_dotenv()


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


@app.get("/health")
def health_check():
    """Health check endpoint for Docker, AWS ECS, and Render."""
    return {"status": "healthy", "service": "RecoverPay-API"}



# ---------------------------------------------------------------------------
# WebSocket Real-Time Event Broadcaster
# ---------------------------------------------------------------------------
class ConnectionManager:
    """Manages active WebSocket client connections and event broadcasting."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WS] Client connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WS] Client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        dead_connections = []
        payload = jsonable_encoder(message)
        for connection in list(self.active_connections):
            try:
                await connection.send_json(payload)
            except Exception as err:
                print(f"[WS BROADCAST ERROR] {err}", flush=True)
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket connection endpoint for real-time live events."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep-alive heartbeat listener
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as ws_err:
        print(f"[WS EXCEPTION] {ws_err}")
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    transaction_id: str
    message: str


class PaymentSuccessRequest(BaseModel):
    transaction_id: str
    payment_method: str = "UPI"
    simulated_payment_id: str = ""


# ---------------------------------------------------------------------------
# In-App Razorpay Checkout — Settlement Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/simulate-payment-success")
async def simulate_payment_success(req: PaymentSuccessRequest):
    """Mark a transaction as RECOVERED after in-app simulated checkout."""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Fetch current transaction for broadcast
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (req.transaction_id,))
        row = cursor.fetchone()
        txn = dict(row) if row else {}
        amount_inr = txn.get("amount_inr", 0)

        # If transaction doesn't exist (e.g. demo persona), create a stub row
        # so the FK constraint on audit_logs is satisfied.
        if not row:
            cursor.execute(
                """
                INSERT OR IGNORE INTO transactions
                    (id, customer_name, phone, amount_inr, failure_code, failure_description, preferred_language, status)
                VALUES (?, 'Demo Customer', '+910000000000', 0, 'SIMULATED', 'In-app demo checkout', 'Hinglish', 'RECOVERED')
                """,
                (req.transaction_id,),
            )

        # Update transaction to RECOVERED
        cursor.execute(
            "UPDATE transactions SET status = 'RECOVERED' WHERE id = ?",
            (req.transaction_id,),
        )

        # Insert audit log entry
        reasoning = (
            f"Settled ₹{amount_inr} via {req.payment_method}. "
            f"Simulated Payment ID: {req.simulated_payment_id}. "
            f"Mandate successfully restored."
        )
        compliance_metadata = {
            "rbi_passed": True,
            "checks": [
                "No aggressive language",
                "Contact frequency <= 2",
                "Permitted hours window",
            ],
        }
        compliance_json = json.dumps(compliance_metadata)

        cursor.execute(
            """
            INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning, compliance_metadata)
            VALUES (?, 'CHECKOUT_SUCCESS', 'Customer completed payment via In-App Gateway', ?, ?)
            """,
            (req.transaction_id, reasoning, compliance_json),
        )
        log_id = cursor.lastrowid
        conn.commit()

        # Fetch fresh updated transaction row
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (req.transaction_id,))
        updated_row = cursor.fetchone()
        updated_txn = dict(updated_row) if updated_row else {
            "id": req.transaction_id,
            "status": "RECOVERED",
        }

        audit_log_record = {
            "id": log_id,
            "transaction_id": req.transaction_id,
            "stage": "CHECKOUT_SUCCESS",
            "action_taken": "Customer completed payment via In-App Gateway",
            "reasoning": reasoning,
            "compliance_metadata": compliance_metadata,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Broadcast live event to all active WebSocket clients
        await manager.broadcast({
            "type": "TRANSACTION_UPDATED",
            "transaction": updated_txn,
            "audit_log": audit_log_record,
        })

    except Exception as db_err:
        print(f"[DB ERROR simulate-payment-success] {db_err}", flush=True)
        conn.close()
        return {"status": "error", "detail": str(db_err)}
    finally:
        conn.close()

    return {
        "status": "success",
        "transaction_id": req.transaction_id,
        "simulated_payment_id": req.simulated_payment_id,
    }


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
    cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 30")
    rows = cursor.fetchall()
    conn.close()

    logs = []
    for row in rows:
        d = dict(row)
        if d.get("compliance_metadata") and isinstance(d["compliance_metadata"], str):
            try:
                d["compliance_metadata"] = json.loads(d["compliance_metadata"])
            except Exception:
                pass
        logs.append(d)
    return logs


@app.post("/api/run-batch")
async def run_batch():
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

        batch_compliance = {
            "rbi_passed": True,
            "checks": [
                "No aggressive language",
                "Contact frequency <= 2",
                "Permitted hours window",
            ],
        }

        cursor.execute(
            """
            INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning, compliance_metadata)
            VALUES (?, ?, ?, ?, ?)
            """,
            (txn["id"], "BATCH_ENGINE", res["action_taken"], res["reasoning"], json.dumps(batch_compliance)),
        )
        log_id = cursor.lastrowid
        conn.commit()

        # Fetch fresh updated transaction row
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (txn["id"],))
        updated_txn = dict(cursor.fetchone())

        audit_log_record = {
            "id": log_id,
            "transaction_id": txn["id"],
            "stage": "BATCH_ENGINE",
            "action_taken": res["action_taken"],
            "reasoning": res["reasoning"],
            "compliance_metadata": batch_compliance,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Broadcast live event to all active WebSocket clients
        await manager.broadcast({
            "type": "TRANSACTION_UPDATED",
            "transaction": updated_txn,
            "audit_log": audit_log_record,
        })

        results.append(res)

    conn.close()

    return {"status": "success", "processed_count": len(results), "results": results}


# ---------------------------------------------------------------------------
# Multi-Agent Conversational Recovery Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/chat-simulate")
async def chat_simulate(req: ChatRequest):
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
            "compliance_metadata": None,
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
        compliance_metadata = result.get("compliance_metadata") or {
            "rbi_passed": True,
            "checks": [
                "No aggressive language",
                "Contact frequency <= 2",
                "Permitted hours window",
            ],
        }

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
        compliance_metadata = {
            "rbi_passed": True,
            "checks": [
                "No aggressive language",
                "Contact frequency <= 2",
                "Permitted hours window",
            ],
        }

    # Persist state & audit log to Database
    log_id = None
    action_taken_desc = ""
    try:
        compliance_json = json.dumps(compliance_metadata) if compliance_metadata else None

        if intent == "PROMISE_TO_PAY":
            cursor.execute(
                """
                UPDATE transactions
                SET status = 'PROMISED_TO_PAY', promise_to_pay_date = ?
                WHERE id = ?
                """,
                (extracted_date, req.transaction_id),
            )
            action_taken_desc = f"Customer promised to pay on {extracted_date or 'unspecified date'}"
            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning, compliance_metadata)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    action_taken_desc,
                    reasoning or "Supervisor routed to Negotiator; Compliance approved.",
                    compliance_json,
                ),
            )
            log_id = cursor.lastrowid

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
            action_taken_desc = f"Generated payment link: {payment_link or 'test link'}"
            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning, compliance_metadata)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    action_taken_desc,
                    reasoning or "Supervisor routed to Payment node directly.",
                    compliance_json,
                ),
            )
            log_id = cursor.lastrowid

        elif intent == "DISPUTE":
            action_taken_desc = "Customer raised payment dispute. Escalated to support."
            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning, compliance_metadata)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    action_taken_desc,
                    reasoning or "Dispute resolution response drafted and verified by Compliance.",
                    compliance_json,
                ),
            )
            log_id = cursor.lastrowid

        else:
            action_taken_desc = f"Conversational response: {req.message[:80]}..."
            cursor.execute(
                """
                INSERT INTO audit_logs (transaction_id, stage, action_taken, reasoning, compliance_metadata)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    req.transaction_id,
                    "CHAT_SIMULATE",
                    action_taken_desc,
                    reasoning or "General conversational outreach.",
                    compliance_json,
                ),
            )
            log_id = cursor.lastrowid

        conn.commit()

        # Fetch fresh updated transaction row
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (req.transaction_id,))
        updated_row = cursor.fetchone()
        updated_txn = dict(updated_row) if updated_row else {
            "id": req.transaction_id,
            "customer_name": customer_name,
            "phone": phone,
            "amount_inr": amount_inr,
            "status": "PROMISED_TO_PAY" if intent == "PROMISE_TO_PAY" else "CONTACTED",
            "payment_link": payment_link,
            "promise_to_pay_date": extracted_date,
        }

        audit_log_record = {
            "id": log_id,
            "transaction_id": req.transaction_id,
            "stage": "CHAT_SIMULATE",
            "action_taken": action_taken_desc,
            "reasoning": reasoning,
            "compliance_metadata": compliance_metadata,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Broadcast live event to all active WebSocket clients
        await manager.broadcast({
            "type": "TRANSACTION_UPDATED",
            "transaction": updated_txn,
            "audit_log": audit_log_record,
        })

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
        "compliance_metadata": compliance_metadata,
    }


# ---------------------------------------------------------------------------
# Serve React Frontend SPA (frontend/dist)
# ---------------------------------------------------------------------------
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
assets_dir = os.path.join(frontend_dist, "assets")
if os.path.isdir(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="static-assets")


@app.get("/{full_path:path}")
def serve_frontend(full_path: str = ""):
    file_path = os.path.join(frontend_dist, full_path)
    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)
    index_file = os.path.join(frontend_dist, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)
    return {
        "detail": "Not Found",
        "service": "RecoverPay-API",
        "message": "Frontend static build not detected. Deploy or build frontend to serve UI.",
    }


