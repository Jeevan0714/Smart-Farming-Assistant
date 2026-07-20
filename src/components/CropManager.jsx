import { useState, useMemo } from 'react';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { BUILT_IN_CROPS } from '../data/cropProfiles';
import { 
  Plus, Trash2, Check, MapPin, Navigation, X, Search, 
  Loader2, Sparkles, Sprout, Calendar, ChevronRight, 
  Settings2, Map as MapIcon, Info
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { generateCropProfile } from '../engine/geminiAdvisor';
import { getCurrentStage } from '../engine/adviceEngine';

const CropManager = () => {
  const { 
    user, lang, setActiveCrop, activeCrop, 
    customCrops, setCustomCrops, isDataLoading, 
    fetchWeather, detectedCoords, locationName: dashboardLocationName,
    detectLocation // Correctly destructuring from hook at top level
  } = useAppContext();
  
  const [showCreator, setShowCreator] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedForDetails, setSelectedForDetails] = useState(null);
  
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
  const [manualPlantingDate, setManualPlantingDate] = useState(new Date().toISOString().split('T')[0]);

  const handleAiAutoFill = async () => {
    if (!newCrop.name_en) {
      alert(lang === 'kn' ? "ದಯವಿಟ್ಟು ಮೊದಲು ಇಂಗ್ಲಿಷ್ ಹೆಸರನ್ನು ನಮೂದಿಸಿ." : "Please enter the English name first.");
      return;
    }
    setIsAiLoading(true);
    try {
      const profile = await generateCropProfile(newCrop.name_en, lang);
      if (profile) {
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
        alert(lang === 'kn' ? "AI ನಿಂದ ಪ್ರೊಫೈಲ್ ರಚಿಸಲಾಗಿದೆ!" : "Profile generated with AI!");
      } else {
        alert(lang === 'kn' ? "AI ನಿಂದ ಪ್ರೊಫೈಲ್ ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಹೆಸರನ್ನು ಸರಿಯಾಗಿ ನಮೂದಿಸಿ ಅಥವಾ ಸರ್ವರ್ ಪರಿಶೀಲಿಸಿ." : "Could not generate profile with AI. Please check the name or server connection.");
      }
    } catch (e) {
      console.error("AI Profiling failed:", e);
      alert(lang === 'kn' ? "AI ಸಂಪರ್ಕ ವಿಫಲವಾಗಿದೆ." : "AI Connection failed.");
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

  const currentStageInfo = useMemo(() => {
    return activeCrop ? getCurrentStage(activeCrop, activeCrop.plantingDate) : null;
  }, [activeCrop]);

  const handleSetActiveCrop = (crop) => {
    setPendingCrop(crop);
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
        plantingDate: new Date(manualPlantingDate).toISOString(),
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
      
      // Update weather immediately for the new location
      await fetchWeather(true, Number(locationData.lat), Number(locationData.lon));

      // Close modal and reset state
      setPendingCrop(null);
      setLocationMode(null);
      setSearchResults([]);
      setLocationQuery('');
      setSelectedForDetails(null);
      
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
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'SmartFarmingAssistant/1.0 (contact: smartfarmingdbit@gmail.com)'
        }
      });
      if (!res.ok) throw new Error("Search service unavailable");
      const data = await res.json();
      if (data.length === 0) {
        alert(lang === 'kn' ? "ಯಾವುದೇ ಸ್ಥಳ ಕಂಡುಬಂದಿಲ್ಲ." : "No locations found.");
      }
      setSearchResults(data);
    } catch (e) {
      console.error("Location search failed:", e);
      alert(lang === 'kn' ? "ಹುಡುಕಾಟ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ." : "Search failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const requestGPSLocation = async () => {
    setIsProcessing(true);
    try {
      const location = await detectLocation(false);
      if (location) {
        await confirmSetActiveCrop({ 
          name: location.name || 'Current Location', 
          lat: location.lat, 
          lon: location.lon 
        });
      }
    } catch (err) {
      console.error("Location detection failed", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveCustomCrop = async () => {
    if (!user) return;
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
    if (!user) return;
    if (!window.confirm(lang === 'kn' ? 'ಈ ಬೆಳೆಯನ್ನು ಅಳಿಸುವುದೇ?' : 'Delete this crop?')) return;
    
    setIsProcessing(true);
    try {
      if (activeCrop && activeCrop.id === id) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { activeCropId: null, activeFieldInfo: null }, { merge: true });
        setActiveCrop(null);
      }
      
      await deleteDoc(doc(db, 'users', user.uid, 'customCrops', id));
      setCustomCrops(customCrops.filter(c => c.id !== id));
      if (selectedForDetails?.id === id) setSelectedForDetails(null);
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
      <section className="glass-card active-field-card" style={{ marginBottom: '2.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            <span className="brand-emoji">🚜</span> {lang === 'kn' ? 'ಸಕ್ರಿಯ ಕ್ಷೇತ್ರ' : 'Active Field State'}
          </h2>
          {activeCrop && (
            <button className="btn-harvest" onClick={handleHarvest} disabled={isProcessing}>
              <X size={16} /> {lang === 'kn' ? 'ಕೊಯ್ಲು' : 'Harvest'}
            </button>
          )}
        </div>

        {activeCrop ? (
          <div className="active-crop-info-grid">
            <div className="crop-visual">
              <div className="emoji-container">
                {activeCrop.emoji}
              </div>
            </div>
            
            <div className="crop-meta">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="active-crop-name">
                    {lang === 'kn' ? activeCrop.name_kn : activeCrop.name_en}
                  </h3>
                  <div className="active-crop-details">
                    <span className="detail-item">
                      <MapPin size={16} className="text-primary" /> {activeCrop.location?.name || 'Unknown'}
                    </span>
                    <span className="detail-item">
                      <Calendar size={16} className="text-primary" /> 
                      {lang === 'kn' ? 'ಬಿತ್ತನೆ: ' : 'Planted: '} {new Date(activeCrop.plantingDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {currentStageInfo && (
                <div className="growth-tracker-enhanced">
                  <div className="tracker-header">
                    <div className="stage-info">
                      <span className="stage-label">Current Growth Stage</span>
                      <span className="stage-value">
                        <Sprout size={18} /> {currentStageInfo.stage}
                      </span>
                    </div>
                    <span className="day-count">Day {currentStageInfo.daysPassed}</span>
                  </div>
                  <div className="progress-container">
                    <div className="progress-fill" style={{ 
                      width: `${Math.min(100, (currentStageInfo.daysPassed / (activeCrop.lifecycle?.reduce((a, b) => a + b.days, 0) || 100)) * 100)}%`
                    }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state-field">
            <div className="empty-emoji">🚜</div>
            <p className="empty-text">
              {lang === 'kn' ? 'ಯಾವುದೇ ಸಕ್ರಿಯ ಬೆಳೆ ಇಲ್ಲ. ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗಿನ ಬೆಳೆ ಪ್ರೊಫೈಲ್ ಆಯ್ಕೆಮಾಡಿ.' : 'No active field detected. Select a crop profile below to start.'}
            </p>
          </div>
        )}
      </section>

      <section>
        <div className="profiles-header">
          <h2 className="section-title">
            <span className="brand-emoji">🌾</span> {lang === 'kn' ? 'ಬೆಳೆ ಪ್ರೊಫೈಲ್‌ಗಳು' : 'Crop Profiles'}
          </h2>
          <button className="btn-add-crop" onClick={() => setShowCreator(true)}>
            <Plus size={18} /> {lang === 'kn' ? 'ಹೊಸ ಬೆಳೆ' : 'New Crop'}
          </button>
        </div>

        <div className="crop-grid-wrapper">
          <div className="grid-category">Standard Library</div>
          <div className="crop-grid">
            {Object.values(BUILT_IN_CROPS).map(crop => (
              <div key={crop.id} 
                className={`crop-option ${activeCrop?.id === crop.id ? 'active' : ''}`} 
                onClick={() => setSelectedForDetails(crop)}
              >
                <span className="emoji">{crop.emoji}</span>
                <span className="label">{lang === 'kn' ? crop.name_kn : crop.name_en}</span>
                {activeCrop?.id === crop.id && <Check size={14} className="active-tick" />}
                <div className="hover-action"><ChevronRight size={16} /></div>
              </div>
            ))}
          </div>

          {customCrops.length > 0 && (
            <>
              <div className="grid-category" style={{ marginTop: '2rem' }}>Custom Profiles</div>
              <div className="crop-grid">
                {customCrops.map(crop => (
                  <div key={crop.id} 
                    className={`crop-option custom ${activeCrop?.id === crop.id ? 'active' : ''}`} 
                    onClick={() => setSelectedForDetails(crop)}
                  >
                    <span className="emoji">{crop.emoji}</span>
                    <span className="label">{lang === 'kn' ? crop.name_kn : crop.name_en}</span>
                    <button className="btn-delete-crop" onClick={(e) => deleteCustomCrop(crop.id, e)} disabled={isProcessing}>
                      <Trash2 size={14} />
                    </button>
                    {activeCrop?.id === crop.id && <Check size={14} className="active-tick" />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {selectedForDetails && (
        <div className="modal-overlay" onClick={() => setSelectedForDetails(null)}>
          <div className="glass-card modal-content detail-modal" onClick={e => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setSelectedForDetails(null)}><X size={20} /></button>
            
            <div className="detail-header">
              <span className="detail-emoji">{selectedForDetails.emoji}</span>
              <div>
                <h3 className="detail-name">{lang === 'kn' ? selectedForDetails.name_kn : selectedForDetails.name_en}</h3>
                <span className="badge-type">{selectedForDetails.id.startsWith('custom') ? 'Custom Profile' : 'Standard Profile'}</span>
              </div>
            </div>

            <div className="detail-stats">
              <div className="stat-card">
                <h4 className="stat-label"><Info size={14} /> Thresholds</h4>
                <ul className="stat-list">
                  <li>💧 Moisture: {selectedForDetails.thresholds.soilMoisture.optimal_min}% - {selectedForDetails.thresholds.soilMoisture.optimal_max}%</li>
                  <li>🌡️ Temp: {selectedForDetails.thresholds.temperature.optimal_min}°C - {selectedForDetails.thresholds.temperature.optimal_max}°C</li>
                </ul>
              </div>
              <div className="stat-card">
                <h4 className="stat-label"><Sprout size={14} /> Lifecycle</h4>
                <p className="stat-value">
                  {selectedForDetails.lifecycle.length} Stages<br />
                  Total: {selectedForDetails.lifecycle.reduce((a, b) => a + b.days, 0)} Days
                </p>
              </div>
            </div>

            <div className="planting-settings">
              <h4 className="settings-title">📅 {lang === 'kn' ? 'ಬಿತ್ತನೆ ವಿವರಗಳು' : 'Planting Details'}</h4>
              <div className="form-group">
                <label>Planting Date</label>
                <input type="date" value={manualPlantingDate} onChange={e => setManualPlantingDate(e.target.value)} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={() => handleSetActiveCrop(selectedForDetails)}>
                <Check size={18} /> {lang === 'kn' ? 'ಸಕ್ರಿಯಗೊಳಿಸಿ' : 'Activate Profile'}
              </button>
              <button className="btn-secondary" onClick={() => setSelectedForDetails(null)}>
                {lang === 'kn' ? 'ರದ್ದು' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreator && (
        <div className="modal-overlay">
          <div className="glass-card creator-modal">
            <button className="btn-close" onClick={() => setShowCreator(false)}><X size={18} /></button>
            <h3 className="creator-title"><Sparkles size={20} className="text-primary" /> {lang === 'kn' ? 'ಹೊಸ ಬೆಳೆ ಪ್ರೊಫೈಲ್' : 'Create Custom Profile'}</h3>
            
            <p className="creator-hint">
              Define growth parameters or use AI to generate a profile automatically.
            </p>

            <div className="creator-form-grid">
              <div className="form-group span-2">
                <label>English Name</label>
                <div className="ai-input-group">
                  <input type="text" value={newCrop.name_en} onChange={e => setNewCrop({...newCrop, name_en: e.target.value})} placeholder="e.g. Cotton" />
                  <button className="btn-ai" onClick={handleAiAutoFill} disabled={isAiLoading || !newCrop.name_en}>
                    {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Emoji</label>
                <input type="text" value={newCrop.emoji} onChange={e => setNewCrop({...newCrop, emoji: e.target.value})} placeholder="🌱" className="text-center" />
              </div>
            </div>

            <div className="form-group mt-1">
              <label>ಕನ್ನಡ ಹೆಸರು</label>
              <input type="text" value={newCrop.name_kn} onChange={e => setNewCrop({...newCrop, name_kn: e.target.value})} placeholder="ಉದಾ: ಹತ್ತಿ" />
            </div>

            <div className="thresholds-editor">
              <div className="editor-header">
                <h3><Settings2 size={16} /> Growth Targets</h3>
              </div>
              
              <div className="editor-grid">
                <div className="threshold-item">
                  <label>Moisture (%)</label>
                  <div className="range-group">
                    <input type="number" value={newCrop.thresholds.soilMoisture.optimal_min} onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, soilMoisture: {...newCrop.thresholds.soilMoisture, optimal_min: Number(e.target.value)}}})} placeholder="Min" />
                    <input type="number" value={newCrop.thresholds.soilMoisture.optimal_max} onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, soilMoisture: {...newCrop.thresholds.soilMoisture, optimal_max: Number(e.target.value)}}})} placeholder="Max" />
                  </div>
                </div>
                <div className="threshold-item">
                  <label>Temp (°C)</label>
                  <div className="range-group">
                    <input type="number" value={newCrop.thresholds.temperature.optimal_min} onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, temperature: {...newCrop.thresholds.temperature, optimal_min: Number(e.target.value)}}})} placeholder="Min" />
                    <input type="number" value={newCrop.thresholds.temperature.optimal_max} onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, temperature: {...newCrop.thresholds.temperature, optimal_max: Number(e.target.value)}}})} placeholder="Max" />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={saveCustomCrop} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} 
                {lang === 'kn' ? 'ಉಳಿಸಿ' : 'Save Profile'}
              </button>
              <button className="btn-secondary" onClick={() => setShowCreator(false)}>{lang === 'kn' ? 'ರದ್ದು' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}

      {locationMode && (
        <div className="modal-overlay">
          <div className="glass-card modal-content location-modal">
            <button className="btn-close" onClick={() => { setLocationMode(null); setPendingCrop(null); }}><X size={18} /></button>
            
            <div className="location-header">
              <div className="location-icon">📍</div>
              <h3>{lang === 'kn' ? 'ಸ್ಥಳ ಆಯ್ಕೆಮಾಡಿ' : 'Set Field Location'}</h3>
              <p>{lang === 'kn' ? 'ಹವಾಮಾನ ಡೇಟಾವನ್ನು ಪಡೆಯಲು ಸ್ಥಳದ ಅಗತ್ಯವಿದೆ.' : 'Required for local weather tracking.'}</p>
            </div>

            <div className="location-options">
              {detectedCoords && (
                <button className="btn-location-method" onClick={() => confirmSetActiveCrop({ name: dashboardLocationName, lat: detectedCoords.lat, lon: detectedCoords.lon })} disabled={isProcessing}>
                  <div className="icon-circle" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><MapPin size={20} /></div>
                  <div className="method-text">
                    <strong>{lang === 'kn' ? 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಸ್ಥಳ ಬಳಸಿ' : 'Use Dashboard Location'}</strong>
                    <span>{dashboardLocationName}</span>
                  </div>
                </button>
              )}

              <button className="btn-location-method" onClick={requestGPSLocation} disabled={isProcessing}>
                <div className="icon-circle"><Navigation size={20} /></div>
                <div className="method-text">
                  <strong>{lang === 'kn' ? 'GPS ಬಳಸಿ' : 'Use Current GPS'}</strong>
                  <span>Detect your coordinates</span>
                </div>
                {isProcessing && locationMode === 'prompt' && <Loader2 className="animate-spin" size={18} />}
              </button>

              <div className="manual-search">
                <div className="search-bar">
                  <Search size={16} className="search-icon" />
                  <input 
                    type="text" 
                    value={locationQuery} 
                    onChange={e => { setLocationQuery(e.target.value); setLocationMode('manual'); }} 
                    onKeyDown={e => e.key === 'Enter' && searchManualLocation()} 
                    placeholder="Search city/village..." 
                  />
                  <button className="btn-search-trigger" onClick={searchManualLocation} disabled={isProcessing}>
                    {isProcessing && locationMode === 'manual' ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="results-container">
                    {searchResults.map((res, i) => (
                      <div key={i} className="result-row" onClick={() => confirmSetActiveCrop({ name: res.display_name, lat: res.lat, lon: res.lon })}>
                        <MapIcon size={14} />
                        <span className="result-name">{res.display_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .crop-manager {
          max-width: 1000px;
          margin: 0 auto;
        }
        .active-field-card {
          border-left: 4px solid var(--primary);
          background: linear-gradient(to right, rgba(16, 185, 129, 0.05), transparent);
        }
        .active-crop-info-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 2rem;
        }
        @media (max-width: 600px) {
          .active-crop-info-grid {
            grid-template-columns: 1fr;
            text-align: center;
          }
          .crop-visual { display: flex; justify-content: center; }
        }
        .emoji-container {
          font-size: 4rem;
          background: rgba(16, 185, 129, 0.1);
          width: 120px;
          height: 120px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px var(--primary-glow);
        }
        .active-crop-name {
          font-size: 1.8rem;
          color: white;
          margin-bottom: 8px;
        }
        .active-crop-details {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
        }
        .detail-item {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }
        .growth-tracker-enhanced {
          margin-top: 1.5rem;
        }
        .tracker-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.8rem;
          align-items: flex-end;
        }
        .stage-label {
          display: block;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .stage-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .day-count {
          font-size: 0.9rem;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .progress-container {
          height: 12px;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.1);
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), #a7f3d0);
          box-shadow: 0 0 10px var(--primary-glow);
          transition: width 1s ease-in-out;
        }
        .empty-state-field {
          text-align: center;
          padding: 2rem;
          border: 2px dashed rgba(255,255,255,0.1);
          border-radius: 12px;
        }
        .empty-emoji { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }
        .empty-text { color: var(--text-secondary); font-size: 1.1rem; }

        .profiles-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .grid-category {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 1rem;
        }
        .crop-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 15px;
        }
        .crop-option {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }
        .crop-option:hover {
          border-color: var(--primary);
          background: rgba(16, 185, 129, 0.05);
          transform: translateY(-4px);
        }
        .crop-option.active {
          border-color: var(--primary);
          background: rgba(16, 185, 129, 0.1);
          box-shadow: 0 0 20px var(--primary-glow);
        }
        .crop-option .emoji { font-size: 2.5rem; }
        .crop-option .label { font-size: 0.95rem; font-weight: 600; color: var(--text-secondary); }
        .active-tick {
          position: absolute;
          top: 8px;
          right: 8px;
          background: var(--primary);
          color: white;
          border-radius: 50%;
          padding: 3px;
        }
        .hover-action {
          position: absolute;
          bottom: 10px;
          right: 10px;
          color: var(--text-muted);
          opacity: 0;
          transition: all 0.2s ease;
        }
        .crop-option:hover .hover-action { opacity: 1; transform: translateX(4px); }
        .btn-delete-crop {
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(239, 68, 68, 0.1);
          border: none;
          color: #f87171;
          padding: 5px;
          border-radius: 8px;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s ease;
        }
        .crop-option:hover .btn-delete-crop { opacity: 1; }

        /* Modal Styles */
        .detail-modal { max-width: 500px; width: 90%; }
        .detail-header { display: flex; gap: 20px; align-items: center; margin-bottom: 1.5rem; }
        .detail-emoji { font-size: 3.5rem; }
        .detail-name { font-size: 1.8rem; color: white; }
        .detail-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.5rem; }
        .stat-card { background: rgba(0,0,0,0.2); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
        .stat-label { color: var(--primary); font-size: 0.9rem; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .stat-list { list-style: none; font-size: 0.85rem; color: var(--text-secondary); }
        .stat-value { font-size: 0.85rem; color: var(--text-secondary); }
        .settings-title { font-size: 0.95rem; margin-bottom: 1rem; }
        .planting-settings { background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; }

        .creator-modal { max-width: 550px; width: 90%; }
        .creator-title { display: flex; align-items: center; gap: 10px; margin-bottom: 0.5rem; }
        .creator-hint { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem; }
        .creator-form-grid { display: grid; grid-template-columns: 1fr 1fr 80px; gap: 12px; }
        .span-2 { grid-column: span 2; }
        .ai-input-group { display: flex; gap: 8px; }
        .btn-ai { background: linear-gradient(135deg, #10b981, #3b82f6); color: white; border: none; padding: 0 12px; border-radius: 8px; cursor: pointer; }
        .text-center { text-align: center; }
        .mt-1 { margin-top: 1rem; }
        .thresholds-editor { background: rgba(0,0,0,0.2); padding: 1.2rem; border-radius: 12px; margin: 1.5rem 0; }
        .editor-header h3 { font-size: 1rem; color: #a7f3d0; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px; }
        .editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .range-group { display: flex; gap: 10px; }
        .threshold-item label { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; display: block; }

        .location-modal { max-width: 450px; width: 90%; }
        .location-header { text-align: center; margin-bottom: 1.5rem; }
        .location-icon { font-size: 2.5rem; margin-bottom: 10px; }
        .location-options { display: flex; flex-direction: column; gap: 15px; }
        .btn-location-method { display: flex; align-items: center; gap: 15px; padding: 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--card-border); border-radius: 12px; cursor: pointer; color: white; width: 100%; text-align: left; }
        .icon-circle { width: 44px; height: 44px; background: rgba(16, 185, 129, 0.1); color: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .method-text strong { display: block; font-size: 1rem; }
        .method-text span { font-size: 0.8rem; color: var(--text-muted); }
        .search-bar { position: relative; display: flex; gap: 8px; margin-top: 10px; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .search-bar input { padding-left: 38px; width: 100%; }
        .btn-search-trigger { padding: 0 15px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; }
        .results-container { margin-top: 10px; max-height: 150px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 8px; }
        .result-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .result-row:hover { background: rgba(16, 185, 129, 0.1); }

        .text-primary { color: var(--primary); }
      `}</style>
    </div>
  );
};

export default CropManager;
