import { useEffect } from 'react';
import { RefreshCw, AlertTriangle, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const Dashboard = () => {
  const {
    t, lang, activeCrop, temperature, setTemperature,
    humidity, windSpeed, locationName, fetchWeather,
    soilMoisture, setSoilMoisture, soilNutrients, setSoilNutrients,
    weather, setWeather, ruleAlerts, generateAdvice,
    isFetchingAI, advice, adviceRef, isSpeaking, handleSpeak
  } = useAppContext();

  // Smoothly scroll to the advice panel whenever advice is generated
  useEffect(() => {
    if (advice && adviceRef.current) {
      adviceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [advice, adviceRef]);

  return (
    <div className="dashboard-page">
      {/* Live Data Dashboard */}
      <section className="glass-card live-dashboard" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            📡 {t["section-dashboard"]}
            {activeCrop && (
              <span className="active-status-pill">
                {activeCrop.emoji} {lang === 'kn' ? activeCrop.name_kn : activeCrop.name_en}
              </span>
            )}
          </h2>
          <button 
            className="btn-secondary" 
            onClick={() => activeCrop?.location?.lat 
              ? fetchWeather(false, activeCrop.location.lat, activeCrop.location.lon) 
              : fetchWeather()
            }
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
          >
            <RefreshCw size={16} /> {lang === 'kn' ? 'ಡೇಟಾ ನವೀಕರಿಸಿ' : 'Refresh Data'}
          </button>
        </div>

        <div className="dashboard-grid">
          <div className="dash-item">
            <span className="dash-emoji">📍</span>
            <span className="dash-label">{t["label-location"]}</span>
            <span className="dash-value">{locationName || '---'}</span>
          </div>
          <div className="dash-item">
            <span className="dash-emoji">🌡️</span>
            <span className="dash-label">{t["label-temperature"]}</span>
            <span className="dash-value">{temperature}°C</span>
          </div>
          <div className="dash-item">
            <span className="dash-emoji">💧</span>
            <span className="dash-label">{t["label-humidity"]}</span>
            <span className="dash-value">{humidity !== null ? `${humidity}%` : '---'}</span>
          </div>
          <div className="dash-item">
            <span className="dash-emoji">💨</span>
            <span className="dash-label">{t["label-wind"]}</span>
            <span className="dash-value">{windSpeed !== null ? `${windSpeed} km/h` : '---'}</span>
          </div>
        </div>
      </section>

      {/* Section 2: Sensor Telemetry */}
      <section style={{ margin: '2rem 0' }}>
        <h2 className="section-title">📊 {t["section-telemetry"]}</h2>
        <div className="telemetry-grid">
          <div className="glass-card slider-card">
            <div className="slider-header">
              <span className="form-label">{t["label-moisture"]}</span>
              <span className="slider-value">{soilMoisture}%</span>
            </div>
            <input 
              type="range" min="0" max="100" className="slider-input"
              value={soilMoisture} onChange={(e) => setSoilMoisture(e.target.value)}
            />
          </div>

          <div className="glass-card slider-card">
            <div className="slider-header">
              <span className="form-label">{t["label-nutrients"]}</span>
              <span className="slider-value">{soilNutrients} NPK</span>
            </div>
            <input 
              type="range" min="0" max="100" className="slider-input"
              value={soilNutrients} onChange={(e) => setSoilNutrients(e.target.value)}
            />
          </div>

          <div className="glass-card slider-card">
            <div className="slider-header">
              <span className="form-label">{t["label-temperature"]}</span>
              <span className="slider-value">{temperature}°C</span>
            </div>
            <input 
              type="range" min="-10" max="60" className="slider-input"
              value={temperature} onChange={(e) => setTemperature(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Section 3: Manual Weather Override */}
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

      {/* Real-time Rule Alerts */}
      {ruleAlerts.length > 0 && (
        <section className="rule-alerts-container" style={{ marginBottom: '2rem' }}>
          <div className="alerts-grid">
            {ruleAlerts.map((alert, idx) => (
              <div key={idx} className={`alert-card ${alert.severity}`}>
                {alert.severity === 'critical' ? <AlertTriangle size={18} /> : (alert.severity === 'warning' ? <ClipboardCheck size={18} /> : <ShieldCheck size={18} />)}
                <span>{alert.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="control-actions">
        <button 
          className="btn-primary"
          onClick={generateAdvice}
          disabled={!activeCrop || isFetchingAI}
        >
          {isFetchingAI ? <div className="spinner mini"></div> : '🔍'} {t["btn-get-advice"]}
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
    </div>
  );
};

export default Dashboard;
