# 🚀 RecoverPay — Autonomous AI Revenue Recovery Agent

RecoverPay is an intelligent, automated failed payment recovery system built for Indian merchants. It combines **LangGraph state machines**, **Google Gemini LLM**, **Razorpay Payments API**, and a modern **React dashboard** to triage failed transactions, engage customers with empathetic conversational outreach (Hinglish/English), and automate recovery workflows.

---

## ✨ Key Features

- 🤖 **LangGraph Autonomous Recovery Engine**: Intelligent multi-stage decision state machine that handles triage, silent retry, dynamic customer outreach, and escalation based on failure codes (e.g., `PAYMENT_TIMED_OUT`, `INSUFFICIENT_FUNDS`, `BANK_SYSTEM_ERROR`).
- 💬 **Gemini 2.0 Conversational Outreach**: Empathetic, culturally aware Hinglish responses that automatically classify customer intent (`PROMISE_TO_PAY`, `REQUEST_LINK`, `DISPUTE`, `GENERAL`), extract promised payment dates, and generate instant secure links.
- 💳 **Razorpay API Integration**: Automated generation of valid Razorpay payment links for quick one-click customer settlement with real-time test fallback.
- 📊 **Real-time Merchant Dashboard**: Interactive React + Vite frontend showcasing transaction statuses, live recovery metrics, recovery funnel, audit trail, and customer chat simulation.
- 🛡️ **Audit Logging & Idempotency**: Immutable logs for every autonomous decision and transaction state transition.

---

## 🏗️ Architecture & Tech Stack

```
recoverpay/
├── agent_engine.py         # LangGraph state machine & triage decision graph
├── api.py                  # FastAPI REST backend with Gemini LLM integration
├── database.py             # SQLite database layer & audit logging schema
├── razorpay_tool.py        # Razorpay API client & payment link generator
├── seed_data.py            # Synthetic data generator for realistic testing
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── frontend/               # React + Vite Dashboard
│   ├── src/
│   │   ├── components/     # UI components (KPI cards, tables, chat simulator)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── App.jsx         # Main application dashboard
│   │   └── index.css       # Tailwind/Modern UI styles
│   ├── package.json        # Frontend dependencies
│   └── vite.config.js      # Vite configuration
```

- **Backend**: Python 3.10+, FastAPI, Uvicorn, LangGraph, LangChain Core, Pydantic, SQLite
- **AI / LLM**: Google Gemini 2.0 Flash (`google-generativeai`)
- **Payments**: Razorpay Python SDK
- **Frontend**: React, Vite, Lucide Icons, Modern CSS

---

## ⚡ Quick Start Guide

### Prerequisites
- Python 3.10 or higher
- Node.js 18+ and npm
- (Optional) Razorpay Test API Keys
- (Optional) Google Gemini API Key

---

### 1. Backend Setup

1. **Clone the repository**:
   ```bash
   git clone <repository_url>
   cd recoverpay
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and insert your API credentials:
   ```bash
   # Windows (PowerShell)
   Copy-Item .env.example .env

   # Linux / macOS
   cp .env.example .env
   ```
   Edit `.env`:
   ```env
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   GEMINI_API_KEY=your_gemini_api_key
   ```
   *(Note: The system includes safe fallbacks for both Razorpay link generation and Gemini intent parsing if keys are omitted).*

5. **Seed the Database**:
   ```bash
   python seed_data.py
   ```

6. **Start the FastAPI Server**:
   ```bash
   uvicorn api:app --reload --port 8000
   ```
   API Docs will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### 2. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start Vite development server**:
   ```bash
   npm run dev
   ```
   The dashboard will be live at [http://localhost:5173](http://localhost:5173).

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/transactions` | List all transactions and their recovery states |
| `GET` | `/api/audit-logs` | Retrieve recent immutable agent audit logs |
| `POST` | `/api/run-batch` | Trigger LangGraph engine across all pending failed payments |
| `POST` | `/api/chat-simulate` | Simulate Hinglish conversational recovery with Gemini LLM |

---

## 🔒 Security Best Practices

- Real API credentials must **never** be committed to Git. The `.gitignore` excludes `.env`, `*.db`, `venv/`, and `node_modules/`.
- Always use Razorpay **Test Mode** (`rzp_test_...`) during development.

---

## 📄 License

This project is licensed under the MIT License.
