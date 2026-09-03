import { useState, useEffect, useRef, useCallback } from 'react';

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

/**
 * Select the most authentic Hindi (hi-IN) or regional Indian voice available
 * from the browser's speechSynthesis voice catalog.
 */
const selectAuthenticVoice = (voices, targetLang = 'hi-IN') => {
  if (!voices || voices.length === 0) return null;

  const normalizedTarget = (LANG_CODE_MAP[targetLang] || targetLang).toLowerCase().replace('_', '-');

  // When Hindi / Hinglish is targeted (hi-IN, hi, hi-en)
  if (normalizedTarget.startsWith('hi')) {
    // 1. High-fidelity Neural/Natural Hindi voices (Microsoft Swara/Madhur, Google हिन्दी, etc.)
    const premiumHindi = voices.find(
      (v) =>
        (v.lang.toLowerCase() === 'hi-in' || v.lang.toLowerCase() === 'hi_in') &&
        (v.name.includes('Natural') ||
          v.name.includes('Neural') ||
          v.name.includes('Google') ||
          v.name.includes('Swara') ||
          v.name.includes('Madhur') ||
          v.name.includes('Kalpana') ||
          v.name.includes('Hemant'))
    );
    if (premiumHindi) return premiumHindi;

    // 2. Any exact hi-IN or hi_IN voice profile
    const exactHindi = voices.find(
      (v) => v.lang.toLowerCase() === 'hi-in' || v.lang.toLowerCase() === 'hi_in'
    );
    if (exactHindi) return exactHindi;

    // 3. Any voice starting with 'hi' or with 'hindi' in its name
    const anyHindi = voices.find(
      (v) => v.lang.toLowerCase().startsWith('hi') || v.name.toLowerCase().includes('hindi')
    );
    if (anyHindi) return anyHindi;

    // 4. Fallback to Indian English (en-IN) which pronounces Hinglish words naturally
    const indianEnglish = voices.find(
      (v) =>
        (v.lang.toLowerCase() === 'en-in' || v.lang.toLowerCase() === 'en_in') &&
        (v.name.includes('India') ||
          v.name.includes('Neerja') ||
          v.name.includes('Heera') ||
          v.name.includes('Google') ||
          v.name.includes('Natural'))
    );
    if (indianEnglish) return indianEnglish;
  }

  // Exact match for other requested regional languages
  const exact = voices.find((v) => v.lang.toLowerCase().replace('_', '-') === normalizedTarget);
  if (exact) return exact;

  // Prefix match (e.g. 'ta', 'te', 'bn')
  const prefix = voices.find((v) => v.lang.toLowerCase().startsWith(normalizedTarget.split('-')[0]));
  if (prefix) return prefix;

  // Generic Indian accent fallback
  const anyIndian = voices.find(
    (v) =>
      v.lang.toLowerCase().endsWith('in') ||
      v.name.toLowerCase().includes('india')
  );
  if (anyIndian) return anyIndian;

  return null;
};

export const useSpeech = () => {
  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState(null);

  // STT (Speech-to-Text) State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognitionError, setRecognitionError] = useState(null);

  const voicesRef = useRef([]);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const onTranscriptRef = useRef(null);

  // Speech Recognition API detection
  const hasRecognitionSupport =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Load available speech synthesis voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        voicesRef.current = v;
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  /**
   * Stop any active SpeechSynthesis playback.
   */
  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setActiveSpeechId(null);
  }, []);

  /**
   * Speak text aloud using SpeechSynthesis with authentic hi-IN voice profile selection.
   */
  const speak = useCallback(
    (text, langKey = 'hi-IN', speechId = null) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;

      // Toggle behavior: if already speaking the exact same message, stop it
      if (isSpeaking && activeSpeechId === speechId) {
        stop();
        return;
      }

      // Cancel any previous speech
      window.speechSynthesis.cancel();

      // Sanitize text for natural sounding speech
      const cleanText = text
        .replace(/```[\s\S]*?```/g, '') // code blocks
        .replace(/[#*`_~>]/g, '') // markdown punctuation
        .replace(/https?:\/\/\S+/g, 'payment link') // URLs
        .replace(/rzp\.io\/\S+/g, 'payment link') // short links
        .replace(/₹\s?/g, 'Rupees ') // currency symbol
        .replace(/Rs\.\s?/gi, 'Rupees ')
        .replace(
          /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
          ''
        ) // strip emojis
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) return;

      const targetLang = LANG_CODE_MAP[langKey] || langKey || 'hi-IN';
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = targetLang;
      utterance.rate = 0.96; // Conversational, clear pacing
      utterance.pitch = 1.0;

      // Select authentic voice profile
      const allVoices =
        voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
      const matchedVoice = selectAuthenticVoice(allVoices, targetLang);
      if (matchedVoice) {
        utterance.voice = matchedVoice;
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
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('Speech synthesis error:', e);
        }
        setIsSpeaking(false);
        setActiveSpeechId(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSpeaking, activeSpeechId, stop]
  );

  /**
   * Start Speech-to-Text listening using SpeechRecognition.
   * Transcribes spoken Hinglish/Hindi directly.
   */
  const startListening = useCallback(
    ({ onTranscript, lang = 'hi-IN' } = {}) => {
      if (!hasRecognitionSupport) {
        const msg = 'Web Speech API is not supported in this browser. Please use Chrome or Edge.';
        console.warn(msg);
        setRecognitionError(msg);
        return false;
      }

      // Stop any playing TTS to avoid recording audio output
      stop();

      // Avoid double start
      if (isListeningRef.current) return true;

      try {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;

        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {
            // ignore
          }
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        // 'hi-IN' handles Hindi & Hinglish phonetic speech smoothly in Chrome/Edge
        recognition.lang = LANG_CODE_MAP[lang] || lang || 'hi-IN';
        recognition.maxAlternatives = 1;

        onTranscriptRef.current = onTranscript;
        setRecognitionError(null);

        recognition.onstart = () => {
          isListeningRef.current = true;
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          let interimText = '';
          let finalText = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalText += result[0].transcript;
            } else {
              interimText += result[0].transcript;
            }
          }

          const combined = (finalText || interimText).trim();
          if (combined) {
            setTranscript(combined);
            if (onTranscriptRef.current) {
              onTranscriptRef.current(combined, Boolean(finalText));
            }
          }
        };

        recognition.onerror = (event) => {
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            console.warn('Speech recognition warning:', event.error);
            setRecognitionError(event.error);
          }
        };

        recognition.onend = () => {
          isListeningRef.current = false;
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        return true;
      } catch (err) {
        console.warn('Error starting speech recognition:', err);
        setRecognitionError(err.message || 'Recognition error');
        isListeningRef.current = false;
        setIsListening(false);
        return false;
      }
    },
    [hasRecognitionSupport, stop]
  );

  /**
   * Stop Speech-to-Text listening.
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    isListeningRef.current = false;
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    // TTS
    speak,
    stop,
    isSpeaking,
    activeSpeechId,

    // STT
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    hasRecognitionSupport,
    recognitionError,
  };
};

export default useSpeech;
