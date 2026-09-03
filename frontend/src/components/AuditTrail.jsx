import React, { useState, useEffect } from 'react';
import {
  Globe,
  Languages,
  Sparkles,
  Check,
  ChevronDown,
  Volume2,
  Square,
  VolumeX,
  ShieldCheck,
} from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const INDIAN_LANGUAGES = [
  { id: 'en', name: 'English', native: 'English', tag: 'Global' },
  { id: 'hi-en', name: 'Hinglish', native: 'Hinglish', tag: 'Popular' },
  { id: 'hi', name: 'Hindi', native: 'हिन्दी', tag: 'Popular' },
  { id: 'ta', name: 'Tamil', native: 'தமிழ்', tag: 'South' },
  { id: 'te', name: 'Telugu', native: 'తెలుగు', tag: 'South' },
  { id: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', tag: 'South' },
  { id: 'ml', name: 'Malayalam', native: 'മലയാളം', tag: 'South' },
  { id: 'mr', name: 'Marathi', native: 'मराठी', tag: 'West' },
  { id: 'gu', name: 'Gujarati', native: 'ગુજરાતી', tag: 'West' },
  { id: 'bn', name: 'Bengali', native: 'বাংলা', tag: 'East' },
  { id: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', tag: 'North' },
];

const LOCALIZED_DICTIONARY = {
  en: {
    ui: {
      title: 'Explainable Audit Trail',
      subtitle: 'Real-time inference logs outlining exactly how the AI agent processes each transaction.',
      stage: 'Stage',
      action: 'Action Taken',
      reasoning: 'Autonomous AI Reasoning',
      selectLang: 'Explanation Language',
      emptyLogs: 'No audit logs available. Run the batch engine first.',
      activeLanguageBadge: 'Showing All Content In',
      reasoningPrefix: 'Inference Trace',
      txnPrefix: 'TXN',
      quickSwitch: 'Quick Switch',
      selectPrompt: 'Select Language',
      readAloud: 'Read Aloud',
      stopReading: 'Stop',
    },
    stages: {
      BATCH_ENGINE: 'Batch Recovery Engine',
      CHAT_SIMULATE: 'Conversational Recovery Triage',
      TRIAGE: 'Triage Node',
      OUTREACH: 'Outreach Node',
      DEFAULT: 'Agent Execution',
    },
    translateAction: (action) => action,
    translateReasoning: (reasoning) => reasoning,
  },

  'hi-en': {
    ui: {
      title: 'Explainable Audit Trail (Hinglish)',
      subtitle: 'Real-time AI inference logs jo explain karte hain ki agent ne har transaction kaise process kiya.',
      stage: 'Charan (Stage)',
      action: 'Liya Gaya Action',
      reasoning: 'AI Ka Reasoning & Decision',
      selectLang: 'Bhasha Chunein',
      emptyLogs: 'Koi audit logs nahi mile. Pehle Batch Engine run karein.',
      activeLanguageBadge: 'Saara Content Display Ho Raha Hai',
      reasoningPrefix: 'AI Decision Trace',
      txnPrefix: 'Transaction ID',
      quickSwitch: 'Jaldi Badlein',
      selectPrompt: 'Indian Bhasha Chunein',
      readAloud: 'Sunien (Read Aloud)',
      stopReading: 'Rokien',
    },
    stages: {
      BATCH_ENGINE: 'Batch Engine Process',
      TRIAGE: 'Triage Charan',
      OUTREACH: 'Outreach Charan',
      DEFAULT: 'Agent Karyawahi',
    },
    translateAction: (action) => {
      const text = action.toLowerCase();
      if (text.includes('silent retry')) return 'Bank gateway ke through silent retry queue me daal diya gaya hai.';
      if (text.includes('escalated')) return 'Human customer support team ko case escalate kar diya gaya.';
      if (text.includes('conversational outreach') || text.includes('routed')) return 'Customer se direct contact karne ke liye Outreach Node ko bhej diya.';
      if (text.includes('namaste') || text.includes('hi ') || text.includes('aapka')) return action;
      return 'AI Agent dwara automated recovery action perform kiya gaya.';
    },
    translateReasoning: (reasoning) => {
      const text = reasoning.toLowerCase();
      if (text.includes('timeout') || text.includes('bank timeout')) {
        return 'Technical bank timeout detect hua hai. Customer ko bina pareshan kiye background me silent retry queue kiya gaya.';
      }
      if (text.includes('max attempts') || text.includes('harassment') || text.includes('stopping rule')) {
        return 'Stopping rule lagu hua: Maximum attempts poore ho gaye hain taaki customer ko spam na ho. Case human team ko transfer kiya.';
      }
      if (text.includes('outreach') || text.includes('razorpay') || text.includes('interaction')) {
        return 'Failed transaction recover karne ke liye dynamic Razorpay link aur personalized message generate karke outreach shuru ki gayi.';
      }
      if (text.includes('promise')) {
        return 'Customer ne aage payment karne ka promise kiya. Automatic reminder calendar update kar diya gaya.';
      }
      return 'AI Agent ne policy aur safety rules ke hisaab se autonomous decision liya.';
    },
  },

  hi: {
    ui: {
      title: 'व्याख्यात्मक ऑडिट ट्रेल',
      subtitle: 'वास्तविक समय के एआई इन्फरेंस लॉग जो बताते हैं कि एजेंट ने प्रत्येक लेन-देन को कैसे संसाधित किया।',
      stage: 'प्रक्रिया चरण',
      action: 'की गई कार्रवाई',
      reasoning: 'स्वायत्त एआई तर्क एवं निर्णय',
      selectLang: 'भाषा चुनें',
      emptyLogs: 'कोई ऑडिट लॉग उपलब्ध नहीं है। कृपया पहले बैच इंजन चलाएं।',
      activeLanguageBadge: 'संपूर्ण विवरण प्रदर्शित भाषा',
      reasoningPrefix: 'एआई निर्णय विश्लेषण',
      txnPrefix: 'लेन-देन आईडी',
      quickSwitch: 'त्वरित भाषा बदलें',
      selectPrompt: 'भारतीय भाषा चुनें',
      readAloud: 'बोलकर सुनाएं',
      stopReading: 'रोकें',
    },
    stages: {
      BATCH_ENGINE: 'बैच रिकवरी इंजन',
      TRIAGE: 'वर्गीकरण चरण (Triage)',
      OUTREACH: 'ग्राहक संपर्क चरण (Outreach)',
      DEFAULT: 'एजेंट निष्पादन',
    },
    translateAction: (action) => {
      const text = action.toLowerCase();
      if (text.includes('silent retry')) return 'पेमेंट गेटवे के माध्यम से स्वचालित मूक पुनः प्रयास (Silent Retry) निर्धारित किया गया।';
      if (text.includes('escalated')) return 'मामले को मानवीय सहायता (Human Support) टीम को सौंप दिया गया।';
      if (text.includes('conversational outreach') || text.includes('routed')) return 'ग्राहक से सीधे संवाद के लिए आउटरीच चरण में स्थानांतरित किया गया।';
      if (text.includes('namaste') || text.includes('hi ') || text.includes('aapka')) {
        return 'ग्राहक को व्हाट्सएप पर सुरक्षित भुगतान लिंक एवं संदेश प्रेषित किया गया।';
      }
      return 'एआई एजेंट द्वारा स्वचालित समाधान कार्रवाई की गई।';
    },
    translateReasoning: (reasoning) => {
      const text = reasoning.toLowerCase();
      if (text.includes('timeout') || text.includes('bank timeout')) {
        return 'बैंक सर्वर में तकनीकी टाइमआउट पाया गया। ग्राहक को परेशान किए बिना बैकग्राउंड में स्वचालित पुनः प्रयास कतारबद्ध किया गया।';
      }
      if (text.includes('max attempts') || text.includes('harassment') || text.includes('stopping rule')) {
        return 'रोक नियम लागू: ग्राहक सुरक्षा के लिए अधिकतम प्रयास सीमा पूरी होने पर मानवीय सहायता को मामला भेजा गया।';
      }
      if (text.includes('outreach') || text.includes('razorpay') || text.includes('interaction')) {
        return 'गतिशील रेज़रपे (Razorpay) भुगतान लिंक तैयार किया गया एवं ग्राहक की पसंदीदा भाषा में व्यक्तिगत संदेश तैयार किया गया।';
      }
      if (text.includes('promise')) {
        return 'ग्राहक ने भविष्य में भुगतान का आश्वासन दिया। तदनुसार स्मरण-पत्र निर्धारित किया गया।';
      }
      return 'एआई एजेंट ने सुरक्षा एवं व्यापार नीतियों के अनुसार पूर्णतः स्वायत्त निर्णय लिया।';
    },
  },

  ta: {
    ui: {
      title: 'விளக்கக்கூடிய தணிக்கைப் பாதை',
      subtitle: 'ஒவ்வொரு பரிவர்த்தனையையும் AI முகவர் எவ்வாறு செயலாக்குகிறார் என்பதற்கான நேரலை முடிவுகள்.',
      stage: 'செயல்முறை நிலை',
      action: 'எடுக்கப்பட்ட நடவடிக்கை',
      reasoning: 'AI இன் முழுமையான காரணம் மற்றும் முடிவு',
      selectLang: 'மொழியைத் தேர்ந்தெடுக்கவும்',
      emptyLogs: 'பதிவுகள் எதுவும் இல்லை. முதலில் Batch Engine-ஐ இயக்கவும்.',
      activeLanguageBadge: 'அனைத்து விவரங்களும் காட்டப்படும் மொழி',
      reasoningPrefix: 'AI முடிவு கட்டமைப்பு',
      txnPrefix: 'பரிவர்த்தனை எண்',
      quickSwitch: 'விரைவு மாற்றம்',
      selectPrompt: 'இந்திய மொழியைத் தேர்வு செய்க',
      readAloud: 'கேளுங்கள் (Read Aloud)',
      stopReading: 'நிறுத்து',
    },
    stages: {
      BATCH_ENGINE: 'தொகுதி மீட்பு இயந்திரம்',
      TRIAGE: 'வகைப்படுத்தல் நிலை (Triage)',
      OUTREACH: 'தொடர்பு நிலை (Outreach)',
      DEFAULT: 'செயல்பாட்டு நிலை',
    },
    translateAction: (action) => {
      const text = action.toLowerCase();
      if (text.includes('silent retry')) return 'வங்கி வழியாக தானியங்கி மறுமுயற்சி (Silent Retry) அமைப்பில் சேர்க்கப்பட்டது.';
      if (text.includes('escalated')) return 'சிக்கல் மனித ஆதரவுக் குழுவிற்கு (Human Support) மாற்றப்பட்டது.';
      if (text.includes('conversational outreach') || text.includes('routed')) return 'வாடிக்கையாளரைத் தொடர்புகொள்ளும் நிலைக்கு மாற்றப்பட்டது.';
      return 'பாதுகாப்பான Razorpay கட்டண இணைப்புடன் வாடிக்கையாளருக்கு செய்தி அனுப்பப்பட்டது.';
    },
    translateReasoning: (reasoning) => {
      const text = reasoning.toLowerCase();
      if (text.includes('timeout') || text.includes('bank timeout')) {
        return 'தொழில்நுட்ப வங்கி காலாவதி கண்டறியப்பட்டது. வாடிக்கையாளருக்கு தொந்தரவு இல்லாமல் தானியங்கி மறுமுயற்சி செய்யப்பட்டது.';
      }
      if (text.includes('max attempts') || text.includes('harassment') || text.includes('stopping rule')) {
        return 'அதிகபட்ச 2 முயற்சிகள் முடிவடைந்ததால், வாடிக்கையாளர் நலன் கருதி மனித உதவி குழுவிற்கு அனுப்பப்பட்டது.';
      }
      if (text.includes('outreach') || text.includes('razorpay') || text.includes('interaction')) {
        return 'பாதுகாப்பான Razorpay கட்டண இணைப்பு உருவாக்கப்பட்டு, வாடிக்கையாளரின் தாய்மொழியில் மீட்பு செய்தி தயார் செய்யப்பட்டது.';
      }
      return 'AI முகவர் விதிகளின்படி தானியங்கி முடிவை எடுத்துள்ளது.';
    },
  },

  te: {
    ui: {
      title: 'వివరణాత్మక ఆడిట్ ట్రయిల్',
      subtitle: 'ప్రతి లావాదేవీని AI ఏజెంట్ ఎలా ప్రాసెస్ చేస్తుందో వివరించే రియల్-టైమ్ ఇన్ఫరెన్స్ లాగ్‌లు.',
      stage: 'ప్రక్రియ దశ',
      action: 'తీసుకున్న చర్య',
      reasoning: 'AI స్వయంప్రతిపత్తి నిర్ణయం & విశ్లేషణ',
      selectLang: 'భాషను ఎంచుకోండి',
      emptyLogs: 'ఆడిట్ లాగ్‌లు అందుబాటులో లేవు. ముందుగా బ్యాచ్ ఇంజిన్‌ను ప్రారంభించండి.',
      activeLanguageBadge: 'మొత్తం సమాచారం ప్రదర్శించబడుతున్న భాష',
      reasoningPrefix: 'నిర్ణయ విశ్లేషణ క్రమం',
      txnPrefix: 'లావాదేవీ ఐడి',
      quickSwitch: 'త్వరిత మార్పు',
      selectPrompt: 'భారతీయ భాషను ఎంచుకోండి',
      readAloud: 'వినండి (Read Aloud)',
      stopReading: 'ఆపు',
    },
    stages: {
      BATCH_ENGINE: 'బ్యాచ్ రికవరీ ఇంజిన్',
      TRIAGE: 'వర్గీకరణ దశ (Triage)',
      OUTREACH: 'సంప్రదింపుల దశ (Outreach)',
      DEFAULT: 'ఏజెంట్ అమలు',
    },
    translateAction: (action) => {
      const text = action.toLowerCase();
      if (text.includes('silent retry')) return 'గేట్‌వే ద్వారా సైలెంట్ రీట్రై ప్రక్రియ షెడ్యూల్ చేయబడింది.';
      if (text.includes('escalated')) return 'కేసును మానవ సహాయక బృందానికి బదిలీ చేయబడింది.';
      if (text.includes('conversational outreach') || text.includes('routed')) return 'కస్టమర్‌తో సంభాషణ కోసం ఔట్‌రీచ్ విభాగానికి పంపబడింది.';
      return 'సురక్షితమైన Razorpay చెల్లింపు లింక్‌తో కస్టమర్‌కు సందేశం పంపబడింది.';
    },
    translateReasoning: (reasoning) => {
      const text = reasoning.toLowerCase();
      if (text.includes('timeout') || text.includes('bank timeout')) {
        return 'సాంకేతిక బ్యాంక్ టైమ్‌అవుట్ గుర్తించబడింది. కస్టమర్‌కు ఎలాంటి అసౌకర్యం కలగకుండా బ్యాక్‌గ్రౌండ్‌లో రీట్రై చేయబడింది.';
      }
      if (text.includes('max attempts') || text.includes('harassment') || text.includes('stopping rule')) {
        return 'గరిష్ట ప్రయత్నాల పరిమితి పూర్తయింది. కస్టమర్ భద్రత కోసం మానవ సహాయక బృందానికి కేసు అప్పగించబడింది.';
      }
      if (text.includes('outreach') || text.includes('razorpay') || text.includes('interaction')) {
        return 'డైనమిక్ Razorpay చెల్లింపు లింక్ మరియు వ్యక్తిగతీకరించిన భాషా సందేశం రూపొందించబడి పంపబడింది.';
      }
      return 'AI ఏజెంట్ నిబంధనలకు అనుగుణంగా స్వయంప్రతిపత్తి నిర్ణయం తీసుకుంది.';
    },
  },

  kn: {
    ui: {
      title: 'ವಿವರಣಾತ್ಮಕ ಆಡಿಟ್ ಟ್ರಯಲ್',
      subtitle: 'ಪ್ರತಿಯೊಂದು ವಹಿವಾಟನ್ನು AI ಏಜೆಂಟ್ ಹೇಗೆ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸುತ್ತದೆ ಎಂಬುದರ ರಿಯಲ್-ಟೈಮ್ ಲಾಗ್‌ಗಳು.',
      stage: 'ಪ್ರಕ್ರಿಯೆಯ ಹಂತ',
      action: 'ತೆಗೆದುಕೊಂಡ ಕ್ರಮ',
      reasoning: 'AI ಸ್ವಯಂಚಾಲಿತ ತರ್ಕ ಮತ್ತು ನಿರ್ಧಾರ',
      selectLang: 'ವಿವರಣೆಯ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ',
      emptyLogs: 'ಯಾವುದೇ ಆಡಿಟ್ ಲಾಗ್‌ಗಳಿಲ್ಲ. ಮೊದಲು ಬ್ಯಾಚ್ ಎಂಜಿನ್ ರನ್ ಮಾಡಿ.',
      activeLanguageBadge: 'ಸಂಪೂರ್ಣ ಮಾಹಿತಿ ತೋರಿಸುತ್ತಿರುವ ಭಾಷೆ',
      reasoningPrefix: 'ನಿರ್ಧಾರ ವಿಶ್ಲೇಷಣೆ',
      txnPrefix: 'ವಹಿವಾಟು ಐಡಿ',
      quickSwitch: 'ತ್ವರಿತ ಬದಲಾವಣೆ',
      selectPrompt: 'ಭಾರತೀಯ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ',
      readAloud: 'ಕೇಳಿ (Read Aloud)',
      stopReading: 'ನಿಲ್ಲಿಸು',
    },
    stages: {
      BATCH_ENGINE: 'ಬ್ಯಾಚ್ ರಿಕವರಿ ಎಂಜಿನ್',
      TRIAGE: 'ವರ್ಗೀಕರಣ ಹಂತ (Triage)',
      OUTREACH: 'ಸಂಪರ್ಕ ಹಂತ (Outreach)',
      DEFAULT: 'ಏಜೆಂಟ್ ಪ್ರಕ್ರಿಯೆ',
    },
    translateAction: (action) => {
      const text = action.toLowerCase();
      if (text.includes('silent retry')) return 'ಪಾವತಿ ಗೇಟ್‌ವೇ ಮೂಲಕ ಸೈಲೆಂಟ್ ಮರುಪ್ರಯತ್ನವನ್ನು ನಿಗದಿಪಡಿಸಲಾಗಿದೆ.';
      if (text.includes('escalated')) return 'ಪ್ರಕರಣವನ್ನು ಮಾನವ ಬೆಂಬಲ ತಂಡಕ್ಕೆ ವರ್ಗಾಯಿಸಲಾಗಿದೆ.';
      if (text.includes('conversational outreach') || text.includes('routed')) return 'ಗ್ರಾಹಕರನ್ನು ಸಂಪರ್ಕಿಸಲು ಔಟ್‌ರೀಚ್ ಹಂತಕ್ಕೆ ಕಳುಹಿಸಲಾಗಿದೆ.';
      return 'ಸುರಕ್ಷಿತ Razorpay ಪಾವತಿ ಲಿಂಕ್‌ನೊಂದಿಗೆ ಗ್ರಾಹಕರಿಗೆ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗಿದೆ.';
    },
    translateReasoning: (reasoning) => {
      const text = reasoning.toLowerCase();
      if (text.includes('timeout') || text.includes('bank timeout')) {
        return 'ತಾಂತ್ರಿಕ ಬ್ಯಾಂಕ್ ಟೈಮ್‌ಔಟ್ ಪತ್ತೆಯಾಗಿದೆ. ಗ್ರಾಹಕರಿಗೆ ತೊಂದರೆಯಾಗದಂತೆ ಹಿನ್ನೆಲೆಯಲ್ಲಿ ಮರುಪ್ರಯತ್ನ ಮಾಡಲಾಗುತ್ತಿದೆ.';
      }
      if (text.includes('max attempts') || text.includes('harassment') || text.includes('stopping rule')) {
        return 'ಗರಿಷ್ಠ ಮಿತಿ ತಲುಪಿದೆ. ಗ್ರಾಹಕರ ಹಿತದೃಷ್ಟಿಯಿಂದ ಹ್ಯೂಮನ್ ಸಪೋರ್ಟ್ ತಂಡಕ್ಕೆ ಪ್ರಕರಣವನ್ನು ಕಳುಹಿಸಲಾಗಿದೆ.';
      }
      if (text.includes('outreach') || text.includes('razorpay') || text.includes('interaction')) {
        return 'ಡೈನಾಮಿಕ್ Razorpay ಪಾವತಿ ಲಿಂಕ್ ರಚಿಸಿ, ಆಯ್ದ ಭಾಷೆಯಲ್ಲಿ ಗ್ರಾಹಕರ ಸಂದೇಶ ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ.';
      }
      return 'AI ಏಜೆಂಟ್ ನಿಯಮಗಳ ಪ್ರಕಾರ ಸ್ವಯಂಚಾಲಿತ ನಿರ್ಧಾರವನ್ನು ತೆಗೆದುಕೊಂಡಿದೆ.';
    },
  },

  ml: {
    ui: {
      title: 'വ്യക്തമായ ഓഡിറ്റ് ട്രയൽ',
      subtitle: 'ഓരോ ഇടപാടും AI ഏജന്റ് എങ്ങനെ പ്രോസസ്സ് ചെയ്യുന്നു എന്ന് വിശദീകരിക്കുന്ന റിയൽ-ടൈം ലോഗുകൾ.',
      stage: 'പ്രക്രിയ ഘട്ടം',
      action: 'സ്വീകരിച്ച നടപടി',
      reasoning: 'AI സ്വയംഭരണ യുക്തിയും തീരുമാനവും',
      selectLang: 'ഭാഷ തിരഞ്ഞെടുക്കുക',
      emptyLogs: 'ഓഡിറ്റ് ലോഗുകൾ ലഭ്യമല്ല. ആദ്യം ബാച്ച് എഞ്ചിൻ പ്രവർത്തിപ്പിക്കുക.',
      activeLanguageBadge: 'മുഴുവൻ വിവരങ്ങളും നൽകുന്ന ഭാഷ',
      reasoningPrefix: 'തീരുമാന വിശകലനം',
      txnPrefix: 'ഇടപാട് ഐഡി',
      quickSwitch: 'വേഗത്തിൽ മാറ്റുക',
      selectPrompt: 'ഇന്ത്യൻ ഭാഷ തിരഞ്ഞെടുക്കുക',
      readAloud: 'കേൾക്കുക (Read Aloud)',
      stopReading: 'നിർത്തുക',
    },
    stages: {
      BATCH_ENGINE: 'ബാച്ച് റിക്കവറി എഞ്ചിൻ',
      TRIAGE: 'വർഗ്ഗീകരണ ഘട്ടം (Triage)',
      OUTREACH: 'ആശയവിനിമയ ഘട്ടം (Outreach)',
      DEFAULT: 'ഏജന്റ് പ്രവർത്തനം',
    },
    translateAction: (action) => {
      const text = action.toLowerCase();
      if (text.includes('silent retry')) return 'പേയ്‌മെന്റ് ഗേറ്റ്‌വേ വഴി നിശബ്ദ പുനഃശ്രമം ക്രമീകരിച്ചു.';
      if (text.includes('escalated')) return 'കേസ് ഹ്യൂമൻ സപ്പോർട്ട് ടീമിന് കൈമാറി.';
      if (text.includes('conversational outreach') || text.includes('routed')) return 'ഉപഭോക്താവിനെ ബന്ധപ്പെടാനായി ഔട്ട്‌റീച്ച് ഘട്ടത്തിലേക്ക് മാറ്റി.';
      return 'സുരക്ഷിതമായ Razorpay പേയ്‌മെന്റ് ലിങ്ക് സഹിതം സന്ദേശം അയച്ചു.';
    },
    translateReasoning: (reasoning) => {
      const text = reasoning.toLowerCase();
      if (text.includes('timeout') || text.includes('bank timeout')) {
        return 'സാങ്കേതിക ബാങ്ക് തടസ്സം കണ്ടെത്തി. ഉപഭോക്താവിന് ബുദ്ധിമുട്ടുണ്ടാക്കാതെ പശ്ചാത്തലത്തിൽ പുനഃശ്രമം നടത്തുന്നു.';
      }
      if (text.includes('max attempts') || text.includes('harassment') || text.includes('stopping rule')) {
        return 'പരമാവധി ശ്രമങ്ങൾ പൂർത്തിയായി. ഉപഭോക്തൃ സംരക്ഷണ നിയമപ്രകാരം മാനുവൽ പിന്തുണയിലേക്ക് മാറ്റി.';
      }
      if (text.includes('outreach') || text.includes('razorpay') || text.includes('interaction')) {
        return 'Razorpay പേയ്‌മെന്റ് ലിങ്ക് ജനറേറ്റ് ചെയ്യുകയും വ്യക്തിഗത സന്ദേശം തയ്യാറാക്കുകയും ചെയ്തു.';
      }
      return 'AI ഏജന്റ് കൃത്യമായ സുരക്ഷാ മാനദണ്ഡങ്ങൾ പാലിച്ച് തീരുമാനമെടുത്തു.';
    },
  },

  mr: {
    ui: {
      title: 'स्पष्टीकरणात्मक ऑडिट ट्रेल',
      subtitle: 'प्रत्येक व्यवहार AI एजंटने कसा प्रक्रिया केला हे स्पष्ट करणारे रीअल-टाइम लॉग्स.',
      stage: 'प्रक्रिया टप्पा',
      action: 'केलेली कारवाई',
      reasoning: 'स्वायत्त AI तर्क व निर्णय',
      selectLang: 'भाषा निवडा',
      emptyLogs: 'कोणतेही ऑडिट लॉग उपलब्ध नाहीत. प्रथम बॅच इंजिन चालवा.',
      activeLanguageBadge: 'सर्व माहिती दर्शविणारी भाषा',
      reasoningPrefix: 'निर्णय विश्लेषण',
      txnPrefix: 'व्यवहार आयडी',
      quickSwitch: 'जलद बदला',
      selectPrompt: 'भारतीय भाषा निवडा',
      readAloud: 'ऐका (Read Aloud)',
      stopReading: 'थांबवा',
    },
    stages: {
      BATCH_ENGINE: 'बॅच रिकव्हरी इंजिन',
      TRIAGE: 'वर्गीकरण टप्पा (Triage)',
      OUTREACH: 'ग्राहक संपर्क टप्पा (Outreach)',
      DEFAULT: 'एजंट प्रक्रिया',
    },
    translateAction: (action) => {
      const text = action.toLowerCase();
      if (text.includes('silent retry')) return 'पेमेंट गेटवेद्वारे मूक पुनर्प्रयत्न नियोजित केला गेला.';
      if (text.includes('escalated')) return 'प्रकरण मानवी सहाय्य कार्यसंघाकडे वर्ग केले.';
      if (text.includes('conversational outreach') || text.includes('routed')) return 'ग्राहकाशी थेट संवादासाठी आउटरीच टप्प्याकडे पाठवले.';
      return 'सुरक्षित Razorpay पेमेंट लिंकसह ग्राहकाला संदेश पाठवला.';
    },
    translateReasoning: (reasoning) => {
      const text = reasoning.toLowerCase();
      if (text.includes('timeout') || text.includes('bank timeout')) {
        return 'तांत्रिक बँक टाइमआउट आढळला. ग्राहकाला कोणताही त्रास न देता मूक पुनर्प्रयत्न रांगेत जोडला.';
      }
      if (text.includes('max attempts') || text.includes('harassment') || text.includes('stopping rule')) {
        return 'कमाल २ प्रयत्न पूर्ण झाले आहेत. ग्राहक सुरक्षेसाठी प्रकरण मानवी सहाय्य कार्यसंघाकडे पाठवले.';
      }
      if (text.includes('outreach') || text.includes('razorpay') || text.includes('interaction')) {
        return 'Razorpay पेमेंट लिंक तयार करून ग्राहकाच्या भाषेत वैयक्तिकृत संदेश पाठवला गेला.';
      }
      return 'AI एजंटने सर्व नियमांचे पालन करून स्वायत्त निर्णय घेतला.';
    },
  },

  gu: {
    ui: {
      title: 'સમજૂતીત્મક ઑડિટ ટ્રેલ',
      subtitle: 'દરેક વ્યવહારને AI એજન્ટે કેવી રીતે પ્રોસેસ કર્યો તેની રીઅલ-ટાઇમ સમજૂતી.',
      stage: 'પ્રક્રિયા તબક્કો',
      action: 'લેવાયેલ પગલાં',
      reasoning: 'AI સ્વાયત્ત તર્ક અને નિર્ણય',
      selectLang: 'ભાષા પસંદ કરો',
      emptyLogs: 'કોઈ ઑડિટ લૉગ ઉપલબ્ધ નથી. કૃપા કરીને પહેલાં બેચ એન્જિન ચલાવો.',
      activeLanguageBadge: 'બધી વિગતો દર્શાવતી ભાષા',
      reasoningPrefix: 'નિર્ણય વિશ્લેષણ',
      txnPrefix: 'ટ્રાન્ઝેક્શન આઈડી',
      quickSwitch: 'ઝડપી ફેરબદલ',
      selectPrompt: 'ભારતીય ભાષા પસંદ કરો',
      readAloud: 'સાંભળો (Read Aloud)',
      stopReading: 'અટકાવો',
    },
    stages: {
      BATCH_ENGINE: 'બેચ રિકવરી એન્જિન',
      TRIAGE: 'વર્ગીકરણ તબક્કો (Triage)',
      OUTREACH: 'ગ્રાહક સંપર્ક તબક્કો (Outreach)',
      DEFAULT: 'એજન્ટ પ્રક્રિયા',
    },
    translateAction: (action) => {
      const text = action.toLowerCase();
      if (text.includes('silent retry')) return 'પેમેન્ટ ગેટવે દ્વારા સાયલન્ટ પુનઃપ્રયાસ નિર્ધારિત કરવામાં આવ્યો.';
      if (text.includes('escalated')) return 'કેસ માનવ સહાય ટીમને સોંપવામાં આવ્યો.';
      if (text.includes('conversational outreach') || text.includes('routed')) return 'ગ્રાહક સાથે વાતચીત માટે આઉટરીચ તબક્કામાં મોકલ્યો.';
      return 'સુરક્ષિત Razorpay પેમેન્ટ લિંક સાથે ગ્રાહકને મેસેજ મોકલવામાં આવ્યો.';
    },
    translateReasoning: (reasoning) => {
      const text = reasoning.toLowerCase();
      if (text.includes('timeout') || text.includes('bank timeout')) {
        return 'ટેકનિકલ બેંક ટાઈમઆઉટ જણાયો. ગ્રાહકને ખલેલ પહોંચાડ્યા વિના બેકગ્રાઉન્ડમાં સાયલન્ટ પુનઃપ્રયાસ કતારબદ્ધ થયો.';
      }
      if (text.includes('max attempts') || text.includes('harassment') || text.includes('stopping rule')) {
        return 'મહત્તમ પ્રયાસો પૂર્ણ થયા. ગ્રાહકની સુવિધા માટે માનવ સહાય ટીમને કેસ સોંપાયો.';
      }
      if (text.includes('outreach') || text.includes('razorpay') || text.includes('interaction')) {
        return 'ડાયનેમિક Razorpay પેમેન્ટ લિંક અને વ્યક્તિગત મેસેજ તૈયાર કરીને મોકલવામાં આવ્યો.';
      }
      return 'AI એજન્ટે નિયમો અનુસાર સ્વાયત્ત નિર્ણય લીધો છે.';
    },
  },

  bn: {
    ui: {
      title: 'ব্যাখ্যামূলক অডিট ট্রেইল',
      subtitle: 'AI এজেন্ট প্রতিটি লেনদেন কীভাবে প্রক্রিয়া করেছে তার রিয়েল-টাইম ইনফারেন্স লগ।',
      stage: 'প্রক্রিয়া পর্যায়',
      action: 'গৃহীত পদক্ষেপ',
      reasoning: 'AI স্বায়ত্তশাসিত যুক্তি ও সিদ্ধান্ত',
      selectLang: 'ভাষা নির্বাচন করুন',
      emptyLogs: 'কোনো অডিট লগ পাওয়া যায়নি। প্রথমে ব্যাচ ইঞ্জিন চালান।',
      activeLanguageBadge: 'সমস্ত বিবরণ প্রদর্শিত হচ্ছে যে ভাষায়',
      reasoningPrefix: 'সিদ্ধান্ত বিশ্লেষণ ট্রেইল',
      txnPrefix: 'লেনদেন আইডি',
      quickSwitch: 'দ্রুত পরিবর্তন',
      selectPrompt: 'ভারতীয় ভাষা নির্বাচন করুন',
      readAloud: 'শুনুন (Read Aloud)',
      stopReading: 'থামান',
    },
    stages: {
      BATCH_ENGINE: 'ব্যাচ রিকভারি ইঞ্জিন',
      TRIAGE: 'শ্রেণীবিভাগ পর্যায় (Triage)',
      OUTREACH: 'যোগাযোগ পর্যায় (Outreach)',
      DEFAULT: 'এজেন্ট সম্পাদন',
    },
    translateAction: (action) => {
      const text = action.toLowerCase();
      if (text.includes('silent retry')) return 'পেমেন্ট গেটওয়ের মাধ্যমে নীরব পুনঃপ্রয়াস নির্ধারিত হয়েছে।';
      if (text.includes('escalated')) return 'বিষয়টি মানব সহায়তা দলের কাছে হস্তান্তর করা হয়েছে।';
      if (text.includes('conversational outreach') || text.includes('routed')) return 'গ্রাহকের সাথে সরাসরি যোগাযোগের জন্য আউটরিচ পর্যায়ে পাঠানো হয়েছে।';
      return 'সুরক্ষিত Razorpay পেমেন্ট লিংক সহ গ্রাহককে বার্তা পাঠানো হয়েছে।';
    },
    translateReasoning: (reasoning) => {
      const text = reasoning.toLowerCase();
      if (text.includes('timeout') || text.includes('bank timeout')) {
        return 'প্রযুক্তিগত ব্যাংক টাইমআউট সনাক্ত হয়েছে। গ্রাহককে বিরক্ত না করে ব্যাকগ্রাউন্ডে পুনরায় চেষ্টা করা হচ্ছে।';
      }
      if (text.includes('max attempts') || text.includes('harassment') || text.includes('stopping rule')) {
        return 'সর্বোচ্চ প্রচেষ্টা সমাপ্ত। গ্রাহক স্বার্থ রক্ষায় মানব সহায়তা দলের কাছে পাঠানো হয়েছে।';
      }
      if (text.includes('outreach') || text.includes('razorpay') || text.includes('interaction')) {
        return 'Razorpay পেমেন্ট লিংক প্রস্তুত করে গ্রাহকের মাতৃভাষায় বার্তা পাঠানো হয়েছে।';
      }
      return 'AI এজেন্ট নীতি ও নিয়মাবলী মেনে সম্পূর্ণ স্বাধীন সিদ্ধান্ত নিয়েছে।';
    },
  },

  pa: {
    ui: {
      title: 'ਸਪੱਸ਼ਟ ਆਡਿਟ ਟ੍ਰੇਲ',
      subtitle: 'ਰੀਅਲ-ਟਾਈਮ ਏਆਈ ਲੌਗ ਜੋ ਦੱਸਦੇ ਹਨ ਕਿ ਏਜੰਟ ਨੇ ਹਰੇਕ ਲੈਣ-ਦੇਣ ਨੂੰ ਕਿਵੇਂ ਪ੍ਰੋਸੈਸ ਕੀਤਾ।',
      stage: 'ਪ੍ਰਕਿਰਿਆ ਪੜਾਅ',
      action: 'ਕੀਤੀ ਗਈ ਕਾਰਵਾਈ',
      reasoning: 'ਏਆਈ ਦਾ ਸਵੈ-ਚਾਲਿਤ ਤਰਕ ਅਤੇ ਫੈਸਲਾ',
      selectLang: 'ਭਾਸ਼ਾ ਚੁਣੋ',
      emptyLogs: 'ਕੋਈ ਆਡਿਟ ਲੌਗ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਪਹਿਲਾਂ ਬੈਚ ਇੰਜਣ ਚਲਾਓ।',
      activeLanguageBadge: 'ਸਾਰੀ ਸਮੱਗਰੀ ਪ੍ਰਦਰਸ਼ਿਤ ਕਰਨ ਵਾਲੀ ਭਾਸ਼ਾ',
      reasoningPrefix: 'ਫੈਸਲਾ ਵਿਸ਼ਲੇਸ਼ਣ',
      txnPrefix: 'ਲੈਣ-ਦੇਣ ਆਈਡੀ',
      quickSwitch: 'ਤੁਰੰਤ ਬਦਲੋ',
      selectPrompt: 'ਭਾਰਤੀ ਭਾਸ਼ਾ ਚੁਣੋ',
      readAloud: 'ਸੁਣੋ (Read Aloud)',
      stopReading: 'ਰੋਕੋ',
    },
    stages: {
      BATCH_ENGINE: 'ਬੈਚ ਰਿਕਵਰੀ ਇੰਜਣ',
      TRIAGE: 'ਵਰਗੀਕਰਨ ਪੜਾਅ (Triage)',
      OUTREACH: 'ਸੰਪਰਕ ਪੜਾਅ (Outreach)',
      DEFAULT: 'ਏਜੰਟ ਕਾਰਵਾਈ',
    },
    translateAction: (action) => {
      const text = action.toLowerCase();
      if (text.includes('silent retry')) return 'ਪੇਮੈਂਟ ਗੇਟਵੇ ਰਾਹੀਂ ਸਾਈਲੈਂਟ ਰੀਟ੍ਰਾਈ ਸ਼ਡਿਊਲ ਕੀਤੀ ਗਈ ਹੈ।';
      if (text.includes('escalated')) return 'ਮਾਮਲਾ ਮਨੁੱਖੀ ਸਹਾਇਤਾ ਟੀਮ ਨੂੰ ਸੌਂਪਿਆ ਗਿਆ।';
      if (text.includes('conversational outreach') || text.includes('routed')) return 'ਗਾਹਕ ਨਾਲ ਸਿੱਧੇ ਰਾਬਤੇ ਲਈ ਆਊਟਰੀਚ ਵੱਲ ਭੇਜਿਆ ਗਿਆ।';
      return 'ਸੁਰੱਖਿਅਤ Razorpay ਲਿੰਕ ਨਾਲ ਗਾਹਕ ਨੂੰ ਸੁਨੇਹਾ ਭੇਜਿਆ ਗਿਆ।';
    },
    translateReasoning: (reasoning) => {
      const text = reasoning.toLowerCase();
      if (text.includes('timeout') || text.includes('bank timeout')) {
        return 'ਤਕਨੀਕੀ ਬੈਂਕ ਟਾਈਮਆਊਟ ਮਿਲਿਆ। ਗਾਹਕ ਨੂੰ ਪਰੇਸ਼ਾਨ ਕੀਤੇ ਬਿਨਾਂ ਬੈਕਗ੍ਰਾਊਂਡ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਤਹਿ ਕੀਤੀ ਗਈ।';
      }
      if (text.includes('max attempts') || text.includes('harassment') || text.includes('stopping rule')) {
        return 'ਵੱਧ ਤੋਂ ਵੱਧ ਕੋਸ਼ਿਸ਼ਾਂ ਪੂਰੀਆਂ ਹੋ ਗਈਆਂ। ਗਾਹਕ ਦੀ ਸੁਰੱਖਿਆ ਲਈ ਮਨੁੱਖੀ ਟੀਮ ਨੂੰ ਕੇਸ ਭੇਜਿਆ ਗਿਆ।';
      }
      if (text.includes('outreach') || text.includes('razorpay') || text.includes('interaction')) {
        return 'Razorpay ਭੁਗਤਾਨ ਲਿੰਕ ਬਣਾ ਕੇ ਗਾਹਕ ਦੀ ਚੁਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਸੁਨੇਹਾ ਤਿਆਰ ਕੀਤਾ ਗਿਆ।';
      }
      return 'AI ਏਜੰਟ ਨੇ ਨਿਯਮਾਂ ਅਨੁਸਾਰ ਸਵੈ-ਚਾਲਿਤ ਫੈਸਲਾ ਲਿਆ ਹੈ।';
    },
  },
};

const AuditTrail = ({ trigger, auditLogs, setAuditLogs, isLiveConnected }) => {
  const [internalLogs, setInternalLogs] = useState([]);
  const logs = auditLogs !== undefined && auditLogs.length > 0 ? auditLogs : internalLogs;
  const setLogs = setAuditLogs || setInternalLogs;
  const [selectedLang, setSelectedLang] = useState('hi-en');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { speak, stop, isSpeaking, activeSpeechId } = useSpeech();

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/audit-logs`);
        const data = await res.json();
        setLogs(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchLogs();
  }, [trigger, setLogs]);

  const dict = LOCALIZED_DICTIONARY[selectedLang] || LOCALIZED_DICTIONARY['en'];
  const ui = dict.ui;
  const currentLangObj = INDIAN_LANGUAGES.find((l) => l.id === selectedLang) || INDIAN_LANGUAGES[0];

  const getStageColor = (stage) => {
    if (stage === 'BATCH_ENGINE') return 'bg-blue-500';
    if (stage === 'OUTREACH') return 'bg-orange-500';
    if (stage === 'CHAT_SIMULATE') return 'bg-emerald-500';
    return 'bg-purple-500';
  };

  const getLogColor = (stage) => {
    if (stage === 'BATCH_ENGINE') return 'text-blue-400';
    if (stage === 'OUTREACH') return 'text-orange-400';
    if (stage === 'CHAT_SIMULATE') return 'text-emerald-400';
    return 'text-purple-400';
  };

  const getLocalizedStage = (stage) => {
    if (!stage) return dict.stages.DEFAULT;
    return dict.stages[stage] || dict.stages.DEFAULT || stage;
  };

  const handleReadAloud = (logId, stageText, actionText, reasoningText) => {
    const speechId = `log-${logId}`;
    if (isSpeaking && activeSpeechId === speechId) {
      stop();
      return;
    }

    const narration = `${stageText}. ${actionText}. ${reasoningText}`;
    speak(narration, selectedLang, speechId);
  };

  return (
    <div className="flex flex-col mt-12 lg:mt-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-2xl font-medium text-white flex items-center gap-2">
              {ui.title}
            </h3>
            {isLiveConnected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Stream
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-sm mt-1">{ui.subtitle}</p>
        </div>

        {/* Indian Language Selector Dropdown */}
        <div className="relative self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-[#1c1c1c] border border-white/10 text-xs font-medium text-zinc-200 transition-all shadow-md focus:outline-none focus:ring-1 focus:ring-orange-500/50"
          >
            <Languages className="w-4 h-4 text-orange-400" />
            <span className="font-semibold text-white">{currentLangObj.native}</span>
            <span className="text-zinc-500 text-[11px]">({currentLangObj.name})</span>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto rounded-2xl bg-[#0e0e0e] border border-white/15 shadow-2xl p-2 z-50 backdrop-blur-xl divide-y divide-white/5 custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                <span>{ui.selectPrompt}</span>
                <Sparkles className="w-3 h-3 text-orange-400" />
              </div>
              <div className="pt-1.5 space-y-1">
                {INDIAN_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => {
                      setSelectedLang(lang.id);
                      setDropdownOpen(false);
                      stop();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                      selectedLang === lang.id
                        ? 'bg-orange-500/15 text-orange-200 border border-orange-500/30'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13px]">{lang.native}</span>
                      <span className="text-zinc-500 text-[11px]">({lang.name})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-mono">
                        {lang.tag}
                      </span>
                      {selectedLang === lang.id && <Check className="w-3.5 h-3.5 text-orange-400" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Indian Language Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-4 pt-1 no-scrollbar text-xs">
        <span className="text-zinc-500 text-[11px] font-mono mr-1 flex items-center gap-1 shrink-0">
          <Globe className="w-3 h-3 text-zinc-400" /> {ui.quickSwitch}:
        </span>
        {INDIAN_LANGUAGES.slice(0, 6).map((lang) => (
          <button
            key={lang.id}
            onClick={() => {
              setSelectedLang(lang.id);
              stop();
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 border ${
              selectedLang === lang.id
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                : 'bg-white/[0.03] text-zinc-400 border-white/5 hover:bg-white/[0.07] hover:text-zinc-200'
            }`}
          >
            {lang.native}
          </button>
        ))}
      </div>

      {/* Active Language Context Banner + Read Status */}
      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 mb-4 text-xs font-mono text-orange-300/90">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-400 animate-ping' : 'bg-orange-400 animate-pulse'}`}></span>
          <span>{ui.activeLanguageBadge}: <strong className="text-orange-200">{currentLangObj.native} ({currentLangObj.name})</strong></span>
        </span>
        <div className="flex items-center gap-2">
          {isSpeaking && (
            <button
              onClick={stop}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[11px] transition-colors"
            >
              <VolumeX className="w-3 h-3" />
              <span>{ui.stopReading}</span>
            </button>
          )}
          <span className="text-[11px] text-orange-400/70 hidden sm:inline">{ui.reasoningPrefix}</span>
        </div>
      </div>

      {/* Audit Log Cards */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="p-8 border border-white/5 bg-[#0a0a0a] rounded-xl text-center text-zinc-500 font-mono text-sm">
            {ui.emptyLogs}
          </div>
        ) : (
          logs.map((log) => {
            const time = new Date(log.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const localizedStage = getLocalizedStage(log.stage);
            const localizedAction = dict.translateAction(log.action_taken || '');
            const localizedReasoning = dict.translateReasoning(log.reasoning || '');
            const speechCardId = `log-${log.id}`;
            const isCardSpeaking = isSpeaking && activeSpeechId === speechCardId;

            return (
              <div
                key={log.id}
                className={`border bg-[#0a0a0a] rounded-xl overflow-hidden transition-all shadow-lg ${
                  isCardSpeaking
                    ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/30'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="p-4 bg-white/[0.02] flex items-center justify-between cursor-pointer border-b border-white/5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className={`w-2 h-2 rounded-full ${getStageColor(log.stage)}`}></div>
                    <span className="text-sm font-medium text-white tracking-wide font-mono">
                      {ui.txnPrefix}: {log.transaction_id}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/5 font-sans">
                      {localizedStage}
                    </span>

                    {/* RBI Compliance Pass Badge next to every conversational triage step */}
                    {(log.stage === 'CHAT_SIMULATE' ||
                      log.stage === 'TRIAGE' ||
                      log.stage === 'CONVERSATIONAL' ||
                      Boolean(log.compliance_metadata?.rbi_passed)) && (
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-medium shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>RBI Compliance Pass</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Read Aloud Button per Log Card */}
                    <button
                      type="button"
                      onClick={() => handleReadAloud(log.id, localizedStage, localizedAction, localizedReasoning)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-sans transition-all border ${
                        isCardSpeaking
                          ? 'bg-orange-500 text-black font-semibold border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.5)]'
                          : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10'
                      }`}
                      title={isCardSpeaking ? ui.stopReading : ui.readAloud}
                    >
                      {isCardSpeaking ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
                          <span className="text-[11px]">{ui.stopReading}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-orange-400" />
                          <span className="text-[11px] hidden sm:inline">{ui.readAloud}</span>
                        </>
                      )}
                    </button>
                    <span className="text-xs text-zinc-500 font-mono">{time}</span>
                  </div>
                </div>

                <div className="p-5 border-t border-white/5 text-[13px] text-zinc-300 bg-black/50 leading-relaxed space-y-2.5">
                  <div>
                    <span className={getLogColor(log.stage)}>&gt;</span>{' '}
                    <span className="text-zinc-400 uppercase text-[11px] font-semibold">{ui.stage}:</span>{' '}
                    <span className="text-zinc-100 font-medium">{localizedStage}</span>
                  </div>
                  <div>
                    <span className={getLogColor(log.stage)}>&gt;</span>{' '}
                    <span className="text-zinc-400 uppercase text-[11px] font-semibold">{ui.action}:</span>{' '}
                    <span className="text-zinc-200">{localizedAction}</span>
                  </div>
                  <div className="pt-1.5 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-green-400">&gt;</span>{' '}
                      <span className="text-emerald-400 uppercase text-[11px] font-semibold flex-1 ml-1.5">{ui.reasoning}:</span>
                      {isCardSpeaking && (
                        <span className="flex items-center gap-1 text-[10px] text-orange-300 font-mono">
                          <span className="w-1 h-3 bg-orange-400 animate-[bounce_0.6s_infinite_100ms] rounded-full"></span>
                          <span className="w-1 h-4 bg-orange-400 animate-[bounce_0.6s_infinite_200ms] rounded-full"></span>
                          <span className="w-1 h-2 bg-orange-400 animate-[bounce_0.6s_infinite_300ms] rounded-full"></span>
                          <span className="ml-1">Speaking...</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-emerald-200/90 font-sans text-xs sm:text-sm bg-emerald-950/20 p-3 rounded-lg border border-emerald-500/20 leading-relaxed">
                      {localizedReasoning}
                    </p>
                  </div>

                  {/* RBI Compliance Checks Breakdown */}
                  {log.compliance_metadata && (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 font-mono">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>RBI COMPLIANCE VERIFICATION</span>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          PASSED
                        </span>
                      </div>
                      {log.compliance_metadata.checks && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10.5px]">
                          {log.compliance_metadata.checks.map((chk, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded border border-white/5 text-zinc-300"
                            >
                              <span className="text-emerald-400 font-bold">✓</span>
                              <span className="truncate">{chk}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AuditTrail;
