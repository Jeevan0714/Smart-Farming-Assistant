import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const Assistant = () => {
  const {
    t, isListening, startVoiceAssistant, aiResult, aiRef
  } = useAppContext();

  // Smoothly scroll to AI Result
  useEffect(() => {
    if (aiResult && aiRef.current) {
      aiRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [aiResult, aiRef]);

  return (
    <div className="assistant-page">
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

      {/* AI Result Display */}
      {aiResult && (
        <div ref={aiRef} className="glass-card advice-panel ai-result-panel" style={{ marginTop: '2rem' }}>
          <div className="advice-header">
            <span>🤖</span>
            <span>{t["ai-header"]}</span>
          </div>
          <p className="advice-content">{aiResult}</p>
        </div>
      )}
    </div>
  );
};

export default Assistant;
