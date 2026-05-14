import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { BUILT_IN_CROPS } from '../data/cropProfiles';
import { generateRuleAdvice } from '../engine/adviceEngine';
import { fetchFieldAdvice, callGeminiAPI } from '../engine/geminiAdvisor';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  // Authentication & Loading State
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Field & Crop State
  const [activeCrop, setActiveCrop] = useState(null);
  const [customCrops, setCustomCrops] = useState([]);
  const [lang, setLang] = useState('en');
  const [soilMoisture, setSoilMoisture] = useState(50);
  const [soilNutrients, setSoilNutrients] = useState(50);
  const [temperature, setTemperature] = useState(25);
  const [weather, setWeather] = useState('sunny');
  
  // Dashboard Live Data State
  const [humidity, setHumidity] = useState(null);
  const [windSpeed, setWindSpeed] = useState(null);
  const [locationName, setLocationName] = useState('');
  
  // Results & Speech State
  const [advice, setAdvice] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Derived Alerts
  const ruleAlerts = useMemo(() => {
    if (activeCrop) {
      return generateRuleAdvice(activeCrop, soilMoisture, soilNutrients, temperature, weather, lang);
    }
    return [];
  }, [activeCrop, soilMoisture, soilNutrients, temperature, weather, lang]);

  // Phase 4: AI Diagnosis & Voice State
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isFetchingAI, setIsFetchingAI] = useState(false);
  
  // Refs
  const adviceRef = useRef(null);
  const aiRef = useRef(null);

  // Global Data Loader
  const loadUserData = async (currentUser) => {
    if (!currentUser?.uid) return;
    setIsDataLoading(true);
    
    try {
      console.log("Context: Loading user data in parallel...");
      const userDocRef = doc(db, 'users', currentUser.uid);
      const customCropsRef = collection(db, 'users', currentUser.uid, 'customCrops');

      const [userDoc, customCropsSnap] = await Promise.all([
        getDoc(userDocRef),
        getDocs(customCropsRef)
      ]);

      const customList = customCropsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      setCustomCrops(customList);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.activeCropId) {
          const cropId = userData.activeCropId;
          const baseCrop = BUILT_IN_CROPS[cropId] || customList.find(c => c.id === cropId);
          if (baseCrop) {
            const fullActive = { ...baseCrop, ...userData.activeFieldInfo };
            setActiveCrop(fullActive);
          }
        }
      }
      console.log("Context: User data loaded successfully.");
    } catch (e) {
      console.error("Context: Error loading user data:", e);
    } finally {
      setIsDataLoading(false);
    }
  };

  // Translations
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
      "section-dashboard": "Live Field Environment",
      "label-location": "ಸ್ಥಳ",
      "label-wind": "ಗಾಳಿಯ ವೇಗ",
      "label-humidity": "ಗಾಳಿಯ ತೇವಾಂಶ",
      "section-telemetry": "ಸೆನ್ಸರ್ ಡೇಟಾ (ರಿಯಲ್-ಟೈಮ್ ಟೆಲಿಮೆಟ್ರಿ)",
      "section-weather": "ಸ್ಥಳೀಯ ಹವಾಮಾನ ಸ್ಥಿತಿ",
      "section-ai": "AI ಬೆಳೆ ರೋಗ ಪತ್ತೆ",
      "section-voice": "ಧ್ವನಿ ಸಹಾಯಕ",
      "label-moisture": "ಮಣ್ಣಿನ ತೇವಾಂಶ",
      "label-nutrients": "ಮಣ್ಣಿನ ಪೋಷಕಾಂಶ (NPK)",
      "label-temperature": "ತಾಪಮಾನ",
      "label-upload": "ಎಲೆಯ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
      "weather-dry": "ಬಿಲ್ಲು (ಒಣ)",
      "weather-rainy": "ಮಳೆಯಾಗುತ್ತದೆ",
      "weather-cloudy": "ಮೇಘಾವೃತ",
      "weather-sunny": "ಬೆಳಗಿನ ಹೊತ್ತು (ಬಿಸಿಲು)",
      "btn-get-advice": "ಕ್ಷೇತ್ರ ವಿಶ್ಲೇಷಿಸಿ",
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
      "footer-text": "© 2026 ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಹಾಯಕ | ಇಲೆಕ್ಟ್ರಾನಿಕ್ಸ್ ಮತ್ತು ಕಮ್ಯುನಿಕೇಷನ್ ಎಂಜಿನಿಯರಿಂಗ್, DBIT",
      "nav-dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
      "nav-crops": "ಬೆಳೆಗಳು",
      "nav-diagnosis": "ರೋಗ ಪತ್ತೆ",
      "nav-assistant": "ಸಹಾಯಕ"
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
      "section-dashboard": "Live Field Environment",
      "label-location": "Location",
      "label-wind": "Wind Speed",
      "label-humidity": "Humidity",
      "section-telemetry": "Sensor Data (Real-time Telemetry)",
      "section-weather": "Local Weather Conditions",
      "section-ai": "AI Disease Diagnosis",
      "section-voice": "AI Voice Assistant",
      "label-moisture": "Soil Moisture",
      "label-nutrients": "Soil Nutrients (NPK)",
      "label-temperature": "Temperature",
      "label-upload": "Upload Leaf Image for Diagnosis",
      "weather-dry": "Dry",
      "weather-rainy": "Rainy",
      "weather-cloudy": "Cloudy",
      "weather-sunny": "Sunny",
      "btn-get-advice": "Analyze My Field",
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
      "footer-text": "© 2026 Smart Farming Assistant | Dept of Electronics & Communication, DBIT",
      "nav-dashboard": "Dashboard",
      "nav-crops": "Crops",
      "nav-diagnosis": "Diagnosis",
      "nav-assistant": "Assistant"
    }
  };

  const t = translations[lang];

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const fetchWeather = (silent = false, manualLat = null, manualLon = null) => {
    const fetchWithCoords = async (lat, lon, name = null) => {
      try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();
        
        if (!name) {
          try {
            const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`;
            const geoRes = await fetch(geoUrl, { headers: { 'Accept-Language': lang } });
            const geoData = await geoRes.json();
            const addr = geoData.address || {};
            const localArea = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city_district || geoData.display_name?.split(',')[0];
            const city = addr.city || addr.town || addr.municipality || '';
            setLocationName(city && localArea !== city ? `${localArea}, ${city}` : localArea);
          } catch (geError) {
            console.warn("Geo naming failed", geError);
            setLocationName(`${lat.toFixed(2)}, ${lon.toFixed(2)}`);
          }
        } else {
          setLocationName(name);
        }

        if (weatherRes.ok) {
          const current = weatherData.current;
          setTemperature(Math.round(current.temperature_2m));
          setHumidity(current.relative_humidity_2m);
          setWindSpeed(current.wind_speed_10m);
          const code = current.weather_code;
          let condition = 'sunny';
          if (code >= 1 && code <= 3) condition = 'cloudy';
          else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) condition = 'rainy';
          else if (code === 0) condition = 'sunny';
          else condition = 'dry';
          setWeather(condition);
          if (!silent) alert(lang === 'kn' ? 'ಹವಾಮಾನ ಡೇಟಾವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ನವೀಕರಿಸಲಾಗಿದೆ!' : 'Weather data updated successfully!');
        }
      } catch (err) {
        console.error("Weather fetch failed", err);
        if (!silent) alert(lang === 'kn' ? 'ಹವಾಮಾನ ಡೇಟಾವನ್ನು ಪಡೆಯಲು ವಿಫಲವಾಗಿದೆ. ನೆಟ್‌ವರ್ಕ್ ಪರಿಶೀಲಿಸಿ.' : 'Failed to fetch weather data. Check your connection.');
      }
    };

    if (manualLat !== null && manualLon !== null) {
      fetchWithCoords(manualLat, manualLon);
      return;
    }

    if (!navigator.geolocation) {
      if (!silent) alert(lang === 'kn' ? 'ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಜಿಯೋಲೋಕೇಶನ್ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ.' : 'Geolocation is not supported by your browser.');
      return;
    }

    const geoOptions = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
    const geoError = (err) => {
      console.warn(`Geolocation Error (${err.code}): ${err.message}`);
      if (!silent) alert(lang === 'kn' ? 'ಸ್ಥಳ ಪ್ರವೇಶವನ್ನು ನಿರಾಕರಿಸಲಾಗಿದೆ ಅಥವಾ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಅನುಮತಿ ನೀಡಿ.' : 'Location access denied or unavailable. Please enable permissions.');
    };

    navigator.geolocation.getCurrentPosition(
      (position) => fetchWithCoords(position.coords.latitude, position.coords.longitude),
      geoError,
      geoOptions
    );
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        const userObj = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'
        };
        setUser(userObj);
        loadUserData(userObj); // Trigger global load on login
      } else {
        setUser(null);
        setActiveCrop(null);
        setCustomCrops([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      if (activeCrop?.location?.lat) {
        // If we already have a location name and it matches the crop's location name, 
        // we might not need to fetch weather immediately if it was just set.
        // But for simplicity, we just fetch, but ensures manual coords are used.
        fetchWeather(true, activeCrop.location.lat, activeCrop.location.lon);
      } else {
        fetchWeather(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeCrop?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    stopSpeaking();
  }, [lang]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdvice('');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    stopSpeaking();
  }, [weather, soilMoisture, soilNutrients, temperature, activeCrop]);

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
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'kn' ? 'kn-IN' : 'en-US';
    recognition.onstart = () => {
      setIsListening(true);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsSpeaking(false);
    };
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      setAiResult(lang === 'kn' ? `ನೀವು ಕೇಳಿದ್ದು: "${transcript}"\nAI ಪ್ರತಿಕ್ರಿಯೆಗಾಗಿ ಕಾಯಿರಿ...` : `You asked: "${transcript}"\nWaiting for AI response...`);
      const prompt = `You are a helpful farming assistant. Answer this farming query in ${lang === 'kn' ? 'Kannada' : 'English'}: ${transcript}`;
      const result = await callGeminiAPI(prompt);
      setAiResult(result);
      const utterance = new SpeechSynthesisUtterance(result);
      utterance.lang = lang === 'kn' ? 'kn-IN' : 'en-US';
      window.speechSynthesis.speak(utterance);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    signInWithPopup(auth, googleProvider).finally(() => setIsLoading(false));
  };

  const handleLogout = () => {
    if (auth) signOut(auth).then(() => setUser(null));
    setAdvice('');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const generateAdvice = async () => {
    if (!activeCrop) return;
    setIsFetchingAI(true);
    const geminiAdvice = await fetchFieldAdvice(activeCrop, soilMoisture, soilNutrients, temperature, weather, lang);
    setAdvice(geminiAdvice);
    setIsFetchingAI(false);
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if ('speechSynthesis' in window) {
      const speechLang = lang === 'kn' ? 'kn-IN' : 'en-US';
      const utterance = new SpeechSynthesisUtterance(advice);
      utterance.lang = speechLang;
      const voices = window.speechSynthesis.getVoices();
      let voice = speechLang === 'kn-IN' ? voices.find(v => v.lang.toLowerCase().startsWith('kn')) : null;
      if (!voice) voice = voices.find(v => v.lang.startsWith('en-US')) || voices[0];
      if (voice) utterance.voice = voice;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const value = {
    user, setUser, isLoading, setIsLoading, isDataLoading,
    activeCrop, setActiveCrop, customCrops, setCustomCrops, lang, setLang,
    soilMoisture, setSoilMoisture, soilNutrients, setSoilNutrients,
    temperature, setTemperature, weather, setWeather,
    humidity, setHumidity, windSpeed, setWindSpeed,
    locationName, setLocationName,
    advice, setAdvice, ruleAlerts,
    isSpeaking, setIsSpeaking,
    selectedImage, setSelectedImage, isAnalyzing, setIsAnalyzing,
    aiResult, setAiResult, isListening, setIsListening,
    isFetchingAI, setIsFetchingAI,
    adviceRef, aiRef, t,
    stopSpeaking, handleImageUpload, analyzeLeaf, fetchWeather,
    startVoiceAssistant, handleGoogleLogin, handleLogout,
    generateAdvice, handleSpeak, loadUserData
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
