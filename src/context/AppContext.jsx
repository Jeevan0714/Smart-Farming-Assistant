/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, db } from '../firebase';
import { doc, getDoc, collection, getDocs, setDoc, onSnapshot } from 'firebase/firestore';
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

  // Field & Crop State (Multi-field) with LocalStorage fallback
  const [fields, setFields] = useState(() => {
    try {
      const local = localStorage.getItem('sfa_fields');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });
  const [activeFieldId, setActiveFieldId] = useState(() => {
    return localStorage.getItem('sfa_activeFieldId') || null;
  });
  const [fieldTelemetry, setFieldTelemetry] = useState(() => {
    try {
      const local = localStorage.getItem('sfa_fieldTelemetry');
      return local ? JSON.parse(local) : {};
    } catch {
      return {};
    }
  });
  const [customCrops, setCustomCrops] = useState(() => {
    try {
      const local = localStorage.getItem('sfa_customCrops');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });
  const [lang, setLang] = useState(() => localStorage.getItem('sfa_lang') || 'en');
  const [farmLocation, setFarmLocation] = useState(null); // Global Farm Location: { name, lat, lon }

  const activeField = useMemo(() => {
    return fields.find(f => f.id === activeFieldId) || fields[0] || null;
  }, [fields, activeFieldId]);

  const activeCrop = useMemo(() => {
    if (!activeField) return null;
    const baseCrop = BUILT_IN_CROPS[activeField.cropId] || customCrops.find(c => c.id === activeField.cropId);
    if (!baseCrop) return null;
    return {
      ...baseCrop,
      plantingDate: activeField.plantingDate,
      location: activeField.location,
      fieldId: activeField.id,
      fieldName: activeField.fieldName
    };
  }, [activeField, customCrops]);

  // Backward-compatible mock setter
  const setActiveCrop = (val) => {
    if (val === null) {
      setActiveFieldId(null);
    }
  };

  const [soilMoisture, setSoilMoisture] = useState(50);
  const [soilNutrients, setSoilNutrients] = useState(50);
  const [temperature, setTemperature] = useState(25);
  const [weather, setWeather] = useState('sunny');
  
  // Dashboard Live Data State
  const [humidity, setHumidity] = useState(null);
  const [windSpeed, setWindSpeed] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [detectedCoords, setDetectedCoords] = useState(null); // { lat, lon }
  
  // Results & Speech State
  const [advice, setAdvice] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);

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
  const [diagnosisResult, setDiagnosisResult] = useState('');
  const [assistantResult, setAssistantResult] = useState('');
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isFetchingAI, setIsFetchingAI] = useState(false);
  
  // Refs
  const adviceRef = useRef(null);
  const aiRef = useRef(null);
  const recognitionRef = useRef(null);

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
      localStorage.setItem('sfa_customCrops', JSON.stringify(customList));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Load global farm location
        if (userData.farmLocation) {
          setFarmLocation(userData.farmLocation);
        }

        // Live migration: convert old single-crop config to new fields collection
        if (userData.activeCropId) {
          const cropId = userData.activeCropId;
          const fieldId = `field_migration_${Date.now()}`;
          const migrationField = {
            id: fieldId,
            fieldName: 'Primary Field',
            cropId: cropId,
            plantingDate: userData.activeFieldInfo?.plantingDate || new Date().toISOString(),
            location: userData.activeFieldInfo?.location || { name: 'Dharwad', lat: 15.45, lon: 75.01 },
            status: 'active'
          };
          
          // Save migration field to Firestore subcollection
          await setDoc(doc(db, 'users', currentUser.uid, 'fields', fieldId), migrationField);
          
          // Clean up root user doc fields and set activeFieldId
          await setDoc(userDocRef, {
            activeCropId: null,
            activeFieldInfo: null,
            activeFieldId: fieldId
          }, { merge: true });
          
          setActiveFieldId(fieldId);
          localStorage.setItem('sfa_activeFieldId', fieldId);
        } else if (userData.activeFieldId) {
          setActiveFieldId(userData.activeFieldId);
          localStorage.setItem('sfa_activeFieldId', userData.activeFieldId);
        }
      }
      console.log("Context: User data loaded successfully.");
    } catch (e) {
      console.error("Context: Error loading user data:", e);
      try {
        const localCustom = localStorage.getItem('sfa_customCrops');
        if (localCustom) setCustomCrops(JSON.parse(localCustom));
        const localActive = localStorage.getItem('sfa_activeFieldId');
        if (localActive) setActiveFieldId(localActive);
      } catch (err) {
        console.error("Failed to load local storage fallbacks:", err);
      }
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
      "voice-listening": "ಧ್ವನಿ ಆಲಿಸುತ್ತಿದೆ... ಮಾತನಾಡಿ",
      "voice-stop-hint": "ಮಾತನಾಡಿ ಮುಗಿಸಿದ ಮೇಲೆ ನಿಲ್ಲಿಸಿ",
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
      "btn-voice-stop": "🛑 Stop & Ask AI",
      "placeholder-advice": "Your agricultural recommendations will appear here...",
      "advice-header": "Your Custom Advisory",
      "ai-header": "AI Diagnosis Result",
      "ai-processing": "AI is analyzing the leaf, please wait...",
      "voice-listening": "Listening... Speak now",
      "voice-stop-hint": "Click stop when you finish speaking",
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

  const detectLocation = async (silent = false) => {
    return new Promise((resolve) => {
      const fetchLocationByIP = async () => {
        try {
          const res = await fetch('https://ipapi.co/json/');
          const data = await res.json();
          if (data.latitude && data.longitude) {
            console.log("Location fetched via IP:", data.city);
            const locationData = {
              lat: data.latitude,
              lon: data.longitude,
              name: `${data.city}, ${data.region}`
            };
            setDetectedCoords({ lat: locationData.lat, lon: locationData.lon });
            resolve(locationData);
          } else {
            throw new Error("IP location data incomplete");
          }
        } catch (err) {
          console.error("IP Location fallback failed", err);
          if (!silent) alert(lang === 'kn' ? 'ಸ್ಥಳ ಕಂಡುಹಿಡಿಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.' : 'Could not detect location.');
          resolve(null);
        }
      };

      if (!navigator.geolocation) {
        fetchLocationByIP();
        return;
      }

      const geoOptions = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            name: null // Will be reverse-geocoded in fetchWeather or used as-is
          };
          setDetectedCoords({ lat: locationData.lat, lon: locationData.lon });
          resolve(locationData);
        },
        (err) => {
          console.warn(`Geolocation Error (${err.code}): ${err.message}`);
          fetchLocationByIP();
        },
        geoOptions
      );
    });
  };

  const fetchWeather = async (silent = false, manualLat = null, manualLon = null, manualName = null) => {
    const fetchWithCoords = async (lat, lon, name = null) => {
      try {
        setDetectedCoords({ lat, lon });
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();
        
        if (!name) {
          try {
            const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`;
            const geoRes = await fetch(geoUrl, { 
              headers: { 
                'User-Agent': 'SmartFarmingAssistant/1.0 (contact: smartfarmingdbit@gmail.com)',
                'Accept-Language': lang 
              } 
            });
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
      await fetchWithCoords(manualLat, manualLon, manualName);
      return;
    }

    const location = await detectLocation(silent);
    if (location) {
      await fetchWithCoords(location.lat, location.lon, location.name);
    }
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
        setActiveFieldId(null);
        setFields([]);
        setCustomCrops([]);
        setFarmLocation(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time fields subscription
  useEffect(() => {
    if (!user) {
      setFields([]);
      return;
    }

    const fieldsRef = collection(db, 'users', user.uid, 'fields');
    const unsubscribe = onSnapshot(fieldsRef, (snapshot) => {
      const fieldsList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setFields(fieldsList);
      localStorage.setItem('sfa_fields', JSON.stringify(fieldsList));
    }, (err) => {
      console.error("Error listening to fields:", err);
      const local = localStorage.getItem('sfa_fields');
      if (local) setFields(JSON.parse(local));
    });

    return () => unsubscribe();
  }, [user]);

  // Helper to preserve telemetry state between fields in client memory and localStorage
  const prevFieldIdRef = useRef(null);
  useEffect(() => {
    const currentFieldId = activeFieldId;
    const prevFieldId = prevFieldIdRef.current;

    // Save previous field telemetry
    if (prevFieldId) {
      setFieldTelemetry(prev => {
        const next = {
          ...prev,
          [prevFieldId]: { soilMoisture, soilNutrients, temperature, weather }
        };
        localStorage.setItem('sfa_fieldTelemetry', JSON.stringify(next));
        return next;
      });
    }

    // Load current field telemetry if it exists
    if (currentFieldId && fieldTelemetry[currentFieldId]) {
      const saved = fieldTelemetry[currentFieldId];
      setSoilMoisture(saved.soilMoisture);
      setSoilNutrients(saved.soilNutrients);
      setTemperature(saved.temperature);
      setWeather(saved.weather);
    } else {
      // Defaults
      setSoilMoisture(50);
      setSoilNutrients(50);
      setTemperature(25);
      setWeather('sunny');
    }

    prevFieldIdRef.current = currentFieldId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFieldId]);

  useEffect(() => {
    if (user) {
      if (activeCrop?.location?.lat) {
        fetchWeather(true, activeCrop.location.lat, activeCrop.location.lon, activeCrop.location.name);
      } else if (farmLocation?.lat) {
        fetchWeather(true, farmLocation.lat, farmLocation.lon);
      } else {
        fetchWeather(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeFieldId, activeCrop?.location?.lat, activeCrop?.location?.lon, farmLocation?.lat, farmLocation?.lon]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
    }
  }, []);

  useEffect(() => {
    stopSpeaking();
    localStorage.setItem('sfa_lang', lang);
  }, [lang]);

  useEffect(() => {
    setAdvice('');
    stopSpeaking();
  }, [weather, soilMoisture, soilNutrients, temperature, activeCrop]);

  const compressImage = (base64Str, maxWidth = 1024, maxHeight = 1024) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result);
        setSelectedImage(compressed);
        setAiResult('');
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeLeaf = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setDiagnosisResult('');
    
    const prompt = `You are a senior agricultural plant pathologist at ICAR. Analyze the uploaded leaf image for crop type, disease/pest, danger level, immediate actions, treatment plan, and prevention.

CRITICAL RULES:
1. Provide your response strictly in ${lang === 'kn' ? 'Kannada' : 'English'}.
2. Do NOT output any self-correction, reasoning, thought process, or meta-comments.
3. Return ONLY a valid raw JSON object starting with { and ending with } with this exact structure:

{
  "problem": "Crop Name - Disease/Pest Name (e.g. Citrus - Black Spot)",
  "danger": "Low" | "Medium" | "High",
  "today": "1 or 2 immediate actions to take today in the field",
  "treatment": "1 chemical spray & 1 organic remedy",
  "prevention": "1 simple preventive measure for future crops"
}`;

    const result = await callGeminiAPI(prompt, selectedImage);
    setDiagnosisResult(result);
    setAiResult(result);
    setIsAnalyzing(false);
  };

  const askAssistant = async (queryText) => {
    if (!queryText?.trim()) return;
    setIsAssistantLoading(true);
    setAssistantResult(lang === 'kn' ? `ನೀವು ಕೇಳಿದ್ದು: "${queryText}"\nAI ಪ್ರತಿಕ್ರಿಯೆಗಾಗಿ ಕಾಯಿರಿ...` : `Query: "${queryText}"\nWaiting for AI response...`);
    
    const cropContext = activeCrop ? `[Active Crop: ${activeCrop.name_en} (${activeCrop.variety || 'Standard'}), Growth Stage: Stage ${activeCrop.stage || 1}] ` : '';
    const prompt = `You are a friendly, expert agricultural scientist and smart farming assistant. ${cropContext}Answer this farmer's question with practical, structured advice and bullet points in ${lang === 'kn' ? 'Kannada' : 'English'}:\nQuestion: "${queryText}"`;
    
    const result = await callGeminiAPI(prompt);
    setAssistantResult(result);
    setIsAssistantLoading(false);
    
    // Auto speak response if TTS supported
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(result.replace(/[*#]/g, ''));
      utterance.lang = lang === 'kn' ? 'kn-IN' : 'en-US';
      let voice = lang === 'kn' ? voices.find(v => v.lang.toLowerCase().startsWith('kn')) : null;
      if (!voice) voice = voices.find(v => v.lang.startsWith('en-US')) || voices[0];
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
    }
    return result;
  };

  const startVoiceAssistant = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const errorMsg = lang === 'kn' 
        ? "ನಿಮ್ಮ ಬ್ರೌಸರ್ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆಯನ್ನು ಬೆಂಬಲಿಸುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಗೂಗಲ್ ಕ್ರೋಮ್ ಬಳಸಿ." 
        : "Speech recognition is not supported in your browser. Please try Google Chrome.";
      setAssistantResult(errorMsg);
      alert(errorMsg);
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = lang === 'kn' ? 'kn-IN' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setAssistantResult('');
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsSpeaking(false);
    };

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error", event);
      setIsListening(false);
    };

    recognition.onend = () => {
      // Automatic stop handled
    };

    recognition.start();
  };

  const stopVoiceAssistant = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    setIsListening(false);
    
    if (!transcript.trim()) {
      setAssistantResult(lang === 'kn' ? "ಕ್ಷಮಿಸಿ, ನನಗೇನು ಕೇಳಿಸಲಿಲ್ಲ." : "Sorry, I didn't catch that.");
      return;
    }

    await askAssistant(transcript);
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
      let voice = speechLang === 'kn-IN' ? voices.find(v => v.lang.toLowerCase().startsWith('kn')) : null;
      if (!voice) voice = voices.find(v => v.lang.startsWith('en-US')) || voices[0];
      if (voice) utterance.voice = voice;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const switchField = async (fieldId) => {
    setActiveFieldId(fieldId);
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { activeFieldId: fieldId }, { merge: true });
      } catch (e) {
        console.error("Failed to save activeFieldId to Firestore:", e);
      }
    }
  };

  const value = {
    user, setUser, isLoading, setIsLoading, isDataLoading,
    activeCrop, setActiveCrop, customCrops, setCustomCrops, lang, setLang,
    soilMoisture, setSoilMoisture, soilNutrients, setSoilNutrients,
    temperature, setTemperature, weather, setWeather,
    humidity, setHumidity, windSpeed, setWindSpeed,
    locationName, setLocationName, detectedCoords,
    advice, setAdvice, ruleAlerts,
    isSpeaking, setIsSpeaking,
    selectedImage, setSelectedImage, isAnalyzing, setIsAnalyzing,
    aiResult, setAiResult, diagnosisResult, setDiagnosisResult,
    assistantResult, setAssistantResult, askAssistant, isAssistantLoading,
    isListening, setIsListening, transcript, setTranscript, stopVoiceAssistant,
    isFetchingAI, setIsFetchingAI,
    adviceRef, aiRef, t,
    stopSpeaking, handleImageUpload, analyzeLeaf, fetchWeather,
    startVoiceAssistant, handleGoogleLogin, handleLogout,
    generateAdvice, handleSpeak, loadUserData,
    farmLocation, setFarmLocation, detectLocation,
    fields, setFields, activeFieldId, setActiveFieldId, activeField, switchField
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
