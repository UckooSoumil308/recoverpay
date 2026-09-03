import React, { useState, useRef, useEffect } from 'react';
import {
  Phone,
  Smile,
  Send,
  Volume2,
  VolumeX,
  Square,
  Sparkles,
  Bot,
  Loader2,
  Mic,
  MicOff,
  Radio,
  ExternalLink,
} from 'lucide-react';
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
    paymentLink: 'https://rzp.io/i/test_pay_f89s2a',
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
    paymentLink: 'https://rzp.io/i/test_pay_7hx93p',
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
    paymentLink: 'https://rzp.io/i/test_pay_m4l9x2',
    openingMessage:
      'Namaste Rahul! Aapka ₹ 1,499 ka checkout poora nahi ho paya. Tension mat lo — humne aapke liye ek secure payment link generate kiya hai.',
  },
];

const Simulator = () => {
  const [selectedPersona, setSelectedPersona] = useState(SIMULATION_PERSONAS[0]);
  const [customInput, setCustomInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [autoTtsEnabled, setAutoTtsEnabled] = useState(true);
  const [messages, setMessages] = useState([
    {
      id: 'agent-init',
      sender: 'agent',
      text: SIMULATION_PERSONAS[0].openingMessage,
      hasCta: true,
      paymentLink: SIMULATION_PERSONAS[0].paymentLink,
      intent: null,
    },
  ]);

  const chatEndRef = useRef(null);
  const baseInputRef = useRef('');
  const pressTimerRef = useRef(null);

  // Two-way Voice Hook
  const {
    speak,
    stop,
    isSpeaking,
    activeSpeechId,
    isListening,
    startListening,
    stopListening,
    hasRecognitionSupport,
  } = useSpeech();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isListening]);

  // Persona switch handler
  const handlePersonaChange = (personaId) => {
    const persona = SIMULATION_PERSONAS.find((p) => p.id === personaId) || SIMULATION_PERSONAS[0];
    setSelectedPersona(persona);
    stop();
    stopListening();
    setMessages([
      {
        id: `agent-init-${persona.id}`,
        sender: 'agent',
        text: persona.openingMessage,
        hasCta: true,
        paymentLink: persona.paymentLink,
        intent: null,
      },
    ]);
  };

  // Submit message to backend AI
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!customInput.trim() || isTyping) return;

    const userText = customInput.trim();
    setCustomInput('');
    stopListening();

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

      // Extract payment link if returned or embedded
      const returnedLink =
        data.payment_link ||
        (data.reply_text && data.reply_text.match(/https?:\/\/[^\s]+/)?.[0]) ||
        (data.intent === 'REQUEST_LINK' ? selectedPersona.paymentLink : null);

      const agentMsgId = `agent-${Date.now()}`;
      const agentMsg = {
        id: agentMsgId,
        sender: 'agent',
        text: data.reply_text,
        intent: data.intent,
        extractedDate: data.extracted_date,
        hasCta: Boolean(returnedLink || data.intent === 'REQUEST_LINK'),
        paymentLink: returnedLink || selectedPersona.paymentLink,
      };

      setMessages((prev) => [...prev, agentMsg]);

      // OUTPUT (Text-to-Speech):
      // Automatically read response aloud using hi-IN Hindi voice profile for authenticity
      if (autoTtsEnabled && data.reply_text) {
        speak(data.reply_text, 'hi-IN', `sim-${agentMsgId}`);
      }
    } catch (err) {
      console.error('Chat simulate error:', err);
      const fallbackMsg = {
        id: `agent-err-${Date.now()}`,
        sender: 'agent',
        text: 'Oops! Server se connection nahi ho paya. Thodi der baad dobara try karein. 🙏',
        intent: 'ERROR',
        hasCta: false,
      };
      setMessages((prev) => [...prev, fallbackMsg]);

      if (autoTtsEnabled) {
        speak(fallbackMsg.text, 'hi-IN', `sim-${fallbackMsg.id}`);
      }
    } finally {
      setIsTyping(false);
    }
  };

  // Quick prompt chip click handler
  const handleQuickPrompt = (promptText) => {
    setCustomInput(promptText);
  };

  // INPUT (Speech-to-Text): Hold to Speak handlers
  const handleMicDown = (e) => {
    if (e && e.cancelable) e.preventDefault();
    if (isTyping) return;

    baseInputRef.current = customInput ? customInput.trim() + ' ' : '';
    pressTimerRef.current = Date.now();

    startListening({
      lang: 'hi-IN',
      onTranscript: (spokenText) => {
        setCustomInput(`${baseInputRef.current}${spokenText}`);
      },
    });
  };

  const handleMicUp = (e) => {
    if (e && e.cancelable) e.preventDefault();
    stopListening();
  };

  const handleMicLeave = () => {
    if (isListening) {
      stopListening();
    }
  };

  // Click toggle fallback for mic
  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      baseInputRef.current = customInput ? customInput.trim() + ' ' : '';
      startListening({
        lang: 'hi-IN',
        onTranscript: (spokenText) => {
          setCustomInput(`${baseInputRef.current}${spokenText}`);
        },
      });
    }
  };

  // Toggle manual speech playback for any message bubble
  const toggleSpeakMessage = (msgId, text) => {
    const speechKey = `sim-${msgId}`;
    if (isSpeaking && activeSpeechId === speechKey) {
      stop();
    } else {
      speak(text, 'hi-IN', speechKey);
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
    <div className="flex flex-col items-center lg:items-start w-full">
      {/* Title & Status Header */}
      <div className="mb-6 flex flex-col items-center lg:items-start">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-2xl font-medium text-white">AI Chat Simulator</h3>
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            <Sparkles className="w-3 h-3" /> LangGraph Multi-Agent
          </span>
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
            <Radio className="w-3 h-3 animate-pulse" /> 2-Way Voice
          </span>
        </div>
        <p className="text-zinc-500 text-sm mt-1">
          Simulate conversational recovery with instant Razorpay links, Hinglish speech-to-text, and auto voice readout.
        </p>
      </div>

      {/* Mobile Device Mockup Container */}
      <div className="w-[360px] sm:w-[390px] h-[640px] max-h-[85vh] border-[8px] border-[#1e272e] rounded-[2.5rem] bg-[#0b141a] overflow-hidden flex flex-col relative shadow-2xl ring-1 ring-white/10">
        
        {/* Chat Top App Bar */}
        <div className="bg-[#202c33] p-3 flex items-center justify-between border-b border-white/5 z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-black font-bold text-xs shadow-md">
              {selectedPersona.initials}
            </div>
            <div className="flex flex-col">
              <select
                value={selectedPersona.id}
                onChange={(e) => handlePersonaChange(e.target.value)}
                className="bg-transparent text-white outline-none text-xs font-semibold cursor-pointer appearance-none pr-3"
              >
                {SIMULATION_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#1e293b] text-white">
                    {p.name} ({p.amount})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                RecoverPay Agent Online
              </span>
            </div>
          </div>

          {/* Right Action Icons: Auto-TTS Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const next = !autoTtsEnabled;
                setAutoTtsEnabled(next);
                if (!next) stop();
              }}
              className={`p-1.5 rounded-full border transition-all ${
                autoTtsEnabled
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
              }`}
              title={autoTtsEnabled ? 'Auto Read-Aloud: ON (Hindi)' : 'Auto Read-Aloud: MUTED'}
            >
              {autoTtsEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>
            <Phone className="w-3.5 h-3.5 text-zinc-400" />
          </div>
        </div>

        {/* Chat Messages Stream */}
        <div className="flex-1 p-3.5 flex flex-col gap-3 overflow-y-auto relative text-[13.5px] custom-scrollbar">
          {/* Subtle chat wallpaper texture */}
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
            const linkToOpen = msg.paymentLink || selectedPersona.paymentLink;

            return (
              <div
                key={msg.id}
                className={`group relative p-3 rounded-2xl shadow-md z-10 leading-relaxed transition-all max-w-[88%] ${
                  isAgent
                    ? 'bg-[#202c33] text-[#e9edef] self-start rounded-tl-none border border-white/5'
                    : 'bg-[#005c4b] text-[#e9edef] self-end rounded-tr-none'
                } ${isThisSpeaking ? 'ring-2 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.35)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-[13px] whitespace-pre-wrap">{msg.text}</p>

                  {/* Manual Read-Aloud Replay / Stop Button */}
                  <button
                    type="button"
                    onClick={() => toggleSpeakMessage(msg.id, msg.text)}
                    className={`shrink-0 p-1.5 rounded-full transition-all ${
                      isThisSpeaking
                        ? 'bg-orange-500 text-black shadow-md'
                        : 'text-zinc-400 hover:text-orange-300 hover:bg-white/10'
                    }`}
                    title={isThisSpeaking ? 'Stop voice playback' : 'Read aloud (Hindi)'}
                  >
                    {isThisSpeaking ? (
                      <Square className="w-3 h-3 fill-current animate-pulse" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {/* Animated Speech Equalizer Bar */}
                {isThisSpeaking && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-orange-300 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">
                    <div className="flex items-center gap-0.5 h-3">
                      <span className="w-0.5 bg-orange-400 animate-[bounce_0.5s_infinite_100ms] h-2 rounded-full"></span>
                      <span className="w-0.5 bg-orange-300 animate-[bounce_0.5s_infinite_200ms] h-3.5 rounded-full"></span>
                      <span className="w-0.5 bg-orange-400 animate-[bounce_0.5s_infinite_300ms] h-2.5 rounded-full"></span>
                    </div>
                    <span className="text-orange-200">Speaking in Hindi...</span>
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

                {/* WORKING RAZORPAY CTA LINK */}
                {msg.hasCta && (
                  <a
                    href={linkToOpen}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2.5 px-3 py-2 bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>Pay {selectedPersona.amount} via Razorpay</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 p-2.5 bg-[#202c33] rounded-2xl rounded-tl-none max-w-[70%] self-start z-10 border border-white/5 shadow-md">
              <Bot className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[bounce_1s_infinite_0ms]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[bounce_1s_infinite_200ms]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[bounce_1s_infinite_400ms]"></span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono ml-1">AI analyzing...</span>
            </div>
          )}

          {/* Live Hinglish Voice Transcription Banner */}
          {isListening && (
            <div className="sticky bottom-0 z-20 flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-[#005c4b] via-[#00a884] to-[#005c4b] border border-emerald-400/50 shadow-[0_0_20px_rgba(0,168,132,0.4)] backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                <span className="text-xs font-semibold text-white">Listening Hinglish...</span>
              </div>
              <div className="flex items-center gap-1 h-4 px-1">
                <span className="w-1 bg-white rounded-full animate-[pulse_0.4s_infinite_100ms] h-2.5"></span>
                <span className="w-1 bg-emerald-100 rounded-full animate-[pulse_0.4s_infinite_200ms] h-4"></span>
                <span className="w-1 bg-white rounded-full animate-[pulse_0.4s_infinite_300ms] h-3"></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="bg-[#182229] px-3 py-1.5 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] text-zinc-500 shrink-0 font-mono">Quick:</span>
          <button
            type="button"
            onClick={() => handleQuickPrompt('Kal salary aane pe pay kar dunga')}
            className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 text-[10.5px] shrink-0 border border-white/5 transition-colors"
          >
            🗓️ Kal pay karunga
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt('Payment link bhej do GPay pe karna hai')}
            className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 text-[10.5px] shrink-0 border border-white/5 transition-colors"
          >
            🔗 Send link
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt('Mera paisa deduct ho gaya order nahi mila')}
            className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 text-[10.5px] shrink-0 border border-white/5 transition-colors"
          >
            ⚠️ Paise cut gaye
          </button>
        </div>

        {/* Input & Voice Controls Footer */}
        <form
          onSubmit={handleSendMessage}
          className="bg-[#202c33] p-2 flex gap-1.5 items-center z-10 border-t border-white/5 relative shrink-0"
        >
          {/* Text Input */}
          <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5 flex items-center gap-2 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all min-w-0">
            <Smile className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={
                isListening
                  ? 'Listening speech...'
                  : 'Type or click mic to speak...'
              }
              className="bg-transparent text-white outline-none w-full text-xs placeholder:text-zinc-500 truncate"
              disabled={isTyping}
            />
          </div>

          {/* GLOWING "HOLD / CLICK TO SPEAK" MICROPHONE BUTTON */}
          <button
            type="button"
            onMouseDown={handleMicDown}
            onMouseUp={handleMicUp}
            onTouchStart={handleMicDown}
            onTouchEnd={handleMicUp}
            onMouseLeave={handleMicLeave}
            onClick={handleMicClick}
            disabled={isTyping || !hasRecognitionSupport}
            className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 select-none shrink-0 cursor-pointer ${
              isListening
                ? 'bg-gradient-to-tr from-emerald-400 to-teal-300 text-black scale-110 shadow-[0_0_20px_rgba(52,211,153,0.85)] ring-2 ring-emerald-400 animate-pulse'
                : 'bg-[#2a3942] hover:bg-[#32434d] text-emerald-400 hover:text-emerald-300 border border-white/5 shadow-md active:scale-95'
            } ${!hasRecognitionSupport ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={
              hasRecognitionSupport
                ? 'Hold or Click to Speak (Hinglish/Hindi)'
                : 'Speech Recognition not supported in this browser'
            }
          >
            {isListening && (
              <span className="absolute -inset-1 rounded-full bg-emerald-400/30 blur-sm animate-ping pointer-events-none"></span>
            )}
            {isListening ? (
              <Mic className="w-3.5 h-3.5 text-black animate-bounce relative z-10" />
            ) : hasRecognitionSupport ? (
              <Mic className="w-3.5 h-3.5" />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </button>

          {/* Send Message Button */}
          <button
            type="submit"
            disabled={isTyping || !customInput.trim()}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-all shadow-md active:scale-90 shrink-0 ${
              isTyping || !customInput.trim()
                ? 'bg-zinc-600 cursor-not-allowed'
                : 'bg-[#00a884] hover:bg-[#008f6f]'
            }`}
            title="Send Message"
          >
            {isTyping ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3 h-3 ml-0.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Simulator;
