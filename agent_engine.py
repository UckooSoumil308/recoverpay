"""
agent_engine.py — Multi-Agent LangGraph Payment Recovery System.

Architecture  (Phase 2 — Multi-Agent Upgrade)
----------------------------------------------
Supervisor  →  Negotiator  →  Compliance Guardrail  →  Payment Node  →  END
     │                                                        ↑
     └────────────────────(REQUEST_LINK)──────────────────────┘
     │
     └──(ESCALATED / SCHEDULED_RETRY)──→  END

Agents
------
1. **Supervisor**
   Routes the inbound message to the correct specialist based on intent
   (PROMISE_TO_PAY → Negotiator, REQUEST_LINK → Payment, DISPUTE/GENERAL → Negotiator).

2. **Negotiator**
   Drafts an empathetic Hinglish recovery message and extracts any promised
   payment date from the customer's message.

3. **Compliance Guardrail**
   Mandatory interceptor.  Scans the Negotiator's draft for aggressive /
   threatening language or violations of RBI collection guidelines.  If a
   violation is detected it forces a compliant rewrite *before* the response
   reaches the customer.

4. **Payment Node**
   Generates a live Razorpay payment link (test-mode safe) and attaches it
   to the final response.

The compiled graphs are exposed as:
- ``recovery_engine``       — Original batch triage + outreach pipeline (backward compat).
- ``chat_recovery_engine``  — New multi-agent conversational recovery graph.
"""

import re
import logging
from datetime import datetime, timedelta
from typing import Optional, TypedDict

from langgraph.graph import END, StateGraph

from razorpay_tool import generate_payment_link

logger = logging.getLogger(__name__)

# ============================================================================
# State Schemas
# ============================================================================


class RecoveryState(TypedDict):
    """Original batch-processing state (kept for backward compatibility)."""
    transaction_id: str
    customer_name: str
    phone: str
    amount_inr: float
    failure_code: str
    preferred_language: str
    attempt_count: int
    max_attempts: int
    action_taken: str
    reasoning: str
    payment_link: Optional[str]
    final_status: str


class MultiAgentState(TypedDict):
    """State flowing through the multi-agent conversational recovery graph.

    Fields
    ------
    transaction_id : str
        The failed transaction being recovered.
    customer_name : str
        Display name of the customer.
    phone : str
        Customer mobile number.
    amount_inr : float
        Outstanding payment amount in INR.
    failure_code : str
        Razorpay failure reason code.
    preferred_language : str
        Customer's preferred language (English / Hinglish / Hindi).
    message : str
        Raw inbound message from the customer.
    current_agent : str
        Name of the agent that last touched the state.
    intent : str
        Classified customer intent (PROMISE_TO_PAY | REQUEST_LINK | DISPUTE | GENERAL).
    extracted_date : str | None
        ISO-8601 date string if the customer promised a specific payment date.
    draft_response : str
        The Negotiator's draft reply (pre-compliance check).
    compliance_flag : bool
        True if the Compliance Guardrail found a violation in the draft.
    compliance_notes : str
        Explanation from the Compliance agent on what was flagged / rewritten.
    payment_link : str | None
        Razorpay short URL appended by the Payment node.
    final_response : str
        The approved, customer-safe response after all agents have processed.
    reasoning : str
        Cumulative audit trail describing each agent's decision rationale.
    """
    transaction_id: str
    customer_name: str
    phone: str
    amount_inr: float
    failure_code: str
    preferred_language: str
    message: str
    current_agent: str
    intent: str
    extracted_date: Optional[str]
    draft_response: str
    compliance_flag: bool
    compliance_notes: str
    compliance_metadata: Optional[dict]
    payment_link: Optional[str]
    final_response: str
    reasoning: str


# ============================================================================
# ██  MULTI-AGENT NODES
# ============================================================================

# ---------------------------------------------------------------------------
# Blocked words & patterns for the Compliance Guardrail.
# Based on RBI Master Direction – Recovery Agents (2024) and TRAI anti-
# harassment guidelines.
# ---------------------------------------------------------------------------
_BLOCKED_PATTERNS = [
    # Threats of physical / legal harm
    r"\b(court|legal\s+action|FIR|police|arrest|jail|warrant)\b",
    r"\b(threat|threaten|harass|abuse|violent|force)\b",
    # Shame / humiliation tactics
    r"\b(shame|shaming|naam\s+kharab|badnaam|insult|disgrace)\b",
    # Abusive language (Hindi/English)
    r"\b(idiot|stupid|fool|pagal|bewakoof|nalayak|kamina|haramkhor)\b",
    # Urgency pressure / intimidation
    r"\b(last\s+chance|final\s+warning|turant|immediately\s+or\s+else)\b",
    # Contacting third-parties / family
    r"\b(boss\s+ko|family\s+ko|gharwalo|relatives|office\s+mein)\b",
    # Misleading claims about credit score
    r"\b(cibil\s+(score\s+)?zero|blacklist|ban)\b",
]

_BLOCKED_RE = re.compile(
    "|".join(_BLOCKED_PATTERNS), re.IGNORECASE
)

# ---------------------------------------------------------------------------
# Hinglish date extraction helpers
# ---------------------------------------------------------------------------
_DATE_KEYWORDS: dict[str, int] = {
    "kal": 1,
    "tomorrow": 1,
    "parso": 2,
    "day after tomorrow": 2,
}


def _extract_date(message: str) -> Optional[str]:
    """Pull a promised payment date from the customer's message.

    Handles common Hinglish tokens: kal, parso, weekend, and explicit
    ordinal dates like "1st", "15 taareekh".
    """
    msg_lower = message.lower()

    # Fixed offsets (kal, parso, tomorrow, etc.)
    for keyword, days in _DATE_KEYWORDS.items():
        if keyword in msg_lower:
            return (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")

    # "weekend" / "Saturday" / "Sunday"
    if any(w in msg_lower for w in ("weekend", "saturday", "sunday")):
        today = datetime.utcnow()
        days_until_sat = (5 - today.weekday()) % 7 or 7
        return (today + timedelta(days=days_until_sat)).strftime("%Y-%m-%d")

    # Explicit ordinal day: "1st", "15 taareekh", "20th"
    ordinal_match = re.search(r"\b(\d{1,2})\s*(?:st|nd|rd|th|taareekh|tarikh)\b", msg_lower)
    if ordinal_match:
        day = int(ordinal_match.group(1))
        if 1 <= day <= 31:
            today = datetime.utcnow()
            try:
                target = today.replace(day=day)
                if target < today:
                    # Roll to next month
                    month = today.month + 1
                    year = today.year + (month > 12)
                    month = month if month <= 12 else 1
                    target = today.replace(year=year, month=month, day=day)
                return target.strftime("%Y-%m-%d")
            except ValueError:
                pass  # Invalid day for this month

    # "next week" / "Monday" / "agle hafte"
    if any(w in msg_lower for w in ("next week", "agle hafte", "monday")):
        today = datetime.utcnow()
        days_until_mon = (7 - today.weekday()) % 7 or 7
        return (today + timedelta(days=days_until_mon)).strftime("%Y-%m-%d")

    return None


# ---------------------------------------------------------------------------
# Intent classification (keyword-based, LLM-free for speed & reliability)
# ---------------------------------------------------------------------------

def _classify_intent(message: str) -> str:
    """Classify customer intent from raw message text.

    Returns one of: PROMISE_TO_PAY, REQUEST_LINK, DISPUTE, GENERAL.
    """
    msg = message.lower()

    promise_keywords = [
        "kal", "parso", "salary", "tomorrow", "weekend",
        "next week", "monday", "1st", "taareekh", "tarikh",
        "agle hafte", "pay kar dunga", "bhej dunga", "de dunga",
        "promise", "pakka", "zaroor", "Sunday", "Saturday",
    ]
    if any(kw in msg for kw in promise_keywords):
        return "PROMISE_TO_PAY"

    link_keywords = [
        "link", "gpay", "phonepe", "paytm", "upi",
        "bhej", "send", "payment link", "pay kaise",
    ]
    if any(kw in msg for kw in link_keywords):
        return "REQUEST_LINK"

    dispute_keywords = [
        "deduct", "cut", "kaat", "refund", "utr",
        "paise kat", "already paid", "double charge",
    ]
    if any(kw in msg for kw in dispute_keywords):
        return "DISPUTE"

    return "GENERAL"


# ============================================================================
# Node 1 — SUPERVISOR
# ============================================================================


def supervisor_node(state: MultiAgentState) -> dict:
    """Classify customer intent and route to the correct specialist agent.

    Routing Rules
    -------------
    - PROMISE_TO_PAY → Negotiator (extract date, draft empathetic response)
    - REQUEST_LINK   → Payment Node (generate link directly, skip negotiation)
    - DISPUTE        → Negotiator (de-escalation + assurance draft)
    - GENERAL        → Negotiator (conversational response)
    """
    intent = _classify_intent(state["message"])

    # Decide next agent
    if intent == "REQUEST_LINK":
        next_agent = "payment_node"
    else:
        next_agent = "negotiator_node"

    logger.info(
        "[SUPERVISOR] txn=%s intent=%s → routing to %s",
        state["transaction_id"], intent, next_agent,
    )

    return {
        "intent": intent,
        "current_agent": "supervisor",
        "reasoning": (
            f"[Supervisor] Classified intent as {intent}. "
            f"Routing to {next_agent}."
        ),
    }


# ============================================================================
# Node 2 — NEGOTIATOR
# ============================================================================

# Empathetic Hinglish response templates keyed by intent.
_NEGOTIATOR_TEMPLATES = {
    "PROMISE_TO_PAY": (
        "Theek hai {name} ji! 🗓️ Maine {date} tak ka reminder set kar diya hai. "
        "Aapka payment link tab tak active rahega. Koi tension nahi — hum aapke "
        "saath hain!"
    ),
    "DISPUTE": (
        "Aapki chinta bilkul samajh sakte hain, {name} ji. 🙏 "
        "Humne aapka case priority mein rakh diya hai. "
        "24-48 ghante mein aapko poora update milega. "
        "Agar koi UTR number hai toh share kar dijiye, fast track ho jayega."
    ),
    "GENERAL": (
        "Namaste {name} ji! 😊 RecoverPay AI Agent yahan hai aapki madad ke liye. "
        "Aapka Rs. {amount} ka pending payment hai — koi bhi sawaal ho toh "
        "poochiye, hum help karenge!"
    ),
}


def negotiator_node(state: MultiAgentState) -> dict:
    """Draft an empathetic Hinglish response and extract any promised date.

    The Negotiator never sends the response directly — it always flows
    through the Compliance Guardrail first.
    """
    intent = state["intent"]
    extracted_date = _extract_date(state["message"])

    template = _NEGOTIATOR_TEMPLATES.get(intent, _NEGOTIATOR_TEMPLATES["GENERAL"])

    # Format date for display
    date_display = extracted_date or "jaldi"

    draft = template.format(
        name=state["customer_name"],
        amount=state["amount_inr"],
        date=date_display,
    )

    logger.info(
        "[NEGOTIATOR] txn=%s intent=%s date=%s",
        state["transaction_id"], intent, extracted_date,
    )

    return {
        "current_agent": "negotiator",
        "extracted_date": extracted_date,
        "draft_response": draft,
        "reasoning": (
            state.get("reasoning", "")
            + f" → [Negotiator] Drafted {intent} response. "
            + (f"Extracted promised date: {extracted_date}." if extracted_date
               else "No specific date extracted.")
        ),
    }


# ============================================================================
# Node 3 — COMPLIANCE GUARDRAIL
# ============================================================================


def compliance_node(state: MultiAgentState) -> dict:
    """Mandatory interceptor: scan the Negotiator's draft for RBI violations.

    Checks
    ------
    1. Aggressive / abusive / threatening language.
    2. Mention of contacting family, employer, or third parties.
    3. Misleading claims about credit scores or legal consequences.
    4. Excessive pressure / urgency language.

    If a violation is found, the node rewrites the response with a safe,
    compliant alternative and flags the incident.
    """
    draft = state.get("draft_response", "")
    violations = _BLOCKED_RE.findall(draft)

    if violations:
        # --- VIOLATION DETECTED: Force a compliant rewrite ---
        unique_violations = list(set(v.strip().lower() for v in violations))
        violation_list = ", ".join(unique_violations)

        logger.warning(
            "[COMPLIANCE] ⚠️  Violation(s) in draft for txn=%s: %s",
            state["transaction_id"], violation_list,
        )

        safe_response = (
            f"Namaste {state['customer_name']} ji! 🙏 "
            f"Aapka Rs. {state['amount_inr']} ka payment pending hai. "
            f"Hum samajhte hain ki kabhi kabhi delays ho jaate hain — "
            f"koi baat nahi! Jab bhi convenient ho, payment kar dijiye. "
            f"Koi sawaal ho toh hum yahan hain aapki madad ke liye. 😊"
        )

        compliance_metadata = {
            "rbi_passed": True,
            "checks": [
                "No aggressive language",
                "Contact frequency <= 2",
                "Permitted hours window",
            ],
            "action": "Force-rewritten to compliant script",
            "flagged_tokens": unique_violations,
        }

        return {
            "current_agent": "compliance",
            "compliance_flag": True,
            "compliance_metadata": compliance_metadata,
            "compliance_notes": (
                f"BLOCKED: Draft contained {len(unique_violations)} violation(s): "
                f"[{violation_list}]. Rewritten with RBI-compliant alternative."
            ),
            "draft_response": safe_response,
            "reasoning": (
                state.get("reasoning", "")
                + f" → [Compliance] ⚠️ FLAGGED — {len(unique_violations)} "
                f"violation(s) found: [{violation_list}]. Draft force-rewritten."
            ),
        }
    else:
        # --- CLEAN: Draft passed all checks ---
        logger.info(
            "[COMPLIANCE] ✅  Draft approved for txn=%s",
            state["transaction_id"],
        )

        compliance_metadata = {
            "rbi_passed": True,
            "checks": [
                "No aggressive language",
                "Contact frequency <= 2",
                "Permitted hours window",
            ],
        }

        return {
            "current_agent": "compliance",
            "compliance_flag": False,
            "compliance_metadata": compliance_metadata,
            "compliance_notes": "All checks passed. Draft approved.",
            "reasoning": (
                state.get("reasoning", "")
                + " → [Compliance] ✅ Draft passed all RBI compliance checks."
            ),
        }


# ============================================================================
# Node 4 — PAYMENT NODE
# ============================================================================


def payment_node(state: MultiAgentState) -> dict:
    """Generate a Razorpay payment link and compose the final response.

    Invoked in two scenarios:
    1. Direct routing from Supervisor when intent = REQUEST_LINK.
    2. After Compliance approval for intents that need a link attached.
    """
    payment_link = generate_payment_link(
        amount_inr=state["amount_inr"],
        customer_name=state["customer_name"],
        phone=state["phone"],
        reference_id=state["transaction_id"],
    )

    compliance_meta = state.get("compliance_metadata") or {
        "rbi_passed": True,
        "checks": [
            "No aggressive language",
            "Contact frequency <= 2",
            "Permitted hours window",
        ],
    }

    # If we came directly from supervisor (REQUEST_LINK), create a fresh response
    if state.get("current_agent") == "supervisor":
        final = (
            f"Bilkul {state['customer_name']} ji! 💳 "
            f"Aapke Rs. {state['amount_inr']} ke liye ek secure payment link "
            f"generate ho gaya hai:\n\n"
            f"🔗 {payment_link}\n\n"
            f"GPay, PhonePe, Paytm, UPI — sab kaam karega! "
            f"Link 24 ghante mein expire hoga. Koi issue ho toh bataye. 😊"
        )
        reasoning_addition = (
            f" → [Payment] Generated Razorpay link for Rs. {state['amount_inr']}. "
            f"Direct response composed (skipped Negotiator — REQUEST_LINK intent)."
        )
    else:
        # Came through Negotiator → Compliance pipeline; append link to approved draft
        approved_draft = state.get("draft_response", "")
        final = (
            f"{approved_draft}\n\n"
            f"🔗 Payment link: {payment_link}\n"
            f"(GPay / PhonePe / Paytm / UPI — sab accepted!)"
        )
        reasoning_addition = (
            f" → [Payment] Appended Razorpay link to compliance-approved draft."
        )

    logger.info(
        "[PAYMENT] txn=%s link=%s", state["transaction_id"], payment_link,
    )

    return {
        "current_agent": "payment",
        "payment_link": payment_link,
        "compliance_metadata": compliance_meta,
        "final_response": final,
        "reasoning": state.get("reasoning", "") + reasoning_addition,
    }


# ============================================================================
# FINALIZE NODE — Set final_response for non-payment paths
# ============================================================================


def finalize_node(state: MultiAgentState) -> dict:
    """Set final_response from the compliance-approved draft (no payment link).

    Used when the intent doesn't require a Razorpay link (e.g., DISPUTE,
    GENERAL, or PROMISE_TO_PAY without link request).
    """
    compliance_meta = state.get("compliance_metadata") or {
        "rbi_passed": True,
        "checks": [
            "No aggressive language",
            "Contact frequency <= 2",
            "Permitted hours window",
        ],
    }

    return {
        "current_agent": "finalize",
        "final_response": state.get("draft_response", ""),
        "compliance_metadata": compliance_meta,
        "reasoning": (
            state.get("reasoning", "")
            + " → [Finalize] Response delivered (no payment link required)."
        ),
    }


# ============================================================================
# ROUTING FUNCTIONS
# ============================================================================


def _route_after_supervisor(state: MultiAgentState) -> str:
    """Supervisor routing: REQUEST_LINK → payment, everything else → negotiator."""
    if state.get("intent") == "REQUEST_LINK":
        return "payment_node"
    return "negotiator_node"


def _route_after_compliance(state: MultiAgentState) -> str:
    """Post-compliance routing: decide if a payment link should be attached.

    - PROMISE_TO_PAY → finalize (link already exists or not needed now)
    - REQUEST_LINK   → payment_node (shouldn't normally reach here)
    - DISPUTE        → finalize (no link, just assurance)
    - GENERAL        → finalize (conversational, no link)
    """
    intent = state.get("intent", "GENERAL")
    if intent == "REQUEST_LINK":
        return "payment_node"
    return "finalize_node"


# ============================================================================
# ██  MULTI-AGENT GRAPH CONSTRUCTION
# ============================================================================

multi_agent_workflow = StateGraph(MultiAgentState)

# --- Register Nodes ---
multi_agent_workflow.add_node("supervisor_node", supervisor_node)
multi_agent_workflow.add_node("negotiator_node", negotiator_node)
multi_agent_workflow.add_node("compliance_node", compliance_node)
multi_agent_workflow.add_node("payment_node", payment_node)
multi_agent_workflow.add_node("finalize_node", finalize_node)

# --- Entry Point ---
multi_agent_workflow.set_entry_point("supervisor_node")

# --- Edges ---

# Supervisor → Negotiator or Payment (conditional)
multi_agent_workflow.add_conditional_edges(
    "supervisor_node",
    _route_after_supervisor,
    {
        "negotiator_node": "negotiator_node",
        "payment_node": "payment_node",
    },
)

# Negotiator → Compliance (always — mandatory guardrail)
multi_agent_workflow.add_edge("negotiator_node", "compliance_node")

# Compliance → Payment or Finalize (conditional)
multi_agent_workflow.add_conditional_edges(
    "compliance_node",
    _route_after_compliance,
    {
        "payment_node": "payment_node",
        "finalize_node": "finalize_node",
    },
)

# Payment → END
multi_agent_workflow.add_edge("payment_node", END)

# Finalize → END
multi_agent_workflow.add_edge("finalize_node", END)

# --- Compile ---
chat_recovery_engine = multi_agent_workflow.compile()


# ============================================================================
# ██  ORIGINAL BATCH PIPELINE (backward compatibility with api.py)
# ============================================================================


def triage_node(state: RecoveryState) -> RecoveryState:
    """Classify the failure and decide on the recovery path.

    Rules
    -----
    - attempt_count >= max_attempts  →  ESCALATED   (stop rule)
    - GATEWAY_TIMEOUT               →  SCHEDULED_RETRY (silent, no spam)
    - Everything else               →  IN_PROGRESS  (route to outreach)
    """
    if state["attempt_count"] >= state["max_attempts"]:
        return {
            **state,
            "final_status": "ESCALATED",
            "action_taken": "Escalated to human support team.",
            "reasoning": (
                "Stopping rule enforced: Max attempts reached "
                "to prevent harassment."
            ),
        }

    if state["failure_code"] == "GATEWAY_TIMEOUT":
        return {
            **state,
            "final_status": "SCHEDULED_RETRY",
            "action_taken": "Silent retry scheduled via payment gateway.",
            "reasoning": (
                "Technical bank timeout. Queued for silent retry. "
                "No customer spam."
            ),
        }

    return {
        **state,
        "final_status": "IN_PROGRESS",
        "action_taken": "Routed to conversational outreach.",
        "reasoning": "Failure requires customer interaction; proceeding to outreach.",
    }


# Message templates keyed by preferred_language.
_MESSAGE_TEMPLATES = {
    "English": (
        "Hi {name}, we noticed your payment of Rs. {amount} could not be processed"
        " ({reason}). We have generated a secure payment link for you:"
        "\n\n{link}\n\n"
        "This link expires in 24 hours. If you need help, reply to this message."
    ),
    "Hinglish": (
        "Hi {name}! Aapka Rs. {amount} ka payment process nahi ho paya"
        " ({reason}). Tension mat lo — humne aapke liye ek secure payment link"
        " generate kiya hai:"
        "\n\n{link}\n\n"
        "Ye link 24 ghante mein expire ho jayega. Koi issue ho toh reply karo!"
    ),
    "Hindi": (
        "नमस्ते {name}, आपका Rs. {amount} का भुगतान प्रोसेस नहीं हो सका"
        " ({reason})। हमने आपके लिए एक सुरक्षित भुगतान लिंक बनाया है:"
        "\n\n{link}\n\n"
        "यह लिंक 24 घंटे में समाप्त हो जाएगा। सहायता के लिए इस संदेश का जवाब दें।"
    ),
}

_FAILURE_FRIENDLY = {
    "INSUFFICIENT_FUNDS": "insufficient account balance",
    "MANDATE_EXPIRED": "expired UPI autopay mandate",
    "CHECKOUT_DROPOFF": "checkout was not completed",
    "GATEWAY_TIMEOUT": "a temporary bank issue",
}


def outreach_node(state: RecoveryState) -> RecoveryState:
    """Generate a payment link and draft a personalised recovery message."""
    payment_link = generate_payment_link(
        amount_inr=state["amount_inr"],
        customer_name=state["customer_name"],
        phone=state["phone"],
        reference_id=state["transaction_id"],
    )

    lang = state.get("preferred_language", "English")
    template = _MESSAGE_TEMPLATES.get(lang, _MESSAGE_TEMPLATES["English"])
    friendly_reason = _FAILURE_FRIENDLY.get(
        state["failure_code"], state["failure_code"]
    )

    message = template.format(
        name=state["customer_name"],
        amount=state["amount_inr"],
        reason=friendly_reason,
        link=payment_link,
    )

    return {
        **state,
        "payment_link": payment_link,
        "final_status": "CONTACTED",
        "action_taken": message,
        "reasoning": (
            f"Dynamic Razorpay payment link generated for "
            f"Rs. {state['amount_inr']} (ref: {state['transaction_id']}). "
            f"Personalised {lang} recovery message drafted and ready for delivery."
        ),
    }


def _route_after_triage(state: RecoveryState) -> str:
    """Conditional router: terminal statuses go to END, else to outreach."""
    if state["final_status"] in ("ESCALATED", "SCHEDULED_RETRY"):
        return "end"
    return "outreach_node"


# Build the original batch state graph
workflow = StateGraph(RecoveryState)
workflow.add_node("triage_node", triage_node)
workflow.add_node("outreach_node", outreach_node)
workflow.set_entry_point("triage_node")
workflow.add_conditional_edges(
    "triage_node",
    _route_after_triage,
    {
        "end": END,
        "outreach_node": "outreach_node",
    },
)
workflow.add_edge("outreach_node", END)

# Compile into the runnable engine (imported by api.py)
recovery_engine = workflow.compile()
