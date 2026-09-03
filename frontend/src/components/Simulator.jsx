import React, { useState, useRef, useEffect } from 'react';
import { Phone, Smile, Send, Volume2, Square, Sparkles, Bot, Loader2 } from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';

const API_BASE = 'http://127.0.0.1:8000';

const SIMULATION_PERSONAS = [
  {
    id: 'pay_f89s2a',
    name: 'Amit Kumar',
    initials: 'AK',
    amount: '₹ 2,499',
    failureCode: 'GATEWAY_TIMEOUT',
    lang: 'hi-en',
    openingMessage:
      'Hi Amit! Aapka ₹ 2,499 ka payment bank server timeout ke karan fail ho gaya. Humne aapke liye ek secure recovery link generate kiya hai.',
  },
  {
    id: 'pay_7hx93p',
    name: 'Priya Patel',
    initials: 'PP',
    amount: '₹ 999',
    failureCode: 'INSUFFICIENT_FUNDS',
    lang: 'hi',
    openingMessage:
      'नमस्ते प्रिया! आपका ₹ 999 का भुगतान असफल रहा (अपर्याप्त बैलेंस)। कृपया नीचे दिए गए सुरक्षित रेज़रपे लिंक से पुनः प्रयास करें।',
  },
  {
    id: 'pay_m4l9x2',
    name: 'Rahul Sharma',
    initials: 'RS',
    amount: '₹ 1,499',
    failureCode: 'CHECKOUT_DROPOFF',
    lang: 'hi-en',
    openingMessage:
      'Namaste Rahul! Aapka ₹ 1,499 ka checkout poora nahi ho paya. Tension mat lo — humne aapke liye ek secure payment link generate kiya hai.',
  },
];

const Simulator = () => {
  const [selectedPersona, setSelectedPersona] = useState(SIMULATION_PERSONAS[0]);
  const [customInput, setCustomInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'agent-init',
      sender: 'agent',
      text: SIMULATION_PERSONAS[0].openingMessage,
      hasCta: true,
      intent: null,
    },
  ]);

  const chatEndRef = useRef(null);
  const { speak, stop, isSpeaking, activeSpeechId } = useSpeech();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handlePersonaChange = (personaId) => {
    const persona = SIMULATION_PERSONAS.find((p) => p.id === personaId) || SIMULATION_PERSONAS[0];
    setSelectedPersona(persona);
    stop();
    setMessages([
      {
        id: `agent-init-${persona.id}`,
        sender: 'agent',
        text: persona.openingMessage,
        hasCta: true,
        intent: null,
      },
    ]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!customInput.trim() || isTyping) return;

    const userText = customInput.trim();
    setCustomInput('');

    // Append user message immediately
    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text: userText, intent: null };
    setMessages((prev) => [...prev, userMsg]);

    // Show typing indicator
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat-simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: selectedPersona.id,
          message: userText,
        }),
      });

      const data = await res.json();

      const agentMsg = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: data.reply_text,
        intent: data.intent,
        extractedDate: data.extracted_date,
        hasCta: data.intent === 'REQUEST_LINK',
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      console.error('Chat simulate error:', err);
      const fallbackMsg = {
        id: `agent-err-${Date.now()}`,
        sender: 'agent',
        text: 'Oops! Server se connection nahi ho paya. Thodi der baad dobara try karein. 🙏',
        intent: 'ERROR',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleSpeakMessage = (msgId, text) => {
    const speechKey = `sim-${msgId}`;
    if (isSpeaking && activeSpeechId === speechKey) {
      stop();
    } else {
      speak(text, selectedPersona.lang, speechKey);
    }
  };

  const getIntentBadge = (intent) => {
    if (!intent) return null;
    const badges = {
      PROMISE_TO_PAY: { label: '🗓️ Promise to Pay', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
      REQUEST_LINK: { label: '🔗 Link Request', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
      DISPUTE: { label: '⚠️ Dispute', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
      GENERAL: { label: '💬 General', cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
      ERROR: { label: '❌ Error', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
    };
    const badge = badges[intent] || badges.GENERAL;
    return (
      <span className={`inline-flex items-center text-[9px] font-mono px-1.5 py-0.5 rounded border ${badge.cls}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col items-center lg:items-start">
      <div className="mb-6 flex flex-col items-center lg:items-start">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-2xl font-medium text-white">AI Chat Simulator</h3>
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            <Sparkles className="w-3 h-3" /> Gemini LLM Powered
          </span>
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
            <Volume2 className="w-3 h-3" /> Read Aloud
          </span>
        </div>
        <p className="text-zinc-500 text-sm mt-1">
          Test live AI intent classification, date extraction, and Hinglish recovery conversations.
        </p>
      </div>

      <div className="w-[350px] sm:w-[380px] h-[670px] border-[10px] border-[#1f2937] rounded-[3rem] bg-[#0b141a] overflow-hidden flex flex-col relative shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="bg-[#202c33] p-3.5 flex items-center justify-between border-b border-white/5 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-black font-bold text-sm shadow-md">
              {selectedPersona.initials}
            </div>
            <div className="flex flex-col">
              <select
                value={selectedPersona.id}
                onChange={(e) => handlePersonaChange(e.target.value)}
                className="bg-transparent text-white outline-none text-sm font-semibold cursor-pointer appearance-none pr-4"
              >
                {SIMULATION_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#1e293b] text-white">
                    {p.name} ({p.amount})
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                RecoverPay Agent Online
              </span>
            </div>
          </div>
          <Phone className="w-4 h-4 text-zinc-400" />
        </div>

        {/* Chat Stream */}
        <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto relative text-[14px] custom-scrollbar">
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              backgroundImage:
                "url('data:image/svg+xml,%3Csvg width=\\'100\\' height=\\'100\\' viewBox=\\'0 0 100 100\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cpath d=\\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z\\' fill=\\'%23ffffff\\' fill-opacity=\\'1\\' fill-rule=\\'evenodd\\'/%3E%3C/svg%3E')",
              backgroundSize: '240px',
            }}
          ></div>

          {messages.map((msg) => {
            const isAgent = msg.sender === 'agent';
            const speechKey = `sim-${msg.id}`;
            const isThisSpeaking = isSpeaking && activeSpeechId === speechKey;

            return (
              <div
                key={msg.id}
                className={`group relative p-3 rounded-2xl shadow-md z-10 leading-relaxed transition-all max-w-[88%] ${
                  isAgent
                    ? 'bg-[#202c33] text-[#e9edef] self-start rounded-tl-none border border-white/5'
                    : 'bg-[#005c4b] text-[#e9edef] self-end rounded-tr-none'
                } ${isThisSpeaking ? 'ring-2 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-[13.5px] whitespace-pre-wrap">{msg.text}</p>

                  {/* Read Aloud Button */}
                  <button
                    type="button"
                    onClick={() => toggleSpeakMessage(msg.id, msg.text)}
                    className={`shrink-0 p-1.5 rounded-full transition-all ${
                      isThisSpeaking
                        ? 'bg-orange-500 text-black shadow-md'
                        : 'text-zinc-400 hover:text-orange-300 hover:bg-white/10'
                    }`}
                    title={isThisSpeaking ? 'Stop' : 'Listen'}
                  >
                    {isThisSpeaking ? (
                      <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Sound wave animation */}
                {isThisSpeaking && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-orange-300">
                    <span className="w-1 h-2 bg-orange-400 animate-[bounce_0.6s_infinite_100ms] rounded-full"></span>
                    <span className="w-1 h-3.5 bg-orange-400 animate-[bounce_0.6s_infinite_200ms] rounded-full"></span>
                    <span className="w-1 h-2 bg-orange-400 animate-[bounce_0.6s_infinite_300ms] rounded-full"></span>
                    <span className="ml-1 text-orange-200">Playing voice note...</span>
                  </div>
                )}

                {/* Agent Intent Badge */}
                {isAgent && msg.intent && (
                  <div className="mt-2 flex items-center gap-2">
                    {getIntentBadge(msg.intent)}
                    {msg.extractedDate && (
                      <span className="text-[9px] font-mono text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                        📅 {msg.extractedDate}
                      </span>
                    )}
                  </div>
                )}

                {/* Razorpay CTA */}
                {msg.hasCta && (
                  <a
                    href="#batch-engine"
                    className="block mt-2.5 px-4 py-2 bg-[#00a884] hover:bg-[#008f6f] text-white text-center font-medium rounded-xl text-xs transition-colors shadow-sm active:scale-95"
                  >
                    Pay {selectedPersona.amount} via Razorpay
                  </a>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2.5 p-3 bg-[#202c33] rounded-2xl rounded-tl-none max-w-[70%] self-start z-10 border border-white/5 shadow-md">
              <Bot className="w-4 h-4 text-orange-400 animate-pulse" />
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-zinc-400 animate-[bounce_1s_infinite_0ms]"></span>
                <span className="w-2 h-2 rounded-full bg-zinc-400 animate-[bounce_1s_infinite_200ms]"></span>
                <span className="w-2 h-2 rounded-full bg-zinc-400 animate-[bounce_1s_infinite_400ms]"></span>
              </div>
              <span className="text-xs text-zinc-400 font-mono ml-1">AI analyzing...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Footer */}
        <form onSubmit={handleSendMessage} className="bg-[#202c33] p-2.5 flex gap-2 items-center z-10 border-t border-white/5">
          <div className="flex-1 bg-[#2a3942] rounded-full px-3.5 py-2 flex items-center gap-2">
            <Smile className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Type message to test AI..."
              className="bg-transparent text-white outline-none w-full text-xs placeholder:text-zinc-500"
              disabled={isTyping}
            />
          </div>
          <button
            type="submit"
            disabled={isTyping || !customInput.trim()}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition-all shadow-md active:scale-90 flex-shrink-0 ${
              isTyping || !customInput.trim()
                ? 'bg-zinc-600 cursor-not-allowed'
                : 'bg-[#00a884] hover:bg-[#008f6f]'
            }`}
          >
            {isTyping ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 ml-0.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Simulator;
