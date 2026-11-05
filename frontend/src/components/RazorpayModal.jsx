import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, CreditCard, Building2, Smartphone, ChevronRight, Shield } from 'lucide-react';
import { API_BASE } from '../config';

/**
 * Generate a simulated Razorpay payment ID.
 * Format: pay_live_XXXXXXXXXXXX (12 random alphanumeric chars)
 */
const generatePaymentId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'pay_live_';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * Inline SVG logos for payment method icons (no external deps).
 */
const GPayIcon = () => (
  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-white/20">
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  </div>
);

const PhonePeIcon = () => (
  <div className="w-10 h-10 rounded-xl bg-[#5f259f] flex items-center justify-center shadow-sm">
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
      <path d="M11.02 3.77l-4.7 16.46h3.33l1.45-5.48h3.12c3.08 0 5.48-1.88 6.18-4.73.7-2.86-.82-5.24-3.9-5.24h-5.48zm4.18 2.86c1.18 0 1.82.68 1.52 2 -.3 1.32-1.28 2-2.46 2h-2.2l1.08-4h2.06z" />
    </svg>
  </div>
);

const PaytmIcon = () => (
  <div className="w-10 h-10 rounded-xl bg-[#00baf2] flex items-center justify-center shadow-sm">
    <span className="text-white font-bold text-[9px] tracking-tighter">Paytm</span>
  </div>
);

const VisaIcon = () => (
  <div className="w-10 h-10 rounded-xl bg-[#1a1f71] flex items-center justify-center shadow-sm">
    <span className="text-white font-bold text-xs italic tracking-wider">VISA</span>
  </div>
);

const MastercardIcon = () => (
  <div className="w-10 h-10 rounded-xl bg-[#2b2b2b] flex items-center justify-center shadow-sm relative overflow-hidden">
    <div className="flex items-center -space-x-1.5">
      <div className="w-4 h-4 rounded-full bg-[#eb001b] opacity-90"></div>
      <div className="w-4 h-4 rounded-full bg-[#f79e1b] opacity-90"></div>
    </div>
  </div>
);

const RupayIcon = () => (
  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#097969] to-[#1d7a6d] flex items-center justify-center shadow-sm">
    <span className="text-white font-bold text-[8px] tracking-tight">RuPay</span>
  </div>
);

// ──────────────────────────────────────────────────────────────────
// Payment Tab Content
// ──────────────────────────────────────────────────────────────────

const UPITab = ({ selectedUpi, setSelectedUpi }) => (
  <div className="space-y-2.5">
    <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-3">Select UPI App</p>
    {[
      { id: 'gpay', label: 'Google Pay', Icon: GPayIcon },
      { id: 'phonepe', label: 'PhonePe', Icon: PhonePeIcon },
      { id: 'paytm', label: 'Paytm', Icon: PaytmIcon },
    ].map(({ id, label, Icon }) => (
      <button
        key={id}
        type="button"
        onClick={() => setSelectedUpi(id)}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 group ${
          selectedUpi === id
            ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
            : 'bg-white/[0.03] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.05]'
        }`}
      >
        <Icon />
        <span className={`text-sm font-medium ${selectedUpi === id ? 'text-white' : 'text-slate-300'}`}>
          {label}
        </span>
        <ChevronRight
          className={`w-4 h-4 ml-auto transition-all ${
            selectedUpi === id ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'
          }`}
        />
      </button>
    ))}
  </div>
);

const CardsTab = ({ selectedCard, setSelectedCard }) => (
  <div className="space-y-2.5">
    <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-3">Debit / Credit Card</p>
    <div className="flex gap-3 mb-4">
      {[
        { id: 'visa', Icon: VisaIcon },
        { id: 'mastercard', Icon: MastercardIcon },
        { id: 'rupay', Icon: RupayIcon },
      ].map(({ id, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setSelectedCard(id)}
          className={`p-1 rounded-xl border-2 transition-all ${
            selectedCard === id
              ? 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
              : 'border-transparent hover:border-white/10'
          }`}
        >
          <Icon />
        </button>
      ))}
    </div>
    {/* Simulated card input fields */}
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Card Number"
        defaultValue="•••• •••• •••• 4242"
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors font-mono"
        readOnly
      />
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="MM/YY"
          defaultValue="12/27"
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors font-mono"
          readOnly
        />
        <input
          type="text"
          placeholder="CVV"
          defaultValue="•••"
          className="w-20 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors font-mono"
          readOnly
        />
      </div>
    </div>
  </div>
);

const NetbankingTab = () => (
  <div className="space-y-2.5">
    <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-3">Popular Banks</p>
    {['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank'].map((bank) => (
      <div
        key={bank}
        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.05] transition-all cursor-pointer group"
      >
        <Building2 className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{bank}</span>
        <ChevronRight className="w-4 h-4 ml-auto text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
    ))}
  </div>
);


// ──────────────────────────────────────────────────────────────────
// Main Modal Component
// ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'cards', label: 'Cards', icon: CreditCard },
  { id: 'netbanking', label: 'Netbanking', icon: Building2 },
];

const METHOD_LABELS = {
  upi: { gpay: 'Google Pay (UPI)', phonepe: 'PhonePe (UPI)', paytm: 'Paytm (UPI)' },
  cards: { visa: 'Visa Card', mastercard: 'Mastercard', rupay: 'RuPay Card' },
  netbanking: 'Netbanking',
};

const RazorpayModal = ({ isOpen, onClose, transactionId, amountInr, customerName, onPaymentSuccess }) => {
  const [activeTab, setActiveTab] = useState('upi');
  const [selectedUpi, setSelectedUpi] = useState('gpay');
  const [selectedCard, setSelectedCard] = useState('visa');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [simulatedPayId, setSimulatedPayId] = useState('');


  // Escape key to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isProcessing, onClose]);

  const getPaymentMethod = useCallback(() => {
    if (activeTab === 'upi') return METHOD_LABELS.upi[selectedUpi] || 'UPI';
    if (activeTab === 'cards') return METHOD_LABELS.cards[selectedCard] || 'Card';
    return 'Netbanking';
  }, [activeTab, selectedUpi, selectedCard]);

  const handlePay = async () => {
    if (isProcessing || paymentSuccess) return;
    setIsProcessing(true);

    const payId = generatePaymentId();
    const method = getPaymentMethod();

    try {
      const res = await fetch(`${API_BASE}/api/simulate-payment-success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          payment_method: method,
          simulated_payment_id: payId,
        }),
      });

      const data = await res.json();

      if (data.status === 'success') {
        setSimulatedPayId(payId);
        setPaymentSuccess(true);
        // Notify parent component
        if (onPaymentSuccess) {
          onPaymentSuccess({ paymentId: payId, method, transactionId });
        }
        // Auto-close after 2s
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        console.error('Payment simulation failed:', data);
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Payment simulation error:', err);
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const formattedAmount = typeof amountInr === 'number'
    ? `₹ ${amountInr.toLocaleString('en-IN')}`
    : amountInr || '₹ 0';

  const orderId = `order_${transactionId?.replace('pay_', '') || 'demo'}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
        onClick={!isProcessing ? onClose : undefined}
      />

      {/* Modal Container */}
      <div className="relative w-[420px] max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-white/[0.08] animate-[scaleIn_0.3s_ease] custom-scrollbar"
           style={{ background: 'linear-gradient(180deg, #0c2340 0%, #0c0f1d 40%)' }}>

        {/* ─── Success Overlay ──────────────────────────────── */}
        {paymentSuccess && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0f1d]/95 backdrop-blur-md rounded-2xl">
            {/* Animated checkmark ring */}
            <div className="relative w-24 h-24 mb-5">
              <svg viewBox="0 0 100 100" className="w-full h-full animate-[scaleIn_0.4s_ease]">
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray="283"
                  strokeDashoffset="0"
                  className="animate-[circleReveal_0.6s_ease-out]"
                  style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
                />
                <path
                  d="M30 50 L45 65 L70 35"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="60"
                  strokeDashoffset="0"
                  className="animate-[checkDraw_0.5s_ease-out_0.3s_both]"
                />
              </svg>
              {/* Glow */}
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse"></div>
            </div>
            <p className="text-emerald-400 font-semibold text-lg mb-1">Payment Successful!</p>
            <p className="text-slate-400 text-sm font-mono">{simulatedPayId}</p>
            <p className="text-slate-500 text-xs mt-3">{formattedAmount} • {getPaymentMethod()}</p>
          </div>
        )}

        {/* ─── Header ──────────────────────────────────────── */}
        <div className="p-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Razorpay brand badge */}
              <div className="w-10 h-10 rounded-xl bg-[#0066cc] flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                  <path d="M7.358 0L1.2 22.586h5.104l1.727-6.324h5.14L7.358 0z" />
                  <path d="M14.624 7.5l-2.55 9.218h5.026L22.8 0h-5.104l-3.072 7.5z" opacity="0.7" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">RecoverPay Demo Merchant</p>
                <p className="text-slate-500 text-[11px] font-mono mt-0.5">Order #{orderId}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={!isProcessing ? onClose : undefined}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Amount & customer row */}
          <div className="flex items-center justify-between bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
            <div>
              <p className="text-slate-400 text-[10px] uppercase tracking-widest font-medium">Amount Due</p>
              <p className="text-white text-2xl font-bold tracking-tight mt-0.5">{formattedAmount}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-[10px] uppercase tracking-widest font-medium">Customer</p>
              <p className="text-slate-200 text-sm font-medium mt-0.5">{customerName || 'Customer'}</p>
            </div>
          </div>
        </div>

        {/* ─── Payment Method Tabs ─────────────────────────── */}
        <div className="px-5 pt-4">
          <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.05]">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 ${
                  activeTab === id
                    ? 'bg-[#0066cc] text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Tab Content ─────────────────────────────────── */}
        <div className="px-5 pt-4 pb-2 min-h-[180px]">
          {activeTab === 'upi' && <UPITab selectedUpi={selectedUpi} setSelectedUpi={setSelectedUpi} />}
          {activeTab === 'cards' && <CardsTab selectedCard={selectedCard} setSelectedCard={setSelectedCard} />}
          {activeTab === 'netbanking' && <NetbankingTab />}
        </div>

        {/* ─── Pay Button ──────────────────────────────────── */}
        <div className="px-5 pb-4 pt-2">
          <button
            type="button"
            onClick={handlePay}
            disabled={isProcessing || paymentSuccess}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
              isProcessing || paymentSuccess
                ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#0066cc] to-[#0088ff] hover:from-[#0055bb] hover:to-[#0077ee] text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98]'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Payment...</span>
              </>
            ) : paymentSuccess ? (
              <span>Payment Complete ✓</span>
            ) : (
              <span>Simulate Successful Payment — {formattedAmount}</span>
            )}
          </button>
        </div>

        {/* ─── Footer Security Badge ───────────────────────── */}
        <div className="px-5 pb-5 flex items-center justify-center gap-2 text-[10px] text-slate-600">
          <Shield className="w-3 h-3 text-emerald-600" />
          <span>Secured by <strong className="text-slate-500">Razorpay</strong> • PCI DSS Compliant</span>
        </div>
      </div>

      {/* ─── CSS Keyframes (scoped via style tag) ─────────── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes circleReveal {
          from { stroke-dashoffset: 283; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 60; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};

export default RazorpayModal;
