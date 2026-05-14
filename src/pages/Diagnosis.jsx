import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const Diagnosis = () => {
  const {
    t, handleImageUpload, selectedImage, analyzeLeaf,
    isAnalyzing, aiResult, aiRef
  } = useAppContext();

  // Smoothly scroll to AI Result
  useEffect(() => {
    if (aiResult && aiRef.current) {
      aiRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [aiResult, aiRef]);

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

export default Diagnosis;
