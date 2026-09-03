import { useState, useEffect, useRef } from 'react';

const LANG_CODE_MAP = {
  en: 'en-IN',
  'hi-en': 'hi-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  bn: 'bn-IN',
  pa: 'pa-IN',
};

export const useSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState(null);
  const voicesRef = useRef([]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = (text, langKey = 'hi-IN', speechId = null) => {
    if (!('speechSynthesis' in window) || !text) return;

    // If already speaking the same text/card, stop it (toggle behavior)
    if (isSpeaking && activeSpeechId === speechId) {
      stop();
      return;
    }

    // Cancel ongoing speech
    window.speechSynthesis.cancel();

    // Clean markdown/special characters from text for natural speech
    const cleanText = text
      .replace(/[#*`_>]/g, '')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/₹\s?/g, 'Rupees ')
      .trim();

    const targetLang = LANG_CODE_MAP[langKey] || langKey || 'hi-IN';
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = targetLang;
    utterance.rate = 0.95; // Clear and steady conversational speed
    utterance.pitch = 1.0;

    // Try to match a native regional voice if present
    if (voicesRef.current.length > 0) {
      const matchedVoice = voicesRef.current.find(
        (v) => v.lang.toLowerCase() === targetLang.toLowerCase() || v.lang.startsWith(targetLang.split('-')[0])
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setActiveSpeechId(speechId);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setActiveSpeechId(null);
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled') {
        console.warn('Speech synthesis error:', e);
      }
      setIsSpeaking(false);
      setActiveSpeechId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setActiveSpeechId(null);
  };

  return { speak, stop, isSpeaking, activeSpeechId };
};
