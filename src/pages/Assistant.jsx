import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Mic, Send, Volume2, VolumeX, Sparkles, Loader2, Copy, Check, MessageSquare } from 'lucide-react';

const Assistant = () => {
  const {
    t, lang, isListening, startVoiceAssistant, stopVoiceAssistant,
    transcript, assistantResult, isAssistantLoading, askAssistant,
    isSpeaking, stopSpeaking
  } = useAppContext();

  const [inputQuery, setInputQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const resultRef = useRef(null);

  // Smoothly scroll to AI Result when available
  useEffect(() => {
    if (assistantResult && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [assistantResult]);

  const handleSendText = () => {
    if (!inputQuery.trim() || isAssistantLoading) return;
    askAssistant(inputQuery);
    setInputQuery('');
  };

  const handleCopy = () => {
    if (!assistantResult) return;
    navigator.clipboard.writeText(assistantResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const suggestionPrompts = lang === 'kn' ? [
    { label: "🐛 ಕೀಟ ನಿಯಂತ್ರಣ ಸಲಹೆ", query: "ನನ್ನ ಬೆಳೆಗೆ ಸೂಕ್ತವಾದ ಕೀಟ ಮತ್ತು ರೋಗ ನಿಯಂತ್ರಣ ಉಪಾಯಗಳನ್ನು ತಿಳಿಸಿ." },
    { label: "💧 ನೀರಾವರಿ ವೇಳಾಪಟ್ಟಿ", query: "ನನ್ನ ಮಣ್ಣಿಗೆ ತಕ್ಕಂತೆ ಎಷ್ಟು ದಿನಕ್ಕೊಮ್ಮೆ ನೀರು ಹಾಯಿಸಬೇಕು?" },
    { label: "🧪 ಗೊಬ್ಬರದ ಡೋಸೇಜ್", query: "ಬೆಳವಣಿಗೆಯ ಹಂತದಲ್ಲಿ ಎನ್‌ಪಿಕೆ (NPK) ಗೊಬ್ಬರ ಹಾಕುವುದು ಹೇಗೆ?" },
    { label: "🌦️ ಹವಾಮಾನ ಮುನ್ನೆಚ್ಚರಿಕೆ", query: "ಇಂದಿನ ಹವಾಮಾನಕ್ಕೆ ತಕ್ಕಂತೆ ಬೆಳೆಗೆ ಏನು ಜಾಗ್ರತೆ ವಹಿಸಬೇಕು?" }
  ] : [
    { label: "🐛 Pest & Disease Advice", query: "What are the best organic and chemical treatments for crop pests?" },
    { label: "💧 Irrigation Schedule", query: "How often should I irrigate based on my soil type and growth stage?" },
    { label: "🧪 NPK Fertilizer Plan", query: "What is the recommended NPK fertilizer dosage for my crop stage?" },
    { label: "🌦️ Weather Precautions", query: "What farming precautions should I take for current local weather?" }
  ];

  return (
    <div className="assistant-page" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Hero Section */}
      <section className="glass-card voice-section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles className="text-primary animate-pulse" size={26} />
            {lang === 'kn' ? 'ಸ್ಮಾರ್ಟ್ ಕೃಷಿ AI ಸಹಾಯಕ' : 'Voice & Chat AI Farming Assistant'}
          </h2>
          <p className="form-label" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            {lang === 'kn' ? 'ಧ್ವನಿ ಮೂಲಕ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ ನಿಮ್ಮ ಕೃಷಿ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ' : 'Ask any agricultural query via voice mic or text chat!'}
          </p>
        </div>

        {/* Voice Control Button & Waveform Animation */}
        <div className="voice-controls-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '1.5rem 0' }}>
          <button 
            className={`btn-voice ${isListening ? 'listening' : ''}`}
            onClick={isListening ? stopVoiceAssistant : startVoiceAssistant}
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: isListening ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              boxShadow: isListening ? '0 0 30px rgba(239, 68, 68, 0.6)' : '0 0 25px rgba(16, 185, 129, 0.4)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justify: 'center',
              color: 'white',
              transition: 'all 0.3s ease',
              position: 'relative'
            }}
          >
            <Mic size={36} />
            <span style={{ fontSize: '0.75rem', fontWeight: '700', marginTop: '4px', textTransform: 'uppercase' }}>
              {isListening ? (lang === 'kn' ? 'ನಿಲ್ಲಿಸಿ' : 'Stop') : (lang === 'kn' ? 'ಮಾತನಾಡಿ' : 'Speak')}
            </span>
          </button>
          
          {isListening && (
            <div className="listening-feedback" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <div className="audio-wave-bars">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
              <p className="voice-hint" style={{ color: '#a7f3d0', fontWeight: '600' }}>{t["voice-listening"]}</p>
              <div className="live-transcript" style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1.25rem', borderRadius: '12px', marginTop: '8px', color: '#fff', fontSize: '1rem', fontStyle: 'italic' }}>
                {transcript || "Listening to your voice..."}
              </div>
            </div>
          )}
        </div>

        {/* Text Input Box */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
          <input 
            type="text" 
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            placeholder={lang === 'kn' ? "ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ (ಉದಾ: ಹತ್ತಿ ಬೆಳೆಗೆ ರಸಗೊಬ್ಬರ)..." : "Or type a farming question (e.g. Best fertilizer for Paddy)..."}
            style={{
              flex: 1,
              padding: '0.85rem 1.2rem',
              borderRadius: '12px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              fontSize: '0.95rem',
              outline: 'none'
            }}
          />
          <button 
            className="btn-primary"
            onClick={handleSendText}
            disabled={isAssistantLoading || !inputQuery.trim()}
            style={{ padding: '0 1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isAssistantLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {lang === 'kn' ? 'ಕಳುಹಿಸಿ' : 'Ask'}
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', fontWeight: '600' }}>
            💡 {lang === 'kn' ? 'ತ್ವರಿತ ಸಲಹೆ ಪ್ರಾಂಪ್ಟ್‌ಗಳು' : 'Quick Suggested Prompts'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {suggestionPrompts.map((item, idx) => (
              <button
                key={idx}
                onClick={() => askAssistant(item.query)}
                className="chip-button"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '20px',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* AI Response Card */}
      {(assistantResult || isAssistantLoading) && (
        <div ref={resultRef} className="glass-card advice-panel ai-result-panel" style={{ marginTop: '2rem', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={22} className="text-primary" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>
                {lang === 'kn' ? 'AI ಕೃಷಿ ಸಲಹೆಗಾರರ ಉತ್ತರ' : 'AI Assistant Response'}
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {isSpeaking ? (
                <button className="btn-secondary" onClick={stopSpeaking} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#f87171' }}>
                  <VolumeX size={16} /> {lang === 'kn' ? 'ನಿಲ್ಲಿಸಿ' : 'Mute'}
                </button>
              ) : (
                <button className="btn-secondary" onClick={() => askAssistant(assistantResult)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                  <Volume2 size={16} /> {lang === 'kn' ? 'ಓದಿ' : 'Listen'}
                </button>
              )}

              <button className="btn-secondary" onClick={handleCopy} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
                {copied ? (lang === 'kn' ? 'ಕಾಪಿ ಮಾಡಲಾಗಿದೆ' : 'Copied') : (lang === 'kn' ? 'ಕಾಪಿ' : 'Copy')}
              </button>
            </div>
          </div>

          {isAssistantLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem', color: 'var(--text-secondary)' }}>
              <Loader2 className="animate-spin text-primary" size={24} />
              <span>{lang === 'kn' ? 'ಉತ್ತರವನ್ನು ತಯಾರಿಸಲಾಗುತ್ತಿದೆ...' : 'Analyzing query & generating scientific response...'}</span>
            </div>
          ) : (
            <div style={{ fontSize: '1rem', lineHeight: '1.7', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
              {assistantResult}
            </div>
          )}
        </div>
      )}

      <style>{`
        .chip-button:hover {
          background: rgba(16, 185, 129, 0.15) !important;
          border-color: var(--primary) !important;
          transform: translateY(-2px);
        }
        .audio-wave-bars {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          height: 24px;
          margin-bottom: 8px;
        }
        .audio-wave-bars span {
          width: 4px;
          height: 100%;
          background: var(--primary);
          border-radius: 2px;
          animation: wavePulse 1s infinite ease-in-out;
        }
        .audio-wave-bars span:nth-child(2) { animation-delay: 0.2s; }
        .audio-wave-bars span:nth-child(3) { animation-delay: 0.4s; }
        .audio-wave-bars span:nth-child(4) { animation-delay: 0.6s; }
        .audio-wave-bars span:nth-child(5) { animation-delay: 0.8s; }

        @keyframes wavePulse {
          0%, 100% { height: 6px; opacity: 0.4; }
          50% { height: 24px; opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Assistant;
