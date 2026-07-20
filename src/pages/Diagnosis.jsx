import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const Diagnosis = () => {
  const {
    t, lang, handleImageUpload, selectedImage, analyzeLeaf,
    isAnalyzing, diagnosisResult, aiRef
  } = useAppContext();

  // Smoothly scroll to AI Result
  useEffect(() => {
    if (diagnosisResult && aiRef.current) {
      aiRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [diagnosisResult, aiRef]);

  // Helper to parse structured AI response (supports JSON & freeform text)
  const parseDiagnosisResult = (text) => {
    if (!text) return null;

    const formatOutput = (prob, dang, tod, treat, prev) => {
      let dangerVal = (dang || 'Medium').trim();
      if (dangerVal.toLowerCase().includes('high') || dangerVal.toLowerCase().includes('ಉನ್ನತ')) dangerVal = 'High';
      else if (dangerVal.toLowerCase().includes('low') || dangerVal.toLowerCase().includes('ಕಡಿಮೆ')) dangerVal = 'Low';
      else dangerVal = 'Medium';

      return {
        problem: prob || 'Crop Leaf Analysis',
        danger: dangerVal,
        today: tod || '',
        treatment: treat || '',
        prevention: prev || '',
        isParsed: true
      };
    };

    // 1. Try JSON Parsing first
    try {
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const jsonStr = text.substring(startIdx, endIdx + 1);
        const obj = JSON.parse(jsonStr);
        if (obj.problem || obj.today || obj.treatment || obj.prevention) {
          return formatOutput(obj.problem, obj.danger, obj.today, obj.treatment, obj.prevention);
        }
      }
    } catch (e) {
      console.warn("JSON diagnosis parse fallback:", e);
    }

    // 2. Key-Value Extractor for Pseudo-JSON / Backtick pairs (`key`: "value")
    const normalized = text.replace(/`([^`]+)`\s*:\s*"([^"]+)"/g, '"$1": "$2"');
    const extractKey = (keyName) => {
      const regex = new RegExp(`"${keyName}"\\s*:\\s*"([^"]+)"`, 'i');
      const match = normalized.match(regex);
      return match ? match[1].trim() : '';
    };

    const probKey = extractKey('problem');
    const dangKey = extractKey('danger');
    const todKey = extractKey('today');
    const treatKey = extractKey('treatment');
    const prevKey = extractKey('prevention');

    if (probKey || todKey || treatKey || prevKey) {
      return formatOutput(probKey, dangKey, todKey, treatKey, prevKey);
    }

    // 3. Ultra-flexible Regex Parsing for freeform text (stripping markdown asterisks)
    const cleanText = text.replace(/[*#]/g, '').trim();

    const patterns = {
      crop: /(?:Crop|Plant|ಬೆಳೆ)\s*:\s*([^\n]+)/i,
      disease: /(?:Problem|Disease|Pest|ಸಮಸ್ಯೆ|ರೋಗ)\s*:\s*([^\n]+)/i,
      danger: /(?:Danger\s*(?:Level)?|ಅಪಾಯದ\s*ಮಟ್ಟ)\s*:\s*([^\n]+)/i,
      today: /(?:What\s*to\s*do\s*today|Immediate\s*Action|ಇಂದಿನ\s*ಕ್ರಮಗಳು|ಇವತ್ತಿನ\s*ತಕ್ಷಣದ\s*ಕ್ರಮಗಳು)\s*:\s*([\s\S]*?)(?=(?:Treatment|Prevention|ಚಿಕಿತ್ಸೆ|ತಡೆಗಟ್ಟುವಿಕೆ)|$)/i,
      treatment: /(?:Treatment\s*(?:Plan)?|ಚಿಕಿತ್ಸಾ\s*ಯೋಜನೆ|ಚಿಕಿತ್ಸೆ)\s*:\s*([\s\S]*?)(?=(?:Prevention|ತಡೆಗಟ್ಟುವಿಕೆ)|$)/i,
      prevention: /(?:Prevention|ತಡೆಗಟ್ಟುವಿಕೆ|ಮುನ್ನೆಚ್ಚರಿಕೆ)\s*:\s*([\s\S]*?)$/i
    };

    const cropMatch = cleanText.match(patterns.crop);
    const diseaseMatch = cleanText.match(patterns.disease);
    const dangerMatch = cleanText.match(patterns.danger);
    const todayMatch = cleanText.match(patterns.today);
    const treatmentMatch = cleanText.match(patterns.treatment);
    const preventionMatch = cleanText.match(patterns.prevention);

    let problemStr = '';
    if (cropMatch && diseaseMatch) {
      problemStr = `${cropMatch[1].trim()} - ${diseaseMatch[1].trim()}`;
    } else if (diseaseMatch) {
      problemStr = diseaseMatch[1].trim();
    } else if (cropMatch) {
      problemStr = cropMatch[1].trim();
    }

    const res = formatOutput(
      problemStr,
      dangerMatch ? dangerMatch[1].trim() : 'Medium',
      todayMatch ? todayMatch[1].trim() : '',
      treatmentMatch ? treatmentMatch[1].trim() : '',
      preventionMatch ? preventionMatch[1].trim() : ''
    );

    if (res.today || res.treatment || res.prevention) {
      return res;
    }

    return null;
  };

  const parsedData = parseDiagnosisResult(diagnosisResult);

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
      {diagnosisResult && (
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
                  <p className="details-card-content" style={{ whiteSpace: 'pre-wrap' }}>{parsedData.today}</p>
                </div>

                <div className="glass-card details-card treatment-card">
                  <div className="details-card-header">
                    <span className="card-icon">💊</span>
                    <h4>{lang === 'kn' ? 'ಚಿಕಿತ್ಸಾ ಯೋಜನೆ' : 'Treatment Plan'}</h4>
                  </div>
                  <p className="details-card-content" style={{ whiteSpace: 'pre-wrap' }}>{parsedData.treatment}</p>
                </div>

                <div className="glass-card details-card prevention-card">
                  <div className="details-card-header">
                    <span className="card-icon">🛡️</span>
                    <h4>{lang === 'kn' ? 'ತಡೆಗಟ್ಟುವಿಕೆ ಕ್ರಮ' : 'Prevention'}</h4>
                  </div>
                  <p className="details-card-content" style={{ whiteSpace: 'pre-wrap' }}>{parsedData.prevention}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card advice-panel ai-result-panel">
              <div className="advice-header">
                <span>🤖</span>
                <span>{t["ai-header"]}</span>
              </div>
              <p className="advice-content" style={{ whiteSpace: 'pre-wrap' }}>{diagnosisResult}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Diagnosis;
