import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const Diagnosis = () => {
  const {
    t, lang, handleImageUpload, selectedImage, analyzeLeaf,
    isAnalyzing, aiResult, aiRef
  } = useAppContext();

  // Smoothly scroll to AI Result
  useEffect(() => {
    if (aiResult && aiRef.current) {
      aiRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [aiResult, aiRef]);

  // Helper to parse the structured AI response
  const parseDiagnosisResult = (text) => {
    if (!text) return null;

    const patterns = {
      problem: /(?:🌿\s*Crop\s*&\s*Problem:\s*|ಬೆಳೆ\s*ಮತ್ತು\s*ಸಮಸ್ಯೆ:\s*)(.*)/i,
      danger: /(?:⚠️\s*Danger\s*Level:\s*|ಅಪಾಯದ\s*ಮಟ್ಟ:\s*)(.*)/i,
      today: /(?:🛠️\s*What\s*to\s*do\s*today:\s*|ಇಂದಿನ\s*ಕ್ರಮಗಳು:\s*)(.*)/i,
      treatment: /(?:💊\s*Treatment\s*Plan:\s*|ಚಿಕಿತ್ಸಾ\s*ಯೋಜನೆ:\s*)(.*)/i,
      prevention: /(?:🛡️\s*Prevention:\s*|ತಡೆಗಟ್ಟುವಿಕೆ:\s*)(.*)/i
    };

    const lines = text.split('\n');
    const result = {
      problem: '',
      danger: '',
      today: '',
      treatment: '',
      prevention: '',
      isParsed: false
    };

    let matchedCount = 0;
    for (const line of lines) {
      for (const [key, regex] of Object.entries(patterns)) {
        const match = line.match(regex);
        if (match && match[1]) {
          result[key] = match[1].trim();
          matchedCount++;
          break;
        }
      }
    }

    if (matchedCount >= 3) {
      result.isParsed = true;
      return result;
    }

    return null;
  };

  const parsedData = parseDiagnosisResult(aiResult);

  return (
    <div className="diagnosis-page">
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

      {/* AI Result Display */}
      {aiResult && (
        <div ref={aiRef} className="diagnosis-result-container" style={{ marginTop: '2rem' }}>
          {parsedData && parsedData.isParsed ? (
            <div className="parsed-diagnosis-results">
              <div className="glass-card result-main-card">
                <div className="result-main-header">
                  <span className="main-icon">🌿</span>
                  <div className="title-area">
                    <span className="title-label">{lang === 'kn' ? 'ಬೆಳೆ ಮತ್ತು ಸಮಸ್ಯೆ' : 'Crop & Problem'}</span>
                    <h3 className="title-value">{parsedData.problem}</h3>
                  </div>
                  <div className={`danger-badge ${
                    parsedData.danger.toLowerCase().includes('high') || parsedData.danger.includes('ಗಂಭೀರ') || parsedData.danger.includes('ಹೆಚ್ಚು')
                      ? 'high' 
                      : parsedData.danger.toLowerCase().includes('medium') || parsedData.danger.includes('ಮಧ್ಯಮ')
                      ? 'medium' 
                      : 'low'
                  }`}>
                    ⚠️ {parsedData.danger}
                  </div>
                </div>
              </div>

              <div className="diagnosis-details-grid">
                <div className="glass-card details-card today-card">
                  <div className="details-card-header">
                    <span className="card-icon">🛠️</span>
                    <h4>{lang === 'kn' ? 'ಇಂದಿನ ತಕ್ಷಣದ ಕ್ರಮಗಳು' : 'What to do today'}</h4>
                  </div>
                  <p className="details-card-content">{parsedData.today}</p>
                </div>

                <div className="glass-card details-card treatment-card">
                  <div className="details-card-header">
                    <span className="card-icon">💊</span>
                    <h4>{lang === 'kn' ? 'ಚಿಕಿತ್ಸಾ ಯೋಜನೆ' : 'Treatment Plan'}</h4>
                  </div>
                  <p className="details-card-content">{parsedData.treatment}</p>
                </div>

                <div className="glass-card details-card prevention-card">
                  <div className="details-card-header">
                    <span className="card-icon">🛡️</span>
                    <h4>{lang === 'kn' ? 'ತಡೆಗಟ್ಟುವಿಕೆ ಕ್ರಮ' : 'Prevention'}</h4>
                  </div>
                  <p className="details-card-content">{parsedData.prevention}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card advice-panel ai-result-panel">
              <div className="advice-header">
                <span>🤖</span>
                <span>{t["ai-header"]}</span>
              </div>
              <p className="advice-content" style={{ whiteSpace: 'pre-wrap' }}>{aiResult}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Diagnosis;
