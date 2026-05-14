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
  const [newCrop, setNewCrop] = useState({
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
  });

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
        setNewCrop(profile);
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

  useEffect(() => {
    if (user && customCrops.length === 0 && !activeCrop && !isDataLoading) {
      loadUserData(user);
    }
  }, [user]);

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
    if (!pendingCrop || !user) return;
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
    } catch (e) {
      console.error("Error setting active crop:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const searchManualLocation = async () => {
    if (!locationQuery || isProcessing) return;
    setIsProcessing(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      setSearchResults(data);
    } catch (e) {
      console.error("Location search failed:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const requestGPSLocation = () => {
    if (!navigator.geolocation) return;
    setIsProcessing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await confirmSetActiveCrop({ name: 'Current Location', lat: latitude, lon: longitude });
      },
      () => {
        setIsProcessing(false);
        setLocationMode('manual');
      }
    );
  };

  const saveCustomCrop = async () => {
    if (!newCrop.name_en || !newCrop.name_kn) return;
    setIsProcessing(true);
    try {
      const cropId = `custom_${Date.now()}`;
      const docRef = doc(db, 'users', user.uid, 'customCrops', cropId);
      await setDoc(docRef, { ...newCrop, id: cropId });
      setCustomCrops([...customCrops, { ...newCrop, id: cropId }]);
      setShowCreator(false);
    } catch (e) {
      console.error("Error saving custom crop:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteCustomCrop = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this crop?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'customCrops', id));
      setCustomCrops(customCrops.filter(c => c.id !== id));
    } catch (e) {
      console.error("Delete failed:", e);
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
              <button className="btn-delete" onClick={(e) => deleteCustomCrop(crop.id, e)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>

      {showCreator && (
        <div className="modal-overlay">
          <div className="glass-card creator-modal" style={{ maxWidth: '500px' }}>
            <button className="btn-close" onClick={() => setShowCreator(false)}><X size={18} /></button>
            <h3>{lang === 'kn' ? 'ಹೊಸ ಬೆಳೆ' : 'New Crop Profile'}</h3>
            
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>English Name</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={newCrop.name_en} onChange={e => setNewCrop({...newCrop, name_en: e.target.value})} placeholder="e.g. Cotton" />
                <button className="btn-ai" onClick={handleAiAutoFill} disabled={isAiLoading || !newCrop.name_en}>
                  {isAiLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>ಕನ್ನಡ ಹೆಸರು</label>
              <input type="text" value={newCrop.name_kn} onChange={e => setNewCrop({...newCrop, name_kn: e.target.value})} />
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
          <div className="glass-card modal-content" style={{ maxWidth: '400px' }}>
            <h3>{lang === 'kn' ? 'ಸ್ಥಳ ಆಯ್ಕೆಮಾಡಿ' : 'Set Field Location'}</h3>
            <div className="modal-actions" style={{ flexDirection: 'column', gap: '10px', marginTop: '1rem' }}>
              <button className="btn-primary" onClick={requestGPSLocation}><Navigation size={18} /> {lang === 'kn' ? 'GPS ಬಳಸಿ' : 'Use GPS'}</button>
              <button className="btn-secondary" onClick={() => setLocationMode('manual')}><Search size={18} /> {lang === 'kn' ? 'ಹುಡುಕಿ' : 'Search'}</button>
            </div>
            {locationMode === 'manual' && (
              <div style={{ marginTop: '1rem' }}>
                <input type="text" value={locationQuery} onChange={e => setLocationQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchManualLocation()} placeholder="Search city..." />
                <div className="search-results">
                  {searchResults.map((res, i) => (
                    <div key={i} className="search-item" onClick={() => confirmSetActiveCrop({ name: res.display_name, lat: res.lat, lon: res.lon })}>{res.display_name}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CropManager;
