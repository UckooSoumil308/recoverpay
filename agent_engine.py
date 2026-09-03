"""
agent_engine.py — LangGraph-powered Autonomous Payment Recovery State Machine.

Nodes
-----
1. triage_node  : Classifies the failure and decides whether to escalate,
                  silently retry, or proceed to conversational outreach.
2. outreach_node: Generates a Razorpay payment link and drafts a personalised
                  recovery message in the customer's preferred language.

The compiled graph is exposed as ``recovery_engine``.
"""

from typing import Optional, TypedDict

from langgraph.graph import END, StateGraph

from razorpay_tool import generate_payment_link

# ---------------------------------------------------------------------------
# State Schema
# ---------------------------------------------------------------------------


class RecoveryState(TypedDict):
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


# ---------------------------------------------------------------------------
# Node 1 — Triage
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Node 2 — Outreach
# ---------------------------------------------------------------------------

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

# Human-friendly failure descriptions for the outreach message.
_FAILURE_FRIENDLY = {
    "INSUFFICIENT_FUNDS": "insufficient account balance",
    "MANDATE_EXPIRED": "expired UPI autopay mandate",
    "CHECKOUT_DROPOFF": "checkout was not completed",
    "GATEWAY_TIMEOUT": "a temporary bank issue",
}


def outreach_node(state: RecoveryState) -> RecoveryState:
    """Generate a payment link and draft a personalised recovery message."""
    # --- Payment link ---
    payment_link = generate_payment_link(
        amount_inr=state["amount_inr"],
        customer_name=state["customer_name"],
        phone=state["phone"],
        reference_id=state["transaction_id"],
    )

    # --- Compose message ---
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


# ---------------------------------------------------------------------------
# Graph Construction
# ---------------------------------------------------------------------------


def _route_after_triage(state: RecoveryState) -> str:
    """Conditional router: terminal statuses go to END, else to outreach."""
    if state["final_status"] in ("ESCALATED", "SCHEDULED_RETRY"):
        return "end"
    return "outreach_node"


# Build the state graph
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

# Compile into the runnable engine
recovery_engine = workflow.compile()
