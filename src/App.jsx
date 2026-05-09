import { useState, useEffect, useRef } from 'react';

function App() {
  // State variables for form input
  const [lang, setLang] = useState('en');
  const [crop, setCrop] = useState('');
  const [soilMoisture, setSoilMoisture] = useState(50);
  const [soilNutrients, setSoilNutrients] = useState(50);
  const [temperature, setTemperature] = useState(25);
  const [weather, setWeather] = useState('');
  
  // Results & UI state
  const [advice, setAdvice] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechUtterance, setSpeechUtterance] = useState(null);
  
  // Ref for smooth scrolling
  const adviceRef = useRef(null);

  // Translations
  const translations = {
    kn: {
      "header-title": "ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಹಾಯಕ",
      "header-subtitle": "ಸೆನ್ಸರ್ ಡೇಟಾದ ಮೇಲೆ ಸರಳ, ಬೆಳೆ-ನಿರ್ದಿಷ್ಟ ಸಲಹೆಗಳು ಪಡೆಯಿರಿ",
      "section-crop": "ಬೆಳೆ ಆಯ್ಕೆಮಾಡಿ",
      "section-telemetry": "ಸೆನ್ಸರ್ ಡೇಟಾ (ರಿಯಲ್-ಟೈಮ್ ಟೆಲಿಮೆಟ್ರಿ)",
      "section-weather": "ಸ್ಥಳೀಯ ಹವಾಮಾನ ಸ್ಥಿತಿ",
      "label-moisture": "ಮಣ್ಣಿನ ತೇವಾಂಶ",
      "label-nutrients": "ಮಣ್ಣಿನ ಪೋಷಕಾಂಶ (NPK)",
      "label-temperature": "ತಾಪಮಾನ",
      "maize": "ಮೆಕ್ಕೆಜೋಳ",
      "rice": "ಭತ್ತ (ಅನ್ನ)",
      "beans": "ಬೀನ್ಸ್",
      "tomato": "ಟೊಮೇಟೋ",
      "weather-dry": "ಬಿಲ್ಲು (ಒಣ)",
      "weather-rainy": "ಮಳೆಯಾಗುತ್ತದೆ",
      "weather-cloudy": "ಮೇಘಾವೃತ",
      "weather-sunny": "ಬೆಳಗಿನ ಹೊತ್ತು (ಬಿಸಿಲು)",
      "btn-get-advice": "ಸಲಹೆ ಪಡೆಯಿರಿ",
      "btn-speak": "🔊 ಸಲಹೆಯನ್ನು ಕೇಳಿ",
      "btn-stop": "⏹️ ಧ್ವನಿ ನಿಲ್ಲಿಸಿ",
      "placeholder-advice": "ಇಲ್ಲಿ ನಿಮ್ಮ ಸಲಹೆ ಕಾಣಿಸುತ್ತದೆ...",
      "advice-header": "ನಿಮ್ಮ ಕೃಷಿ ಶಿಫಾರಸುಗಳು",
      "footer-text": "© 2026 ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಹಾಯಕ | ಇಲೆಕ್ಟ್ರಾನಿಕ್ಸ್ ಮತ್ತು ಕಮ್ಯುನಿಕೇಷನ್ ಎಂಜಿನಿಯರಿಂಗ್, DBIT"
    },
    en: {
      "header-title": "Smart Farming Assistant",
      "header-subtitle": "Get simple, crop-specific advice based on sensor data",
      "section-crop": "Select Your Crop",
      "section-telemetry": "Sensor Data (Real-time Telemetry)",
      "section-weather": "Local Weather Conditions",
      "label-moisture": "Soil Moisture",
      "label-nutrients": "Soil Nutrients (NPK)",
      "label-temperature": "Temperature",
      "maize": "Maize",
      "rice": "Rice",
      "beans": "Beans",
      "tomato": "Tomato",
      "weather-dry": "Dry",
      "weather-rainy": "Rainy",
      "weather-cloudy": "Cloudy",
      "weather-sunny": "Sunny",
      "btn-get-advice": "Analyze & Get Advice",
      "btn-speak": "🔊 Listen to Advice",
      "btn-stop": "⏹️ Stop Listening",
      "placeholder-advice": "Your agricultural recommendations will appear here...",
      "advice-header": "Your Custom Advisory",
      "footer-text": "© 2026 Smart Farming Assistant | Dept of Electronics & Communication, DBIT"
    }
  };

  const t = translations[lang];

  // Stop reading if language changes to keep UI consistent
  useEffect(() => {
    stopSpeaking();
  }, [lang]);

  // Check if form is valid to enable Advice button
  const isValid = crop !== '' && weather !== '';

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
      water_ok: 'ಮಣ್ಣಿನ ತೇವಾಂಶ ಸಮರ್ಪಕವಾಗಿದೆ. ಈಗ ನೀರು ಹಾಕುವ ಅಗತ್ಯವಿಲ್ಲ. ',
      nutrient_low: 'ಮಣ್ಣಿನ ಪೋಷಕಾಂಶ ಕಡಿಮೆ ಇದೆ. ಬೆಳೆ ಅಗತ್ಯಕ್ಕೆ ಅನುಗುಣವಾಗಿ ಉಪಪೋಷಣೆ ಮಾಡಿರಿ. ',
      nutrient_ok: 'ಮಣ್ಣಿನ ಪೋಷಕಾಂಶ ಸಮರ್ಪಕವಾಗಿದೆ. ಈಗ ಉಪಪೋಷಣೆಯ ಅಗತ್ಯವಿಲ್ಲ. ',
      temp_low: 'ತಾಪಮಾನ ಕಡಿಮೆ ಇದೆ. ಬೆಳೆದಿರುವ ಗಿಡಗಳನ್ನು ತಂಪಿನಿಂದ ರಕ್ಷಿಸಿ. ',
      temp_high: 'ತಾಪಮಾನ ಹೆಚ್ಚು ಇದೆ. ಹಾನಿ ತಪ್ಪಿಸಲು ನೆರಳು ಅಥವಾ ನೀರು ನೀಡಿರಿ. ',
      temp_ok: 'ತಾಪಮಾನ ಬೆಳವಣಿಗೆಯ ಅನುಕೂಲಕರ ಶ್ರೇಣಿಯಲ್ಲಿದೆ. ',
      weather_rainy: 'ಮಳೆ ನಿರೀಕ್ಷಿಸಲಾಗಿದೆ. ನೀರುಡಿಸುವಿಕೆಯನ್ನು ವಿಳಂಬಮಾಡಿ ಮತ್ತು ಮಳೆಯ ನಂತರ ಕೀಟಗಳ ಪರಿಶೀಲನೆ ಮಾಡಿ. ',
      weather_dry: 'ಬಿಲ್ಲು ಹವಾಮಾನ ನಿರೀಕ್ಷಿಸಲಾಗಿದೆ. ಮಣ್ಣಿನ ತೇವಾಂಶವನ್ನು ಹತ್ತಿರದಿಂದ ಪರಿಶೀಲಿಸಿ. ',
      crop_notes: {
        maize: 'ಮೆಕ್ಕೆಜೋಳ ಬೆಳವಣಿಗೆಯ ಹಂತಗಳಲ್ಲಿ ನಿಯಮಿತ ಪರಿಶೀಲನೆ ಅಗತ್ಯವಿದೆ.',
        rice: 'ಅನ್ನ ಬೆಳೆಗಳಿಗೆ ಜಾಗರೂಕ ನೀರಿನ ನಿರ್ವಹಣೆ ಅಗತ್ಯ. ',
        beans: 'ಬೀನ್ಸ್ ಸಮತೋಲನ ಪೋಷಣೆಯಿಂದ ಪ್ರಯೋಜನ ಪಡೆಯುತ್ತದೆ. ',
        tomato: 'ಟೊಮೇಟೋಗಳು ಹೆಚ್ಚಿನ ನೀರಿನಿಂದ ಸಂವೇದನಶೀಲವಾಗಿವೆ.'
      }
    };

    const adv = lang === 'kn' ? adv_kn : adv_en;
    let adviceResult = '';

    // Watering advice
    if (moisture < 30) {
      adviceResult += adv.water_low;
    } else if (moisture > 70) {
      adviceResult += adv.water_high;
    } else {
      adviceResult += adv.water_ok;
    }

    // Fertilization advice
    if (nutrients < 40) {
      adviceResult += adv.nutrient_low;
    } else {
      adviceResult += adv.nutrient_ok;
    }

    // Temperature advice
    if (temp < 15) {
      adviceResult += adv.temp_low;
    } else if (temp > 35) {
      adviceResult += adv.temp_high;
    } else {
      adviceResult += adv.temp_ok;
    }

    // Weather-based advice
    if (weather === 'rainy') {
      adviceResult += adv.weather_rainy;
    } else if (weather === 'dry') {
      adviceResult += adv.weather_dry;
    }

    // Crop-specific note
    if (adv.crop_notes[crop]) {
      adviceResult += adv.crop_notes[crop];
    }

    setAdvice(adviceResult);
  };

  // Clear advice and stop speaking when inputs change, requiring manual analyze trigger
  useEffect(() => {
    setAdvice('');
    stopSpeaking();
  }, [crop, weather, soilMoisture, soilNutrients, temperature, lang]);

  // Smoothly scroll to the advice panel whenever advice is generated
  useEffect(() => {
    if (advice && adviceRef.current) {
      adviceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [advice]);

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
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

      setSpeechUtterance(utterance);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } else {
      alert(lang === 'kn' ? 
        'ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ಬ್ರೌಸರ್ ಧ್ವನಿಸಿಂಥೆಸಿಸ್ ಅನ್ನು ಬೆಂಬಲಿಸುವುದಿಲ್ಲ.' : 
        'Sorry, your browser does not support speech synthesis.'
      );
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  return (
    <div className="glass-panel">
      {/* Language Switcher */}
      <div className="language-container">
        <div className="lang-btn-group">
          <button 
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => setLang('en')}
          >
            English
          </button>
          <button 
            className={`lang-btn ${lang === 'kn' ? 'active' : ''}`}
            onClick={() => setLang('kn')}
          >
            ಕನ್ನಡ
          </button>
        </div>
      </div>

      {/* Main Header */}
      <header>
        <h1>{t["header-title"]}</h1>
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
