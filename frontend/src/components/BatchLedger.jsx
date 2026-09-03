import React, { useState, useEffect } from 'react';
import { Zap, ExternalLink, MessageSquare, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const BatchLedger = ({
  transactions,
  setTransactions,
  onBatchComplete,
  highlightedTxnId,
  isLiveConnected,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedTxnId, setExpandedTxnId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/transactions`);
        const data = await res.json();
        setTransactions(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTransactions();
  }, [setTransactions]);

  const handleRunEngine = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await fetch(`${API_BASE}/api/run-batch`, { method: 'POST' });
      // Live updates arrive automatically via WebSocket!
      if (onBatchComplete) onBatchComplete();
    } catch (err) {
      console.error(err);
    }
    setIsProcessing(false);
  };

  const toggleRow = (id) => {
    setExpandedTxnId((prev) => (prev === id ? null : id));
  };

  const handleCopy = (text, id, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for status styling
  const getStatusStyle = (status) => {
    switch (status) {
      case 'RETRY_QUEUED':
      case 'SCHEDULED_RETRY':
        return { wrapper: 'bg-blue-500/10 text-blue-400 border-blue-500/20', dot: 'bg-blue-500 animate-pulse' };
      case 'CONTACTED':
        return { wrapper: 'bg-green-500/10 text-green-400 border-green-500/20', dot: 'bg-green-500' };
      case 'IN_PROGRESS':
        return { wrapper: 'bg-purple-500/10 text-purple-400 border-purple-500/20', dot: 'bg-purple-500 animate-pulse' };
      case 'PROMISED_TO_PAY':
        return { wrapper: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-500' };
      case 'ESCALATED':
        return { wrapper: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30', dot: 'bg-zinc-500' };
      case 'FAILED':
        return { wrapper: 'bg-red-500/10 text-red-400 border-red-500/30', dot: 'bg-red-500' };
      default:
        return { wrapper: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30', dot: 'bg-zinc-500' };
    }
  };

  const getFailureStyle = (code) => {
    if (!code) return 'text-zinc-400';
    if (code.includes('TIMEOUT')) return 'text-orange-400';
    if (code.includes('FUNDS') || code.includes('DROPOFF')) return 'text-red-400';
    return 'text-zinc-400';
  };

  return (
    <section id="batch-engine" className="py-32 px-6 relative border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tighter text-metallic mb-6">
            Batch Recovery Engine.
          </h2>
          <p className="text-xl text-zinc-500 font-light max-w-2xl mx-auto mb-8">
            Process failed transactions autonomously with contextual routing and smart outreach.
          </p>
          <button
            onClick={handleRunEngine}
            disabled={isProcessing}
            className={`shine-button h-14 px-8 mt-4 rounded-full text-base font-semibold transition-all shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] bg-white text-black hover:bg-zinc-100 mx-auto flex items-center gap-2 ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Zap className={`w-5 h-5 ${isProcessing ? 'text-zinc-500' : 'text-orange-500'}`} />
            {isProcessing ? 'Engine Running...' : 'Run Autonomous Batch Engine'}
          </button>

          <div
            className={`w-full max-w-2xl mx-auto mt-8 bg-zinc-900 h-2 rounded-full overflow-hidden ${
              isProcessing ? '' : 'hidden'
            }`}
          >
            <div
              className="bg-gradient-to-r from-orange-600 to-amber-400 h-full transition-all duration-1000 relative shadow-[0_0_15px_rgba(249,115,22,0.8)]"
              style={{ width: isProcessing ? '100%' : '0%' }}
            ></div>
          </div>
        </div>

        {/* Ledger Table Container */}
        <div className="w-full bg-[#0a0a0a] rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

          <div className="px-8 py-4 bg-[#111111]/80 border-b border-white/5 flex items-center justify-between text-xs text-zinc-400 font-mono">
            <div className="flex items-center gap-3">
              <span>💡 Click any transaction row to inspect payment links, outreach details & language preferences</span>
              {isLiveConnected && (
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live WebSocket Sync Active
                </span>
              )}
            </div>
            <span className="text-zinc-500 hidden sm:inline">{transactions.length} Total Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#111111] text-xs uppercase font-semibold text-zinc-500 border-b border-white/5">
                <tr>
                  <th className="px-6 py-5">TXN ID</th>
                  <th className="px-6 py-5">Customer</th>
                  <th className="px-6 py-5">Amount</th>
                  <th className="px-6 py-5">Failure Code</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5 text-right">Payment Link</th>
                  <th className="px-4 py-5 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[13px]">
                {transactions.map((txn) => {
                  const styles = getStatusStyle(txn.status);
                  const isExpanded = expandedTxnId === txn.id;
                  const isHighlighted = highlightedTxnId === txn.id;

                  return (
                    <React.Fragment key={txn.id}>
                      <tr
                        onClick={() => toggleRow(txn.id)}
                        className={`transition-all duration-500 cursor-pointer select-none ${
                          isHighlighted
                            ? 'ring-2 ring-orange-500/50 bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.3)] animate-pulse'
                            : isExpanded
                            ? 'bg-white/[0.03]'
                            : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <td className="px-6 py-5 text-zinc-400 font-mono text-xs">{txn.id}</td>
                        <td className="px-6 py-5 text-white font-sans font-medium">
                          {txn.customer_name}
                          <span className="block text-[11px] text-zinc-500 font-mono">{txn.phone}</span>
                        </td>
                        <td className="px-6 py-5">₹ {txn.amount_inr ? txn.amount_inr.toLocaleString() : '0'}</td>
                        <td className={`px-6 py-5 ${getFailureStyle(txn.failure_code)}`}>{txn.failure_code}</td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[10px] font-bold border tracking-wider ${styles.wrapper}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span>
                            {txn.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-sans">
                          {txn.payment_link ? (
                            <a
                              href={txn.payment_link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all font-mono shadow-sm"
                            >
                              <span>Open Link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-zinc-600 text-xs italic font-sans">—</span>
                          )}
                        </td>
                        <td className="px-4 py-5 text-zinc-500">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>

                      {/* Expandable Details Drawer */}
                      {isExpanded && (
                        <tr className="bg-[#0e0e0e] border-b border-white/5">
                          <td colSpan="7" className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                              {/* Left Column: Transaction Metadata */}
                              <div className="space-y-3 bg-[#141414] p-4 rounded-xl border border-white/5 text-xs">
                                <h4 className="text-xs uppercase font-semibold text-zinc-400 font-mono tracking-wider mb-2 flex items-center gap-1.5">
                                  <span>ℹ️ Transaction Details</span>
                                </h4>
                                <div className="flex justify-between border-b border-white/5 pb-2">
                                  <span className="text-zinc-500">Preferred Language:</span>
                                  <span className="text-zinc-200 font-medium">{txn.preferred_language || 'English'}</span>
                                </div>
                                <div className="flex justify-between border-b border-white/5 pb-2">
                                  <span className="text-zinc-500">Attempts Made:</span>
                                  <span className="text-zinc-200 font-mono">
                                    {txn.attempt_count} / {txn.max_attempts}
                                  </span>
                                </div>
                                <div className="flex justify-between border-b border-white/5 pb-2">
                                  <span className="text-zinc-500">Failure Reason:</span>
                                  <span className="text-zinc-200">{txn.failure_description || txn.failure_code}</span>
                                </div>
                                {txn.promise_to_pay_date && (
                                  <div className="flex justify-between border-b border-white/5 pb-2">
                                    <span className="text-purple-400">Promised Pay Date:</span>
                                    <span className="text-purple-200 font-mono">📅 {txn.promise_to_pay_date}</span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-1">
                                  <span className="text-zinc-500">Razorpay Link:</span>
                                  {txn.payment_link ? (
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-emerald-400 truncate max-w-[200px]">
                                        {txn.payment_link}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => handleCopy(txn.payment_link, txn.id, e)}
                                        className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                        title="Copy Link"
                                      >
                                        {copiedId === txn.id ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                      <a
                                        href={txn.payment_link}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1 rounded hover:bg-white/10 text-emerald-400 transition-colors"
                                        title="Open Link"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-600 italic">Not generated yet (run engine)</span>
                                  )}
                                </div>
                              </div>

                              {/* Right Column: Agent Outreach Message */}
                              <div className="bg-[#141414] p-4 rounded-xl border border-white/5 text-xs flex flex-col justify-between">
                                <div>
                                  <h4 className="text-xs uppercase font-semibold text-orange-400 font-mono tracking-wider mb-2 flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>Personalized Agent Outreach Message</span>
                                  </h4>
                                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 text-zinc-300 leading-relaxed text-[13px] whitespace-pre-wrap font-sans">
                                    {txn.payment_link ? (
                                      txn.preferred_language === 'Hinglish' || txn.preferred_language === 'hi-en' ? (
                                        `Hi ${txn.customer_name}! Aapka Rs. ${txn.amount_inr} ka payment process nahi ho paya (${txn.failure_code}). Tension mat lo — humne aapke liye ek secure payment link generate kiya hai:\n\n${txn.payment_link}\n\nYe link 24 ghante mein expire ho jayega. Koi issue ho toh reply karo!`
                                      ) : txn.preferred_language === 'Hindi' ? (
                                        `नमस्ते ${txn.customer_name}, आपका Rs. ${txn.amount_inr} का भुगतान प्रोसेस नहीं हो सका (${txn.failure_code})। हमने आपके लिए एक सुरक्षित भुगतान लिंक बनाया है:\n\n${txn.payment_link}\n\nयह लिंक 24 घंटे में समाप्त हो जाएगा।`
                                      ) : (
                                        `Hi ${txn.customer_name}, we noticed your payment of Rs. ${txn.amount_inr} could not be processed (${txn.failure_code}). We have generated a secure payment link for you:\n\n${txn.payment_link}\n\nThis link expires in 24 hours.`
                                      )
                                    ) : (
                                      <span className="text-zinc-500 italic">
                                        No outreach message sent yet. Click "Run Autonomous Batch Engine" above to trigger recovery.
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {txn.payment_link && (
                                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                                    <span>Ready for WhatsApp / SMS delivery</span>
                                    <a
                                      href={txn.payment_link}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-md transition-colors shadow-sm"
                                    >
                                      Test Payment Page ↗
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BatchLedger;
