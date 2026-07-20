import { useEffect } from 'react';
import { RefreshCw, AlertTriangle, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { BUILT_IN_CROPS } from '../data/cropProfiles';

const Dashboard = () => {
  const {
    t, lang, activeCrop, temperature, setTemperature,
    humidity, windSpeed, locationName, fetchWeather,
    soilMoisture, setSoilMoisture, soilNutrients, setSoilNutrients,
    weather, setWeather, ruleAlerts, generateAdvice,
    isFetchingAI, advice, adviceRef, isSpeaking, handleSpeak,
    fields, activeFieldId, switchField, customCrops
  } = useAppContext();

  // Smoothly scroll to the advice panel whenever advice is generated
  useEffect(() => {
    if (advice && adviceRef.current) {
      adviceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [advice, adviceRef]);

  if (!fields || fields.length === 0) {
    return (
      <div className="dashboard-page empty-dashboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', textAlign: 'center' }}>
        <div className="empty-emoji" style={{ fontSize: '5rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 20px var(--primary-glow))' }}>🚜</div>
        <h2 className="empty-title" style={{ color: 'white', marginBottom: '1rem', fontSize: '2rem' }}>
          {lang === 'kn' ? 'ಯಾವುದೇ ಸಕ್ರಿಯ ಕ್ಷೇತ್ರಗಳಿಲ್ಲ' : 'No Active Fields'}
        </h2>
        <p className="empty-desc" style={{ color: 'var(--text-secondary)', maxWidth: '500px', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6' }}>
          {lang === 'kn' 
            ? 'ನಿಮ್ಮ ಮೊದಲ ಬೆಳೆಯನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಲು ಬೆಳೆಗಳ ಟ್ಯಾಬ್‌ಗೆ ಭೇಟಿ ನೀಡಿ ಮತ್ತು ಸ್ಥಳವನ್ನು ಆಯ್ಕೆಮಾಡಿ.' 
            : 'To get started, please go to the Crops tab, select a crop profile, and set up your planting location.'}
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn-primary" 
            style={{ padding: '0.8rem 2rem', fontSize: '1rem' }} 
            onClick={() => {
              alert(lang === 'kn' 
                ? 'ದಯವಿಟ್ಟು ಎಡಭಾಗದ ಮೆನುವಿನಿಂದ "Crops" ಟ್ಯಾಬ್ ಆಯ್ಕೆಮಾಡಿ.' 
                : 'Please select the "Crops" tab from the left sidebar to activate a crop profile.');
            }}
          >
            🌾 {lang === 'kn' ? 'ಬೆಳೆಗಳ ಪುಟಕ್ಕೆ ಹೋಗಿ' : 'Go to Crops Tab'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Live Data Dashboard */}
      <section className="glass-card live-dashboard" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            📡 {t["section-dashboard"]}
            {activeCrop && (
              <span className="active-status-pill">
                {activeCrop.emoji} {lang === 'kn' ? activeCrop.name_kn : activeCrop.name_en}
              </span>
            )}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {fields.length > 0 && (
              <select
                value={activeFieldId || ''}
                onChange={(e) => switchField(e.target.value)}
                className="field-selector-dropdown"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              >
                {fields.map(f => {
                  const crop = BUILT_IN_CROPS[f.cropId] || customCrops.find(c => c.id === f.cropId);
                  return (
                    <option key={f.id} value={f.id} style={{ background: '#0a1912', color: 'white' }}>
                      {crop?.emoji || '🌱'} {f.fieldName} ({lang === 'kn' ? (crop?.name_kn || f.cropId) : (crop?.name_en || f.cropId)})
                    </option>
                  );
                })}
              </select>
            )}
            <button 
              className="btn-secondary" 
              onClick={() => activeCrop?.location?.lat 
                ? fetchWeather(false, activeCrop.location.lat, activeCrop.location.lon, activeCrop.location.name) 
                : fetchWeather()
              }
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              <RefreshCw size={16} /> {lang === 'kn' ? 'ಡೇಟಾ ನವೀಕರಿಸಿ' : 'Refresh Data'}
            </button>
          </div>
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
