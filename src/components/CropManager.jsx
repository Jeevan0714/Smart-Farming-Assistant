import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { BUILT_IN_CROPS } from '../data/cropProfiles';
import { Plus, Trash2, Check, MapPin, Navigation, Edit2, X, Search, Loader2, Sparkles, Sprout, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { generateCropProfile } from '../engine/geminiAdvisor';
import { getCurrentStage } from '../engine/adviceEngine';

const CropManager = () => {
  const { 
    user, lang, setActiveCrop, activeCrop, 
    customCrops, setCustomCrops, isDataLoading, loadUserData 
  } = useAppContext();
  
  const [showCreator, setShowCreator] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Form State for Custom Crop
  const initialCropState = {
    name_en: '',
    name_kn: '',
    emoji: '🌱',
    lifecycle: [
      { stage: 'Seedling', days: 20, thresholds: { soilMoisture: { low: 40, optimal_min: 55, optimal_max: 70, high: 85 }, nutrients: { low: 30, optimal_min: 50 } } },
      { stage: 'Vegetative', days: 40, thresholds: { soilMoisture: { low: 50, optimal_min: 65, optimal_max: 80, high: 90 }, nutrients: { low: 45, optimal_min: 65 } } },
      { stage: 'Flowering/Fruiting', days: 30, thresholds: { soilMoisture: { low: 55, optimal_min: 70, optimal_max: 85, high: 95 }, nutrients: { low: 50, optimal_min: 75 } } }
    ],
    thresholds: {
      soilMoisture: { low: 30, optimal_min: 50, optimal_max: 70, high: 85 },
      nutrients: { low: 30, optimal_min: 50, optimal_max: 70, high: 90 },
      temperature: { low: 10, optimal_min: 20, optimal_max: 30, high: 40 }
    }
  };

  const [newCrop, setNewCrop] = useState(initialCropState);

  // Location selection state
  const [locationMode, setLocationMode] = useState(null); // 'prompt', 'gps', 'manual'
  const [locationQuery, setLocationQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [pendingCrop, setPendingCrop] = useState(null);

  const handleAiAutoFill = async () => {
    if (!newCrop.name_en) {
      alert(lang === 'kn' ? "ದಯವಿಟ್ಟು ಮೊದಲು ಇಂಗ್ಲಿಷ್ ಹೆಸರನ್ನು ನಮೂದಿಸಿ." : "Please enter the English name first.");
      return;
    }
    setIsAiLoading(true);
    try {
      const profile = await generateCropProfile(newCrop.name_en, lang);
      if (profile) {
        // Safe deep merge to prevent UI crashes on partial AI data
        setNewCrop(prev => ({
          ...prev,
          ...profile,
          thresholds: {
            ...prev.thresholds,
            ...(profile.thresholds || {}),
            soilMoisture: { ...prev.thresholds.soilMoisture, ...(profile.thresholds?.soilMoisture || {}) },
            nutrients: { ...prev.thresholds.nutrients, ...(profile.thresholds?.nutrients || {}) },
            temperature: { ...prev.thresholds.temperature, ...(profile.thresholds?.temperature || {}) }
          }
        }));
      } else {
        alert(lang === 'kn' ? "AI ನಿಂದ ಪ್ರೊಫೈಲ್ ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ." : "Could not generate profile with AI.");
      }
    } catch (e) {
      console.error("AI Profiling failed:", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleHarvest = async () => {
    if (!window.confirm(lang === 'kn' ? 'ಈ ಬೆಳೆಯನ್ನು ಕೊಯ್ಲು ಮಾಡಿ ಕ್ಷೇತ್ರವನ್ನು ರಿಸೆಟ್ ಮಾಡುವುದೇ?' : 'Harvest this crop and reset the field?')) return;
    setIsProcessing(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { activeCropId: null, activeFieldInfo: null }, { merge: true });
      setActiveCrop(null);
    } catch (e) {
      console.error("Harvest failed:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentStageInfo = activeCrop ? getCurrentStage(activeCrop, activeCrop.plantingDate) : null;

  const handleSetActiveCrop = (cropId) => {
    const selectedCrop = BUILT_IN_CROPS[cropId] || customCrops.find(c => c.id === cropId);
    if (!selectedCrop) {
      alert(lang === 'kn' ? "ಬೆಳೆ ಕಂಡುಬಂದಿಲ್ಲ." : "Crop not found.");
      return;
    }
    setPendingCrop(selectedCrop);
    setLocationMode('prompt');
  };

  const confirmSetActiveCrop = async (locationData) => {
    if (!pendingCrop || !user) {
      alert(lang === 'kn' ? "ಬೆಳೆ ಅಥವಾ ಬಳಕೆದಾರ ಮಾಹಿತಿ ಇಲ್ಲ." : "Missing crop or user information.");
      return;
    }
    setIsProcessing(true);

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const activeFieldInfo = {
        plantingDate: new Date().toISOString(),
        location: {
          name: (locationData.name || 'Selected Location'),
          lat: Number(locationData.lat),
          lon: Number(locationData.lon)
        }
      };
      
      await setDoc(userDocRef, {
        activeCropId: pendingCrop.id,
        activeFieldInfo: activeFieldInfo
      }, { merge: true });

      setActiveCrop({ ...pendingCrop, ...activeFieldInfo });
      setPendingCrop(null);
      setLocationMode(null);
      setSearchResults([]);
      setLocationQuery('');
      
      alert(lang === 'kn' ? "ಬೆಳೆಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ!" : "Crop activated successfully!");
    } catch (e) {
      console.error("Error setting active crop:", e);
      alert(lang === 'kn' ? "ಬೆಳೆಯನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಲು ವಿಫಲವಾಗಿದೆ." : "Failed to activate crop.");
    } finally {
      setIsProcessing(false);
    }
  };

  const searchManualLocation = async () => {
    if (!locationQuery.trim() || isProcessing) return;
    setIsProcessing(true);
    setSearchResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.length === 0) {
        alert(lang === 'kn' ? "ಯಾವುದೇ ಸ್ಥಳ ಕಂಡುಬಂದಿಲ್ಲ." : "No locations found.");
      }
      setSearchResults(data);
    } catch (e) {
      console.error("Location search failed:", e);
      alert(lang === 'kn' ? "ಹುಡುಕಾಟ ವಿಫಲವಾಗಿದೆ." : "Search failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const requestGPSLocation = () => {
    if (!navigator.geolocation) {
      alert(lang === 'kn' ? "ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಜಿಯೋಲೋಕೇಶನ್ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ." : "Geolocation not supported.");
      return;
    }
    setIsProcessing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await confirmSetActiveCrop({ name: 'Current Location', lat: latitude, lon: longitude });
      },
      (err) => {
        setIsProcessing(false);
        console.warn("GPS failed", err);
        alert(lang === 'kn' ? "ಸ್ಥಳ ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಹಸ್ತಚಾಲಿತವಾಗಿ ಹುಡುಕಿ." : "Could not get location. Please search manually.");
        setLocationMode('manual');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const saveCustomCrop = async () => {
    if (!newCrop.name_en?.trim() || !newCrop.name_kn?.trim()) {
      alert(lang === 'kn' ? "ದಯವಿಟ್ಟು ಎಲ್ಲಾ ಹೆಸರುಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ." : "Please fill in all names.");
      return;
    }
    setIsProcessing(true);
    try {
      const cropId = `custom_${Date.now()}`;
      const docRef = doc(db, 'users', user.uid, 'customCrops', cropId);
      const cropToSave = { ...newCrop, id: cropId };
      await setDoc(docRef, cropToSave);
      setCustomCrops(prev => [...prev, cropToSave]);
      setShowCreator(false);
      setNewCrop(initialCropState);
      alert(lang === 'kn' ? "ಹೊಸ ಬೆಳೆ ಉಳಿಸಲಾಗಿದೆ!" : "Custom crop saved!");
    } catch (e) {
      console.error("Error saving custom crop:", e);
      alert(lang === 'kn' ? "ಉಳಿಸಲು ವಿಫಲವಾಗಿದೆ." : "Failed to save crop.");
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteCustomCrop = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm(lang === 'kn' ? 'ಈ ಬೆಳೆಯನ್ನು ಅಳಿಸುವುದೇ?' : 'Delete this crop?')) return;
    
    setIsProcessing(true);
    try {
      // If the crop being deleted is active, reset field first
      if (activeCrop && activeCrop.id === id) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { activeCropId: null, activeFieldInfo: null }, { merge: true });
        setActiveCrop(null);
      }
      
      await deleteDoc(doc(db, 'users', user.uid, 'customCrops', id));
      setCustomCrops(customCrops.filter(c => c.id !== id));
    } catch (e) {
      console.error("Delete failed:", e);
      alert(lang === 'kn' ? "ಅಳಿಸಲು ವಿಫಲವಾಗಿದೆ." : "Delete failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isDataLoading) return <div className="spinner-container"><div className="spinner"></div></div>;

  return (
    <div className="crop-manager">
      <section className="glass-card active-field-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="section-title">🚜 {lang === 'kn' ? 'ಸಕ್ರಿಯ ಕ್ಷೇತ್ರ' : 'Active Field State'}</h2>
          {activeCrop && (
            <button className="btn-harvest" onClick={handleHarvest} disabled={isProcessing}>
              {lang === 'kn' ? 'ಕೊಯ್ಲು' : 'Harvest'}
            </button>
          )}
        </div>

        {activeCrop ? (
          <div className="active-crop-info">
            <div className="crop-badge big">
              <span className="emoji">{activeCrop.emoji}</span>
              <div className="info">
                <h3>{lang === 'kn' ? activeCrop.name_kn : activeCrop.name_en}</h3>
                <p><MapPin size={14} /> {activeCrop.location?.name}</p>
                <small>{lang === 'kn' ? 'ಬಿತ್ತನೆ ದಿನಾಂಕ: ' : 'Planted: '} {new Date(activeCrop.plantingDate).toLocaleDateString()}</small>
              </div>
            </div>

            {currentStageInfo && (
              <div className="growth-tracker" style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}><Sprout size={16} /> {currentStageInfo.stage}</span>
                  <span style={{ color: 'var(--text-secondary)' }}><Calendar size={14} /> Day {currentStageInfo.daysPassed}</span>
                </div>
                <div className="progress-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (currentStageInfo.daysPassed / (activeCrop.lifecycle?.reduce((a, b) => a + b.days, 0) || 100)) * 100)}%`, height: '100%', background: 'var(--primary)' }}></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="empty-state">{lang === 'kn' ? 'ಬೆಳೆ ಆಯ್ಕೆಮಾಡಿ' : 'Select a crop to begin'}</p>
        )}
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 className="section-title">{lang === 'kn' ? '🌾 ಬೆಳೆಗಳು' : '🌾 Crop Profiles'}</h2>
          <button className="btn-primary" onClick={() => setShowCreator(true)}><Plus size={18} /> {lang === 'kn' ? 'ಹೊಸ ಬೆಳೆ' : 'New Crop'}</button>
        </div>

        <div className="crop-grid">
          {Object.values(BUILT_IN_CROPS).map(crop => (
            <div key={crop.id} className={`crop-option ${activeCrop?.id === crop.id ? 'active' : ''}`} onClick={() => handleSetActiveCrop(crop.id)}>
              <span className="emoji">{crop.emoji}</span>
              <span className="label">{lang === 'kn' ? crop.name_kn : crop.name_en}</span>
              {activeCrop?.id === crop.id && <Check size={14} className="active-tick" />}
            </div>
          ))}
          {customCrops.map(crop => (
            <div key={crop.id} className={`crop-option custom ${activeCrop?.id === crop.id ? 'active' : ''}`} onClick={() => handleSetActiveCrop(crop.id)}>
              <span className="emoji">{crop.emoji}</span>
              <span className="label">{lang === 'kn' ? crop.name_kn : crop.name_en}</span>
              <button className="btn-delete" onClick={(e) => deleteCustomCrop(crop.id, e)} disabled={isProcessing}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>

      {showCreator && (
        <div className="modal-overlay">
          <div className="glass-card creator-modal" style={{ maxWidth: '500px', width: '90%' }}>
            <button className="btn-close" onClick={() => setShowCreator(false)}><X size={18} /></button>
            <h3>{lang === 'kn' ? 'ಹೊಸ ಬೆಳೆ ಪೊಬೈಲ್' : 'New Crop Profile'}</h3>
            
            <div className="form-row" style={{ display: 'flex', gap: '15px', marginTop: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>English Name</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={newCrop.name_en} onChange={e => setNewCrop({...newCrop, name_en: e.target.value})} placeholder="e.g. Cotton" />
                  <button className="btn-ai" onClick={handleAiAutoFill} disabled={isAiLoading || !newCrop.name_en}>
                    {isAiLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  </button>
                </div>
              </div>
              <div className="form-group" style={{ width: '80px' }}>
                <label>Emoji</label>
                <input type="text" value={newCrop.emoji} onChange={e => setNewCrop({...newCrop, emoji: e.target.value})} placeholder="🌱" style={{ textAlign: 'center' }} />
              </div>
            </div>

            <div className="form-group">
              <label>ಕನ್ನಡ ಹೆಸರು</label>
              <input type="text" value={newCrop.name_kn} onChange={e => setNewCrop({...newCrop, name_kn: e.target.value})} placeholder="ಉದಾ: ಹತ್ತಿ" />
            </div>

            <div className="threshold-section" style={{ marginTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>Optimal Growth Targets</h4>
              <div className="thresholds-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Moisture (%)</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input type="number" value={newCrop.thresholds.soilMoisture.optimal_min} onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, soilMoisture: {...newCrop.thresholds.soilMoisture, optimal_min: Number(e.target.value)}}})} placeholder="Min" />
                    <input type="number" value={newCrop.thresholds.soilMoisture.optimal_max} onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, soilMoisture: {...newCrop.thresholds.soilMoisture, optimal_max: Number(e.target.value)}}})} placeholder="Max" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Temperature (°C)</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input type="number" value={newCrop.thresholds.temperature.optimal_min} onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, temperature: {...newCrop.thresholds.temperature, optimal_min: Number(e.target.value)}}})} placeholder="Min" />
                    <input type="number" value={newCrop.thresholds.temperature.optimal_max} onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, temperature: {...newCrop.thresholds.temperature, optimal_max: Number(e.target.value)}}})} placeholder="Max" />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button className="btn-primary" onClick={saveCustomCrop} disabled={isProcessing}>{lang === 'kn' ? 'ಉಳಿಸಿ' : 'Save Crop'}</button>
              <button className="btn-secondary" onClick={() => setShowCreator(false)}>{lang === 'kn' ? 'ರದ್ದು' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}

      {locationMode && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <h3>{lang === 'kn' ? 'ಸ್ಥಳ ಆಯ್ಕೆಮಾಡಿ' : 'Set Field Location'}</h3>
            <div className="modal-actions" style={{ flexDirection: 'column', gap: '10px', marginTop: '1rem' }}>
              <button className="btn-primary" onClick={requestGPSLocation} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Navigation size={18} />} 
                {lang === 'kn' ? 'GPS ಬಳಸಿ' : 'Use GPS'}
              </button>
              <button className="btn-secondary" onClick={() => setLocationMode('manual')} disabled={isProcessing}>
                <Search size={18} /> {lang === 'kn' ? 'ಹುಡುಕಿ' : 'Search'}
              </button>
            </div>
            {locationMode === 'manual' && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={locationQuery} onChange={e => setLocationQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchManualLocation()} placeholder="Search city..." />
                  <button className="btn-primary" onClick={searchManualLocation} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                  </button>
                </div>
                <div className="search-results" style={{ marginTop: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                  {searchResults.map((res, i) => (
                    <div key={i} className="search-item" onClick={() => confirmSetActiveCrop({ name: res.display_name, lat: res.lat, lon: res.lon })}>{res.display_name}</div>
                  ))}
                </div>
              </div>
            )}
            {!isProcessing && (
               <button className="btn-close" onClick={() => { setLocationMode(null); setPendingCrop(null); }} style={{ top: '10px', right: '10px' }}><X size={18} /></button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CropManager;
