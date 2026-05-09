import { useState, useEffect, useRef } from 'react';
import { auth, googleProvider, signInWithPopup, signOut } from './firebase';

function App() {
  // Authentication & Loading State
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [lang, setLang] = useState('en');
  const [crop, setCrop] = useState('');
  const [soilMoisture, setSoilMoisture] = useState(50);
  const [soilNutrients, setSoilNutrients] = useState(50);
  const [temperature, setTemperature] = useState(25);
  const [weather, setWeather] = useState('');
  
  // Results & Speech State
  const [advice, setAdvice] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Phase 4: AI Diagnosis & Voice State
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  // Ref for smooth scrolling
  const adviceRef = useRef(null);
  const aiRef = useRef(null);

  // Translations Dictionary
  const translations = {
    kn: {
      "login-welcome": "ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಹಾಯಕಕ್ಕೆ ಸುಸ್ವಾಗತ",
      "login-subtitle": "ಸೆನ್ಸರ್ ಡೇಟಾ, ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಮತ್ತು ಧ್ವನಿ ಸಹಾಯಕದೊಂದಿಗೆ ನಿಮ್ಮ ಬೆಳೆಗಳನ್ನು ಅತ್ಯುತ್ತಮವಾಗಿ ನಿರ್ವಹಿಸಲು ಸಹಾಯ ಮಾಡುವ ಕೃಷಿ ಪೋರ್ಟಲ್. ಮುಂದುವರಿಯಲು ಲಾಗಿನ್ ಮಾಡಿ.",
      "btn-login": "ಗೂಗಲ್‌ನೊಂದಿಗೆ ಲಾಗಿನ್ ಮಾಡಿ",
      "btn-logging-in": "ಲಾಗಿನ್ ಆಗುತ್ತಿದೆ...",
      "lbl-mock": "ಡೆಮೊ ಸ್ಯಾಂಡ್‌ಬาಕ್ಸ್ ಮೋಡ್",
      "lbl-prod": "ಲೈವ್ ಫೈರ್‌ಬೇಸ್ ಸಕ್ರಿಯ",
      "welcome-user": "ನಮಸ್ಕಾರ, ",
      "ready-message": "ಇವತ್ತಿನ ನಿಮ್ಮ ಬೆಳೆಗಳ ಸ್ಥಿತಿ ಪರಿಶೀಲಿಸಿ!",
      "btn-logout": "ಲಾಗ್ ಔಟ್",
      "header-title": "ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಹಾಯಕ",
      "header-subtitle": "ಸೆನ್ಸರ್ ಡೇಟಾದ ಮೇಲೆ ಸರಳ, ಬೆಳೆ-ನಿರ್ದಿಷ್ಟ ಸಲಹೆಗಳು ಪಡೆಯಿರಿ",
      "section-crop": "ಬೆಳೆ ಆಯ್ಕೆಮಾಡಿ",
      "section-telemetry": "ಸೆನ್ಸರ್ ಡೇಟಾ (ರಿಯಲ್-ಟೈಮ್ ಟೆಲಿಮೆಟ್ರಿ)",
      "section-weather": "ಸ್ಥಳೀಯ ಹವಾಮಾನ ಸ್ಥಿತಿ",
      "section-ai": "AI ಬೆಳೆ ರೋಗ ಪತ್ತೆ",
      "section-voice": "ಧ್ವನಿ ಸಹಾಯಕ",
      "label-moisture": "ಮಣ್ಣಿನ ತೇವಾಂಶ",
      "label-nutrients": "ಮಣ್ಣಿನ ಪೋಷಕಾಂಶ (NPK)",
      "label-temperature": "ತಾಪಮಾನ",
      "label-upload": "ಎಲೆಯ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
      "maize": "ಮೆಕ್ಕೆಜೋಳ",
      "rice": "ಭತ್ತ (ಅನ್ನ)",
      "beans": "ಬೀನ್ಸ್",
      "tomato": "ಟೊಮೇಟೋ",
      "weather-dry": "ಬಿಲ್ಲು (ಒಣ)",
      "weather-rainy": "ಮಳೆಯಾಗುತ್ತದೆ",
      "weather-cloudy": "ಮೇಘಾವೃತ",
      "weather-sunny": "ಬೆಳಗಿನ ಹೊತ್ತು (ಬಿಸಿಲು)",
      "btn-get-advice": "ಸಲಹೆ ಪಡೆಯಿರಿ",
      "btn-analyze-leaf": "AI ವಿಶ್ಲೇಷಣೆ ಪ್ರಾರಂಭಿಸಿ",
      "btn-speak": "🔊 ಸಲಹೆಯನ್ನು ಕೇಳಿ",
      "btn-stop": "⏹️ ಧ್ವನಿ ನಿಲ್ಲಿಸಿ",
      "btn-voice-start": "🎤 ಪ್ರಶ್ನೆ ಕೇಳಲು ಒತ್ತಿ",
      "btn-voice-stop": "🛑 ಆಲಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿ",
      "placeholder-advice": "ಇಲ್ಲಿ ನಿಮ್ಮ ಸಲಹೆ ಕಾಣಿಸುತ್ತದೆ...",
      "advice-header": "ನಿಮ್ಮ ಕೃಷಿ ಶಿಫಾರಸುಗಳು",
      "ai-header": "AI ರೋಗ ವಿಶ್ಲೇಷಣೆ ಫಲಿತಾಂಶ",
      "ai-processing": "AI ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ, ದಯವಿಟ್ಟು ಕಾಯಿರಿ...",
      "voice-listening": "ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಆಲಿಸುತ್ತಿದೆ...",
      "footer-text": "© 2026 ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಹಾಯಕ | ಇಲೆಕ್ಟ್ರಾನಿಕ್ಸ್ ಮತ್ತು ಕಮ್ಯುನಿಕೇಷನ್ ಎಂಜಿನಿಯರಿಂಗ್, DBIT"
    },
    en: {
      "login-welcome": "Welcome to Smart Farming Assistant",
      "login-subtitle": "Get instant, tailored agricultural advice based on real-time IoT sensors, weather conditions, and audio synthesis. Please sign in to continue.",
      "btn-login": "Sign in with Google",
      "btn-logging-in": "Signing in...",
      "lbl-mock": "Demo Sandbox Mode Enabled",
      "lbl-prod": "Live Production Authentication Active",
      "welcome-user": "Hello, ",
      "ready-message": "Ready to check your crops today?",
      "btn-logout": "Sign Out",
      "header-title": "Smart Farming Assistant",
      "header-subtitle": "Get simple, crop-specific advice based on sensor data",
      "section-crop": "Select Your Crop",
      "section-telemetry": "Sensor Data (Real-time Telemetry)",
      "section-weather": "Local Weather Conditions",
      "section-ai": "AI Disease Diagnosis",
      "section-voice": "AI Voice Assistant",
      "label-moisture": "Soil Moisture",
      "label-nutrients": "Soil Nutrients (NPK)",
      "label-temperature": "Temperature",
      "label-upload": "Upload Leaf Image for Diagnosis",
      "maize": "Maize",
      "rice": "Rice",
      "beans": "Beans",
      "tomato": "Tomato",
      "weather-dry": "Dry",
      "weather-rainy": "Rainy",
      "weather-cloudy": "Cloudy",
      "weather-sunny": "Sunny",
      "btn-get-advice": "Analyze & Get Advice",
      "btn-analyze-leaf": "Start AI Analysis",
      "btn-speak": "🔊 Listen to Advice",
      "btn-stop": "⏹️ Stop Listening",
      "btn-voice-start": "🎤 Ask a Voice Question",
      "btn-voice-stop": "🛑 Stop Listening",
      "placeholder-advice": "Your agricultural recommendations will appear here...",
      "advice-header": "Your Custom Advisory",
      "ai-header": "AI Diagnosis Result",
      "ai-processing": "AI is analyzing the leaf, please wait...",
      "voice-listening": "Listening to your query...",
      "footer-text": "© 2026 Smart Farming Assistant | Dept of Electronics & Communication, DBIT"
    }
  };

  const t = translations[lang];

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Auth observer for Production Firebase
  useEffect(() => {
    if (auth) {
      const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'
          });
        } else {
          setUser(null);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Language Change Cleanup
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    stopSpeaking();
  }, [lang]);

  // Input Change Cleanup
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdvice('');
    stopSpeaking();
  }, [crop, weather, soilMoisture, soilNutrients, temperature]);

  // Smoothly scroll to the advice panel whenever advice is generated
  useEffect(() => {
    if (advice && adviceRef.current) {
      adviceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [advice]);

  // Smoothly scroll to AI Result
  useEffect(() => {
    if (aiResult && aiRef.current) {
      aiRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [aiResult]);

  // --- PHASE 4: AI & VOICE LOGIC ---

  const callGeminiAPI = async (prompt, imageData = null) => {
    const contents = [{
      parts: [{ text: prompt }]
    }];

    if (imageData) {
      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
      contents[0].parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: base64Data
        }
      });
    }

    const payload = {
      contents,
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    try {
      // Point to our secure Netlify Function backend
      const response = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        return `AI Error (${response.status}): ${data.error?.message || 'Server connection failed'}`;
      }

      if (data.text) {
        return data.text;
      } else if (data.error === "SAFETY_BLOCKED") {
        return "AI analysis was blocked by safety filters. Try a clearer image or different query.";
      } else if (data.error === "PROMPT_BLOCKED") {
        return `AI Blocked: ${data.reason}`;
      } else {
        return "AI returned an unexpected response. Please try again.";
      }
    } catch (e) {
      console.error("Netlify Function Connection Error:", e);
      return `Connection failed: ${e.message}. Please check your internet.`;
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
        setAiResult('');
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeLeaf = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setAiResult('');

    const prompt = `You are an expert agronomist. Analyze this leaf image and identify any diseases or pests. Provide a detailed diagnosis and recommended treatment in ${lang === 'kn' ? 'Kannada' : 'English'}. If no disease is found, provide general maintenance advice for the plant. Keep it concise and practical for a farmer.`;

    const result = await callGeminiAPI(prompt, selectedImage);
    setAiResult(result);
    setIsAnalyzing(false);
  };

  const startVoiceAssistant = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'kn' ? 'kn-IN' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      setAiResult(lang === 'kn' ? `ನೀವು ಕೇಳಿದ್ದು: "${transcript}"\nAI ಪ್ರತಿಕ್ರಿಯೆಗಾಗಿ ಕಾಯಿರಿ...` : `You asked: "${transcript}"\nWaiting for AI response...`);
      
      const prompt = `You are a helpful farming assistant. Answer this farming query in ${lang === 'kn' ? 'Kannada' : 'English'}: ${transcript}`;
      const result = await callGeminiAPI(prompt);
      setAiResult(result);

      // Auto-speak the response
      const utterance = new SpeechSynthesisUtterance(result);
      utterance.lang = lang === 'kn' ? 'kn-IN' : 'en-US';
      window.speechSynthesis.speak(utterance);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Check if form is valid to enable Advice button
  const isValid = crop !== '' && weather !== '';

  const handleGoogleLogin = () => {
    setIsLoading(true);
    signInWithPopup(auth, googleProvider)
      .catch((error) => {
        console.error("Firebase Login Error:", error);
        alert("Authentication failed. Please verify your internet connection.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => setUser(null));
    }
    setAdvice('');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const generateAdvice = () => {
    const moisture = parseInt(soilMoisture, 10);
    const nutrients = parseInt(soilNutrients, 10);
    const temp = parseInt(temperature, 10);

    const adv_en = {
      water_low: 'Soil moisture is low. Water your crop today for 15 minutes. ',
      water_high: 'Soil moisture is high. Avoid watering to prevent waterlogging. ',
      water_ok: 'Soil moisture is adequate. No watering needed now. ',
      nutrient_low: 'Soil nutrients are low. Apply fertilizer according to crop needs. ',
      nutrient_ok: 'Soil nutrients are sufficient. No fertilization needed now. ',
      temp_low: 'Temperature is low. Protect plants from cold conditions. ',
      temp_high: 'Temperature is high. Provide shade or irrigation to reduce heat stress. ',
      temp_ok: 'Temperature is within the optimal range for growth. ',
      weather_rainy: 'Rain is expected. Delay watering and check for pests after rain. ',
      weather_dry: 'Dry weather expected. Monitor soil moisture closely. ',
      crop_notes: {
        maize: 'Maize requires regular monitoring during growth stages.',
        rice: 'Rice fields need careful water management.',
        beans: 'Beans benefit from balanced fertilization.',
        tomato: 'Tomatoes are sensitive to overwatering.'
      }
    };

    const adv_kn = {
      water_low: 'ಮಣ್ಣಿನ ತೇವಾಂಶ ಕಡಿಮೆ ಇದೆ. ನಿಮ್ಮ ಬೆಳೆಗೆ ಇವತ್ತು 15 ನಿಮಿಷ ನೀರು ಕೊಡಿರಿ. ',
      water_high: 'ಮಣ್ಣಿನ ತೇವಾಂಶ ಅಧಿಕವಾಗಿದೆ. ಜಲನಿರೋಧವನ್ನು ತಡೆಯಲು ನೀರುಡಿಸುವುದನ್ನು ತಪ್ಪಿಸಿ. ',
      weather_dry: 'ಬಿಲ್ಲು ಹವಾಮಾನ ನಿರೀಕ್ಷಿಸಲಾಗಿದೆ. ಮಣ್ಣಿನ ತೇವಾಂಶವನ್ನು ಹತ್ತಿರದಿಂದ ಪರಿಶೀಲಿಸಿ. ',
      water_ok: 'ಮಣ್ಣಿನ ತೇವಾಂಶ ಸಮರ್ಪಕವಾಗಿದೆ. ಈಗ ನೀರು ಹಾಕುವ ಅಗತ್ಯವಿಲ್ಲ. ',
      nutrient_low: 'ಮಣ್ಣಿನ ಪೋಷಕಾಂಶ ಕಡಿಮೆ ಇದೆ. ಬೆಳೆ ಅಗತ್ಯಕ್ಕೆ ಅನುಗುಣವಾಗಿ ಉಪಪೋಷಣೆ ಮಾಡಿರಿ. ',
      nutrient_ok: 'ಮಣ್ಣಿನ ಪೋಷಕಾಂಶ ಸಮರ್ಪಕವಾಗಿದೆ. ಈಗ ಉಪಪೋಷಣೆಯ ಅಗತ್ಯವಿಲ್ಲ. ',
      temp_low: 'ತಾಪಮಾನ ಕಡಿಮೆ ಇದೆ. ಬೆಳೆದಿರುವ ಗಿಡಗಳನ್ನು ತಂಪಿನಿಂದ ರಕ್ಷಿಸಿ. ',
      temp_high: 'ತಾಪಮಾನ ಹೆಚ್ಚು ಇದೆ. ಹಾನಿ ತಪ್ಪಿಸಲು ನೆರಳು ಅಥವಾ ನೀರು ನೀಡಿರಿ. ',
      temp_ok: 'ತಾಪಮಾನ ಬೆಳವಣಿಗೆಯ ಅನುಕೂಲಕರ ಶ್ರೇಣಿಯಲ್ಲಿದೆ. ',
      weather_rainy: 'ಮಳೆ ನಿರೀಕ್ಷಿಸಲಾಗಿದೆ. ನೀರುಡಿಸುವಿಕೆಯನ್ನು ವಿಳಂಬಮಾಡಿ ಮತ್ತು ಮಳೆಯ ನಂತರ ಕೀಟಗಳ ಪರಿಶೀಲನೆ ಮಾಡಿ. ',
      crop_notes: {
        maize: 'ಮೆಕ್ಕೆಜೋಳ ಬೆಳವಣಿಗೆಯ ಹಂತಗಳಲ್ಲಿ ನಿಯಮಿತ ಪರಿಶೀಲನೆ ಅಗತ್ಯವಿದೆ.',
        rice: 'ಅನ್ನ ಬೆಳೆಗಳಿಗೆ ಜಾಗರೂಕ ನೀರಿನ ನಿರ್ವಹಣೆ ಅಗತ್ಯ. ',
        beans: 'ಬೀನ್ಸ್ ಸಮತೋಲನ ಪೋಷಣೆಯಿಂದ ಪ್ರಯೋಜನ ಪಡೆಯುತ್ತದೆ. ',
        tomato: 'ಟೊಮೇಟೋಗಳು ಹೆಚ್ಚಿನ ನೀರಿನಿಂದ ಸಂವೇದನಶೀಲವಾಗಿವೆ.'
      }
    };

    const adv = lang === 'kn' ? adv_kn : adv_en;
    let adviceResult = '';

    if (moisture < 30) {
      adviceResult += adv.water_low;
    } else if (moisture > 70) {
      adviceResult += adv.water_high;
    } else {
      adviceResult += adv.water_ok;
    }

    if (nutrients < 40) {
      adviceResult += adv.nutrient_low;
    } else {
      adviceResult += adv.nutrient_ok;
    }

    if (temp < 15) {
      adviceResult += adv.temp_low;
    } else if (temp > 35) {
      adviceResult += adv.temp_high;
    } else {
      adviceResult += adv.temp_ok;
    }

    if (weather === 'rainy') {
      adviceResult += adv.weather_rainy;
    } else if (weather === 'dry') {
      adviceResult += adv.weather_dry;
    }

    if (adv.crop_notes[crop]) {
      adviceResult += adv.crop_notes[crop];
    }

    setAdvice(adviceResult);
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }

    if ('speechSynthesis' in window) {
      const speechLang = lang === 'kn' ? 'kn-IN' : 'en-US';
      const utterance = new SpeechSynthesisUtterance(advice);
      utterance.lang = speechLang;

      const voices = window.speechSynthesis.getVoices();
      let voice = null;
      if (speechLang === 'kn-IN') {
        voice = voices.find(v => v.lang.toLowerCase().startsWith('kn'));
      }
      if (!voice) {
        voice = voices.find(v => v.lang.startsWith('en-US')) || voices[0];
      }
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } else {
      alert(lang === 'kn' ? 
        'ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ಬ್ರೌಸರ್ ಧ್ವನಿಸಿಂಥೆಸಿಸ್ ಅನ್ನು ಬೆಂಬಲಿಸುವುದಿಲ್ಲ.' : 
        'Sorry, your browser does not support speech synthesis.'
      );
    }
  };

  // --- RENDERING VIEWS ---

  // 1. Render Google Auth Login Page (if user is not signed in)
  if (!user) {
    return (
      <div className="glass-panel login-container">
        {/* Language Switcher */}
        <div className="language-container" style={{ alignSelf: 'stretch', marginBottom: '0rem' }}>
          <div className="lang-btn-group" style={{ marginLeft: 'auto' }}>
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>English</button>
            <button className={`lang-btn ${lang === 'kn' ? 'active' : ''}`} onClick={() => setLang('kn')}>ಕನ್ನಡ</button>
          </div>
        </div>

        <div className="login-illustration">🚜🌾</div>
        <h1>{t["login-welcome"]}</h1>
        <p className="login-subtitle">{t["login-subtitle"]}</p>

        <button 
          className="btn-google" 
          onClick={handleGoogleLogin} 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="spinner"></div>
              <span>{t["btn-logging-in"]}</span>
            </>
          ) : (
            <>
              <svg className="google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{t["btn-login"]}</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // 2. Render Main Dashboard (once user is successfully logged in)
  return (
    <div className="glass-panel">
      {/* Top Navigation Bar */}
      <div className="top-nav">
        <div className="user-profile">
          <img className="user-avatar" src={user.photoURL} alt={user.displayName} />
          <div className="user-details">
            <span className="user-name">{t["welcome-user"]}{user.displayName.split(' ')[0]} 👋</span>
            <button className="btn-logout" onClick={handleLogout}>{t["btn-logout"]}</button>
          </div>
        </div>

        <div className="lang-btn-group">
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>English</button>
          <button className={`lang-btn ${lang === 'kn' ? 'active' : ''}`} onClick={() => setLang('kn')}>ಕನ್ನಡ</button>
        </div>
      </div>

      {/* Main Header */}
      <header>
        <h1>{t["header-title"]}</h1>
        <p style={{ color: '#a7f3d0', fontWeight: '500', marginBottom: '0.4rem' }}>{t["ready-message"]}</p>
        <p>{t["header-subtitle"]}</p>
      </header>

      {/* Section 1: Crop Selection */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">🌾 {t["section-crop"]}</h2>
        <div className="crop-grid">
          {[
            { id: 'maize', emoji: '🌽', label: t["maize"] },
            { id: 'rice', emoji: '🌾', label: t["rice"] },
            { id: 'beans', emoji: '🫘', label: t["beans"] },
            { id: 'tomato', emoji: '🍅', label: t["tomato"] },
          ].map((item) => (
            <div 
              key={item.id}
              className={`crop-option ${crop === item.id ? 'selected' : ''}`}
              onClick={() => setCrop(item.id)}
            >
              <span className="emoji">{item.emoji}</span>
              <span className="label">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Sensor Telemetry */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">📊 {t["section-telemetry"]}</h2>
        <div className="telemetry-grid">
          {/* Soil Moisture */}
          <div className="glass-card slider-card">
            <div className="slider-header">
              <span className="form-label">{t["label-moisture"]}</span>
              <span className="slider-value">{soilMoisture}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              className="slider-input"
              value={soilMoisture}
              onChange={(e) => setSoilMoisture(e.target.value)}
            />
          </div>

          {/* Soil Nutrients */}
          <div className="glass-card slider-card">
            <div className="slider-header">
              <span className="form-label">{t["label-nutrients"]}</span>
              <span className="slider-value">{soilNutrients} NPK</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              className="slider-input"
              value={soilNutrients}
              onChange={(e) => setSoilNutrients(e.target.value)}
            />
          </div>

          {/* Temperature */}
          <div className="glass-card slider-card">
            <div className="slider-header">
              <span className="form-label">{t["label-temperature"]}</span>
              <span className="slider-value">{temperature}°C</span>
            </div>
            <input 
              type="range" 
              min="-10" 
              max="60" 
              className="slider-input"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Section 3: Weather Selection */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">☀️ {t["section-weather"]}</h2>
        <div className="weather-grid">
          {[
            { id: 'dry', emoji: '🏜️', label: t["weather-dry"] },
            { id: 'rainy', emoji: '🌧️', label: t["weather-rainy"] },
            { id: 'cloudy', emoji: '☁️', label: t["weather-cloudy"] },
            { id: 'sunny', emoji: '☀️', label: t["weather-sunny"] },
          ].map((item) => (
            <div 
              key={item.id}
              className={`weather-option ${weather === item.id ? 'selected' : ''}`}
              onClick={() => setWeather(item.id)}
            >
              <span className="emoji">{item.emoji}</span>
              <span className="label">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PHASE 4: AI & VOICE UI */}
      <div className="phase4-grid">
        {/* Section 4: AI Diagnosis */}
        <section className="glass-card ai-section">
          <h2 className="section-title">📸 {t["section-ai"]}</h2>
          <p className="form-label">{t["label-upload"]}</p>
          
          <div className="upload-container">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload} 
              id="leaf-upload" 
              style={{ display: 'none' }}
            />
            <label htmlFor="leaf-upload" className="btn-upload">
              {selectedImage ? "✅ Image Selected" : "📁 Choose Image"}
            </label>
            
            {selectedImage && (
              <div className="image-preview-wrapper">
                <img src={selectedImage} alt="Preview" className="image-preview" />
                <button 
                  className="btn-primary" 
                  onClick={analyzeLeaf} 
                  disabled={isAnalyzing}
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  {isAnalyzing ? t["ai-processing"] : t["btn-analyze-leaf"]}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Section 5: Voice Assistant */}
        <section className="glass-card voice-section">
          <h2 className="section-title">🎙️ {t["section-voice"]}</h2>
          <p className="form-label" style={{ marginBottom: '1.5rem' }}>Ask anything about farming!</p>
          
          <button 
            className={`btn-voice ${isListening ? 'listening' : ''}`}
            onClick={startVoiceAssistant}
            disabled={isListening}
          >
            {isListening ? (
              <>
                <div className="pulse-ring"></div>
                <span>{t["voice-listening"]}</span>
              </>
            ) : (
              <span>{t["btn-voice-start"]}</span>
            )}
          </button>
        </section>
      </div>

      {/* AI Result Display */}
      {aiResult && (
        <div ref={aiRef} className="glass-card advice-panel ai-result-panel">
          <div className="advice-header">
            <span>🤖</span>
            <span>{t["ai-header"]}</span>
          </div>
          <p className="advice-content">{aiResult}</p>
        </div>
      )}

      {/* Actions */}
      <div className="control-actions">
        <button 
          className="btn-primary"
          onClick={generateAdvice}
          disabled={!isValid}
        >
          🔍 {t["btn-get-advice"]}
        </button>
      </div>

      {/* Advice Display */}
      {advice && (
        <div ref={adviceRef} className="glass-card advice-panel">
          <div className="advice-header">
            <span>📋</span>
            <span>{t["advice-header"]}</span>
          </div>
          <p className="advice-content">{advice}</p>

          <div className="audio-action-container">
            <button 
              className={`btn-audio ${isSpeaking ? 'playing' : ''}`}
              onClick={handleSpeak}
            >
              {isSpeaking ? (
                <>
                  <div className="eq-bars">
                    <div className="eq-bar"></div>
                    <div className="eq-bar"></div>
                    <div className="eq-bar"></div>
                  </div>
                  <span>{t["btn-stop"]}</span>
                </>
              ) : (
                <span>{t["btn-speak"]}</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Premium Footer */}
      <footer>
        <p>{t["footer-text"]}</p>
      </footer>
    </div>
  );
}

export default App;
