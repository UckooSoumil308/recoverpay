import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const BatchLedger = ({ transactions, setTransactions, onBatchComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/transactions`);
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleRunEngine = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await fetch(`${API_BASE}/api/run-batch`, { method: 'POST' });
      await fetchTransactions();
      if (onBatchComplete) onBatchComplete();
    } catch (err) {
      console.error(err);
    }
    setIsProcessing(false);
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
      case 'ESCALATED':
        return { wrapper: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30', dot: 'bg-zinc-500' };
      case 'FAILED':
        return { wrapper: 'bg-red-500/10 text-red-400 border-red-500/30', dot: 'bg-red-500' };
      default:
        return { wrapper: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30', dot: 'bg-zinc-500' };
    }
  };

  const getFailureStyle = (code) => {
    if (code.includes('TIMEOUT')) return 'text-orange-400';
    if (code.includes('FUNDS') || code.includes('DROPOFF')) return 'text-red-400';
    return 'text-zinc-400';
  };

  return (
    <section id="batch-engine" className="py-32 px-6 relative border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tighter text-metallic mb-6">Batch Recovery Engine.</h2>
          <p className="text-xl text-zinc-500 font-light max-w-2xl mx-auto mb-8">
            Process failed transactions autonomously with contextual routing and smart outreach.
          </p>
          <button 
            onClick={handleRunEngine}
            disabled={isProcessing}
            className={`shine-button h-14 px-8 mt-4 rounded-full text-base font-semibold transition-all shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] bg-white text-black hover:bg-zinc-100 mx-auto flex items-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Zap className={`w-5 h-5 ${isProcessing ? 'text-zinc-500' : 'text-orange-500'}`} />
            {isProcessing ? 'Engine Running...' : 'Run Autonomous Batch Engine'}
          </button>
          
          <div className={`w-full max-w-2xl mx-auto mt-8 bg-zinc-900 h-2 rounded-full overflow-hidden ${isProcessing ? '' : 'hidden'}`}>
            <div 
              className="bg-gradient-to-r from-orange-600 to-amber-400 h-full transition-all duration-1000 relative shadow-[0_0_15px_rgba(249,115,22,0.8)]"
              style={{ width: isProcessing ? '100%' : '0%' }}
            ></div>
          </div>
        </div>

        <div className="w-full bg-[#0a0a0a] rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-[#111111] text-xs uppercase font-semibold text-zinc-500 border-b border-white/5">
              <tr>
                <th className="px-8 py-5">TXN ID</th>
                <th className="px-8 py-5">Customer</th>
                <th className="px-8 py-5">Amount</th>
                <th className="px-8 py-5">Failure Code</th>
                <th className="px-8 py-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[13px]">
              {transactions.map(txn => {
                const styles = getStatusStyle(txn.status);
                return (
                  <tr key={txn.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-5 text-zinc-400">{txn.id}</td>
                    <td className="px-8 py-5 text-white font-sans font-medium">{txn.customer_name}</td>
                    <td className="px-8 py-5">₹ {txn.amount_inr.toLocaleString()}</td>
                    <td className={`px-8 py-5 ${getFailureStyle(txn.failure_code)}`}>{txn.failure_code}</td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[10px] font-bold border tracking-wider ${styles.wrapper}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span>
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default BatchLedger;
