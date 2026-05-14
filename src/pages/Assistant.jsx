import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const Assistant = () => {
  const {
    t, isListening, startVoiceAssistant, stopVoiceAssistant,
    transcript, aiResult, aiRef
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
        
        <div className="voice-controls-wrapper">
          <button 
            className={`btn-voice ${isListening ? 'listening' : ''}`}
            onClick={isListening ? stopVoiceAssistant : startVoiceAssistant}
          >
            {isListening ? (
              <>
                <div className="pulse-ring"></div>
                <div className="stop-icon"></div>
                <span>{t["btn-voice-stop"]}</span>
              </>
            ) : (
              <span>{t["btn-voice-start"]}</span>
            )}
          </button>
          
          {isListening && (
            <div className="listening-feedback">
              <p className="voice-hint">{t["voice-listening"]}</p>
              <div className="live-transcript">
                {transcript || "..."}
              </div>
              <p className="voice-hint-small">{t["voice-stop-hint"]}</p>
            </div>
          )}
        </div>
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
