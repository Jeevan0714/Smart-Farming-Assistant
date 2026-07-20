import { useState, useMemo } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { BUILT_IN_CROPS } from '../data/cropProfiles';
import { 
  Plus, Trash2, Check, MapPin, Navigation, X, Search, 
  Loader2, Sparkles, Sprout, Calendar, ChevronRight, 
  Settings2, Map as MapIcon, Info
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { generateCropProfile, callGeminiAPI } from '../engine/geminiAdvisor';
import { getCurrentStage } from '../engine/adviceEngine';
import MapPickerModal from './MapPickerModal';

const CropManager = () => {
  const { 
    user, lang, activeCrop, 
    customCrops, setCustomCrops, isDataLoading, 
    fetchWeather, detectedCoords, locationName: dashboardLocationName,
    detectLocation, setActiveFieldId, fields, setFields, switchField, activeFieldId
  } = useAppContext();
  
  const [showCreator, setShowCreator] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedForDetails, setSelectedForDetails] = useState(null);
  
  // Form State for Custom Crop
  const initialCropState = {
    name_en: '',
    name_kn: '',
    variety: '',
    soilType: 'Loam',
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
  const [fieldName, setFieldName] = useState('');

  const handleAiAutoFill = async () => {
    if (!newCrop.name_en?.trim()) {
      alert(lang === 'kn' ? "ದಯವಿಟ್ಟು ಮೊದಲು ಇಂಗ್ಲಿಷ್ ಹೆಸರನ್ನು ನಮೂದಿಸಿ." : "Please enter the English name first.");
      return;
    }
    setIsAiLoading(true);
    try {
      const sharedDocId = `crop_${newCrop.name_en.toLowerCase().trim()}_${(newCrop.variety || 'standard').toLowerCase().trim()}`.replace(/[^a-z0-9_]/g, '_');
      
      // 1. Check shared community database in Firestore first!
      let profile = null;
      try {
        const sharedSnap = await getDoc(doc(db, 'sharedCrops', sharedDocId));
        if (sharedSnap.exists()) {
          profile = sharedSnap.data();
          console.log("Loaded profile from sharedCrops community DB:", profile);
        }
      } catch (cacheErr) {
        console.warn("Shared DB lookup error, falling back to AI:", cacheErr);
      }

      // 2. If not in shared database, call Gemini AI with FAO search grounding!
      if (!profile) {
        profile = await generateCropProfile(newCrop.name_en, newCrop.variety, newCrop.soilType, lang);
        if (profile) {
          try {
            await setDoc(doc(db, 'sharedCrops', sharedDocId), {
              ...profile,
              sharedAt: new Date().toISOString()
            });
          } catch (sharedSaveErr) {
            console.warn("Failed to save to sharedCrops:", sharedSaveErr);
          }
        }
      }

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
        alert(lang === 'kn' ? "FAO/ICAR ವಿಜ್ಞಾನ ಆಧಾರಿತ ಪ್ರೊಫೈಲ್ ರಚಿಸಲಾಗಿದೆ!" : "Scientific FAO profile loaded!");
      } else {
        alert(lang === 'kn' ? "AI ನಿಂದ ಪ್ರೊಫೈಲ್ ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ." : "Could not generate profile.");
      }
    } catch (e) {
      console.error("AI Profiling failed:", e);
      alert(lang === 'kn' ? "ಸಂಪರ್ಕ ವಿಫಲವಾಗಿದೆ." : "Connection failed.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleTranslateName = async () => {
    if (!newCrop.name_en?.trim()) {
      alert(lang === 'kn' ? "ದಯವಿಟ್ಟು ಮೊದಲು ಇಂಗ್ಲಿಷ್ ಹೆಸರನ್ನು ನಮೂದಿಸಿ." : "Please enter the English name first.");
      return;
    }
    setIsAiLoading(true);
    try {
      const prompt = `Translate the crop/plant name "${newCrop.name_en}" to Kannada script (e.g. Cotton -> ಹತ್ತಿ, Sugarcane -> ಕಬ್ಬು, Apple -> ಸೇಬು, Maize -> ಜೋಳ). Return ONLY the translated Kannada word in Kannada script, nothing else.`;
      const res = await callGeminiAPI(prompt);
      if (res && typeof res === 'string' && !res.startsWith('AI Error')) {
        const cleanKnName = res.trim().replace(/^["']|["']$/g, '');
        setNewCrop(prev => ({ ...prev, name_kn: cleanKnName }));
      }
    } catch (e) {
      console.error("Kannada translation failed:", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleHarvest = async () => {
    if (!activeCrop || !activeCrop.fieldId) return;
    if (!window.confirm(lang === 'kn' ? 'ಈ ಬೆಳೆಯನ್ನು ಕೊಯ್ಲು ಮಾಡಿ ಕ್ಷೇತ್ರವನ್ನು ರಿಸೆಟ್ ಮಾಡುವುದೇ?' : 'Harvest this crop and reset the field?')) return;
    setIsProcessing(true);
    try {
      const fieldId = activeCrop.fieldId;
      
      // Update local storage and local state first
      const updatedFields = fields.filter(f => f.id !== fieldId);
      localStorage.setItem('sfa_fields', JSON.stringify(updatedFields));
      localStorage.removeItem('sfa_activeFieldId');
      setFields(updatedFields);
      setActiveFieldId(null);

      // Delete the field document from Firestore
      await deleteDoc(doc(db, 'users', user.uid, 'fields', fieldId));
      
      // Update active field to null in root user doc
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { activeFieldId: null }, { merge: true });
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
    setFieldName(lang === 'kn' ? `${crop.name_kn} ಕ್ಷೇತ್ರ` : `${crop.name_en} Field`);
    setLocationMode('prompt');
  };

  const confirmSetActiveCrop = async (locationData) => {
    if (!pendingCrop || !user) {
      alert(lang === 'kn' ? "ಬೆಳೆ ಅಥವಾ ಬಳಕೆದಾರ ಮಾಹಿತಿ ಇಲ್ಲ." : "Missing crop or user information.");
      return;
    }
    setIsProcessing(true);

    try {
      const fieldId = `field_${Date.now()}`;
      const fieldRef = doc(db, 'users', user.uid, 'fields', fieldId);
      const newFieldData = {
        id: fieldId,
        fieldName: fieldName.trim() || (lang === 'kn' ? `${pendingCrop.name_kn} ಕ್ಷೇತ್ರ` : `${pendingCrop.name_en} Field`),
        cropId: pendingCrop.id,
        plantingDate: new Date(manualPlantingDate).toISOString(),
        location: {
          name: (locationData.name || 'Selected Location'),
          lat: Number(locationData.lat),
          lon: Number(locationData.lon)
        },
        status: 'active'
      };
      
      // Update local storage and local state first
      const updatedFields = [...fields.filter(f => f.id !== fieldId), newFieldData];
      localStorage.setItem('sfa_fields', JSON.stringify(updatedFields));
      localStorage.setItem('sfa_activeFieldId', fieldId);
      setFields(updatedFields);
      setActiveFieldId(fieldId);

      await setDoc(fieldRef, newFieldData);

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        activeFieldId: fieldId
      }, { merge: true });
      
      // Update weather immediately for the new location
      await fetchWeather(true, Number(locationData.lat), Number(locationData.lon), locationData.name);

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
    if (!newCrop.name_en?.trim()) {
      alert(lang === 'kn' ? "ದಯವಿಟ್ಟು ಇಂಗ್ಲಿಷ್ ಹೆಸರನ್ನು ನಮೂದಿಸಿ." : "Please enter the English name.");
      return;
    }
    setIsProcessing(true);
    try {
      const cropId = `custom_${Date.now()}`;
      const docRef = doc(db, 'users', user.uid, 'customCrops', cropId);
      const finalKnName = newCrop.name_kn?.trim() || newCrop.name_en.trim();
      const cropToSave = { ...newCrop, name_kn: finalKnName, id: cropId };
      
      // Update local storage and state first
      const updatedCustom = [...customCrops, cropToSave];
      localStorage.setItem('sfa_customCrops', JSON.stringify(updatedCustom));
      setCustomCrops(updatedCustom);

      await setDoc(docRef, cropToSave);

      // Save copy to shared community database
      try {
        const sharedDocId = `crop_${cropToSave.name_en.toLowerCase().trim()}_${(cropToSave.variety || 'standard').toLowerCase().trim()}`.replace(/[^a-z0-9_]/g, '_');
        await setDoc(doc(db, 'sharedCrops', sharedDocId), {
          ...cropToSave,
          sharedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Shared DB write error:", err);
      }

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

  const saveAndActivateCustomCrop = async () => {
    if (!user) return;
    if (!newCrop.name_en?.trim()) {
      alert(lang === 'kn' ? "ದಯವಿಟ್ಟು ಇಂಗ್ಲಿಷ್ ಹೆಸರನ್ನು ನಮೂದಿಸಿ." : "Please enter the English name.");
      return;
    }
    setIsProcessing(true);
    try {
      const cropId = `custom_${Date.now()}`;
      const docRef = doc(db, 'users', user.uid, 'customCrops', cropId);
      const finalKnName = newCrop.name_kn?.trim() || newCrop.name_en.trim();
      const cropToSave = { ...newCrop, name_kn: finalKnName, id: cropId };
      
      // Update local storage and state first
      const updatedCustom = [...customCrops, cropToSave];
      localStorage.setItem('sfa_customCrops', JSON.stringify(updatedCustom));
      setCustomCrops(updatedCustom);

      await setDoc(docRef, cropToSave);

      // Save copy to shared community database
      try {
        const sharedDocId = `crop_${cropToSave.name_en.toLowerCase().trim()}_${(cropToSave.variety || 'standard').toLowerCase().trim()}`.replace(/[^a-z0-9_]/g, '_');
        await setDoc(doc(db, 'sharedCrops', sharedDocId), {
          ...cropToSave,
          sharedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Shared DB write error:", err);
      }
      setShowCreator(false);
      setNewCrop(initialCropState);
      
      // Directly trigger active crop setup with location prompt
      handleSetActiveCrop(cropToSave);
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
      if (activeCrop && activeCrop.cropId === id) {
        if (activeCrop.fieldId) {
          // Update local storage first
          const updatedFields = fields.filter(f => f.id !== activeCrop.fieldId);
          localStorage.setItem('sfa_fields', JSON.stringify(updatedFields));
          localStorage.removeItem('sfa_activeFieldId');
          setFields(updatedFields);
          setActiveFieldId(null);

          await deleteDoc(doc(db, 'users', user.uid, 'fields', activeCrop.fieldId));
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, { activeFieldId: null }, { merge: true });
        }
      }
      
      // Update custom crops in local storage and state first
      const updatedCustom = customCrops.filter(c => c.id !== id);
      localStorage.setItem('sfa_customCrops', JSON.stringify(updatedCustom));
      setCustomCrops(updatedCustom);

      await deleteDoc(doc(db, 'users', user.uid, 'customCrops', id));
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            <span className="brand-emoji">🚜</span> {lang === 'kn' ? 'ಸಕ್ರಿಯ ಕ್ಷೇತ್ರ' : 'Active Field State'}
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
            {activeCrop && (
              <button className="btn-harvest" onClick={handleHarvest} disabled={isProcessing}>
                <X size={16} /> {lang === 'kn' ? 'ಕೊಯ್ಲು' : 'Harvest'}
              </button>
            )}
          </div>
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
                    {activeCrop.fieldName && <span style={{ fontSize: '1.1rem', color: 'var(--primary)', marginLeft: '10px', fontWeight: '500' }}>({activeCrop.fieldName})</span>}
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
                      width: `${Math.min(100, (currentStageInfo.daysPassed / (activeCrop.lifecycle?.reduce((a, b) => a + (Number(b.days) || 0), 0) || 100)) * 100)}%`
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
                  <div key={crop.id || crop.name_en} 
                    className={`crop-option custom ${activeCrop?.id === crop.id ? 'active' : ''}`} 
                    onClick={() => setSelectedForDetails(crop)}
                  >
                    <span className="emoji">{crop.emoji}</span>
                    <span className="label">{lang === 'kn' ? crop.name_kn : crop.name_en}</span>
                    {activeCrop?.id === crop.id && <Check size={14} className="active-tick" />}
                    <div className="hover-action"><ChevronRight size={16} /></div>
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
                <span className="badge-type">{String(selectedForDetails?.id || '').startsWith('custom') ? 'Custom Profile' : 'Standard Profile'}</span>
              </div>
            </div>

            <div className="detail-stats">
              <div className="stat-card">
                <h4 className="stat-label"><Info size={14} /> Thresholds</h4>
                <ul className="stat-list">
                  <li>💧 Moisture: {selectedForDetails?.thresholds?.soilMoisture?.optimal_min ?? 50}% - {selectedForDetails?.thresholds?.soilMoisture?.optimal_max ?? 75}%</li>
                  <li>🌡️ Temp: {selectedForDetails?.thresholds?.temperature?.optimal_min ?? 20}°C - {selectedForDetails?.thresholds?.temperature?.optimal_max ?? 30}°C</li>
                </ul>
              </div>
              <div className="stat-card">
                <h4 className="stat-label"><Sprout size={14} /> Lifecycle</h4>
                <p className="stat-value">
                  {Array.isArray(selectedForDetails?.lifecycle) ? selectedForDetails.lifecycle.length : 0} Stages<br />
                  Total: {Array.isArray(selectedForDetails?.lifecycle) ? selectedForDetails.lifecycle.reduce((a, b) => a + (Number(b.days) || 0), 0) : 0} Days
                </p>
              </div>
            </div>

            <div className="planting-settings">
              <h4 className="settings-title">📅 {lang === 'kn' ? 'ಬಿತ್ತನೆ ವಿವರಗಳು' : 'Planting Details'}</h4>
              <div className="form-group">
                <label>{lang === 'kn' ? 'ಕ್ಷೇತ್ರದ ಹೆಸರು' : 'Field Name'}</label>
                <input 
                  type="text" 
                  value={fieldName} 
                  onChange={e => setFieldName(e.target.value)} 
                  placeholder={lang === 'kn' ? 'ಉದಾ: ಪ್ರಮುಖ ಕ್ಷೇತ್ರ' : 'e.g. Main Plot'} 
                />
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Planting Date</label>
                <input type="date" value={manualPlantingDate} onChange={e => setManualPlantingDate(e.target.value)} />
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-primary" onClick={() => handleSetActiveCrop(selectedForDetails)}>
                  <Check size={18} /> {lang === 'kn' ? 'ಸಕ್ರಿಯಗೊಳಿಸಿ' : 'Activate Profile'}
                </button>
                <button className="btn-secondary" onClick={() => setSelectedForDetails(null)}>
                  {lang === 'kn' ? 'ರದ್ದು' : 'Cancel'}
                </button>
              </div>

              {String(selectedForDetails?.id || '').startsWith('custom') && (
                <button 
                  className="btn-danger" 
                  onClick={(e) => {
                    deleteCustomCrop(selectedForDetails.id, e);
                    setSelectedForDetails(null);
                  }}
                  disabled={isProcessing}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.85rem',
                    fontWeight: '600'
                  }}
                >
                  <Trash2 size={16} /> {lang === 'kn' ? 'ಪ್ರೊಫೈಲ್ ಅಳಿಸಿ' : 'Delete Profile'}
                </button>
              )}
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
              <label>ಕನ್ನಡ ಹೆಸರು (Kannada Name)</label>
              <div className="ai-input-group">
                <input type="text" value={newCrop.name_kn} onChange={e => setNewCrop({...newCrop, name_kn: e.target.value})} placeholder="ಉದಾ: ಹತ್ತಿ (Auto-generated by AI)" />
                <button className="btn-ai" onClick={handleTranslateName} disabled={isAiLoading || !newCrop.name_en} title="Translate English Name to Kannada">
                  {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                </button>
              </div>
            </div>

            <div className="creator-form-grid mt-1">
              <div className="form-group">
                <label>{lang === 'kn' ? 'ತಳಿ (ಐಚ್ಛಿಕ)' : 'Variety / Cultivar (Optional)'}</label>
                <input 
                  type="text" 
                  value={newCrop.variety || ''} 
                  onChange={e => setNewCrop({...newCrop, variety: e.target.value})} 
                  placeholder={lang === 'kn' ? 'ಉದಾ: ಫ್ಯೂಜಿ / ಹೈಬ್ರಿಡ್ (ಐಚ್ಛಿಕ)' : 'e.g. Fuji / Hybrid (Optional)'} 
                />
              </div>
              <div className="form-group span-2">
                <label>⛰️ {lang === 'kn' ? 'ಮಣ್ಣಿನ ವಿಧ' : 'Soil Type'}</label>
                <select 
                  className="soil-select"
                  value={newCrop.soilType || 'Loam'} 
                  onChange={e => setNewCrop({...newCrop, soilType: e.target.value})}
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    background: 'rgba(0, 0, 0, 0.4)', 
                    border: '1px solid rgba(255, 255, 255, 0.15)', 
                    color: 'white',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Loam" style={{ background: '#18181b', color: '#fff' }}>🌱 {lang === 'kn' ? 'ಸಾಮಾನ್ಯ / ಜೇಡಿ ಮಣ್ಣು (Clay Loam / General Loam)' : 'Clay Loam / General Loam'}</option>
                  <option value="Black Soil" style={{ background: '#18181b', color: '#fff' }}>🖤 {lang === 'kn' ? 'ಕಪ್ಪು ಹತ್ತಿ ಮಣ್ಣು (Black Cotton Soil)' : 'Black Cotton Soil (Regur)'}</option>
                  <option value="Red Soil" style={{ background: '#18181b', color: '#fff' }}>🔴 {lang === 'kn' ? 'ಕೆಂಪು ಮಣ್ಣು (Red Soil / Laterite)' : 'Red Soil / Laterite'}</option>
                  <option value="Alluvial" style={{ background: '#18181b', color: '#fff' }}>🌾 {lang === 'kn' ? 'ಪಾಟಿ ಮಣ್ಣು (Alluvial Soil)' : 'Alluvial Soil'}</option>
                  <option value="Sandy" style={{ background: '#18181b', color: '#fff' }}>🏖️ {lang === 'kn' ? 'ಮರಳು ಮಣ್ಣು (Sandy Loam)' : 'Sandy Loam'}</option>
                  <option value="Clay" style={{ background: '#18181b', color: '#fff' }}>🧱 {lang === 'kn' ? 'ಭಾರೀ ಜೇಡಿ ಮಣ್ಣು (Heavy Clay)' : 'Heavy Clay'}</option>
                  <option value="Silt" style={{ background: '#18181b', color: '#fff' }}>🌊 {lang === 'kn' ? 'ಸಮೆ ಮಣ್ಣು (Silt Loam)' : 'Silt Loam'}</option>
                </select>
              </div>
            </div>

            <div className="thresholds-editor">
              <div className="editor-header">
                <h3><Settings2 size={16} /> {lang === 'kn' ? 'ಬೆಳವಣಿಗೆಯ ಗುರಿಗಳು' : 'Growth Targets'}</h3>
              </div>
              
              <div className="editor-grid">
                <div className="threshold-card">
                  <label>💧 {lang === 'kn' ? 'ತೇವಾಂಶ (%)' : 'Moisture (%)'}</label>
                  <div className="range-group">
                    <div className="input-subgroup">
                      <span>Min</span>
                      <input 
                        type="number" 
                        value={newCrop.thresholds.soilMoisture.optimal_min} 
                        onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, soilMoisture: {...newCrop.thresholds.soilMoisture, optimal_min: Number(e.target.value)}}})} 
                        placeholder="Min" 
                      />
                    </div>
                    <div className="input-subgroup">
                      <span>Max</span>
                      <input 
                        type="number" 
                        value={newCrop.thresholds.soilMoisture.optimal_max} 
                        onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, soilMoisture: {...newCrop.thresholds.soilMoisture, optimal_max: Number(e.target.value)}}})} 
                        placeholder="Max" 
                      />
                    </div>
                  </div>
                </div>

                <div className="threshold-card">
                  <label>🌡️ {lang === 'kn' ? 'ತಾಪಮಾನ (°C)' : 'Temp (°C)'}</label>
                  <div className="range-group">
                    <div className="input-subgroup">
                      <span>Min</span>
                      <input 
                        type="number" 
                        value={newCrop.thresholds.temperature.optimal_min} 
                        onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, temperature: {...newCrop.thresholds.temperature, optimal_min: Number(e.target.value)}}})} 
                        placeholder="Min" 
                      />
                    </div>
                    <div className="input-subgroup">
                      <span>Max</span>
                      <input 
                        type="number" 
                        value={newCrop.thresholds.temperature.optimal_max} 
                        onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, temperature: {...newCrop.thresholds.temperature, optimal_max: Number(e.target.value)}}})} 
                        placeholder="Max" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="thresholds-editor" style={{ marginTop: '1rem' }}>
              <div className="editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3><Sprout size={16} /> {lang === 'kn' ? 'ಬೆಳವಣಿಗೆಯ ಹಂತಗಳು' : 'Lifecycle Stages'}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>
                  Total: {Array.isArray(newCrop.lifecycle) ? newCrop.lifecycle.reduce((a, b) => a + (Number(b.days) || 0), 0) : 0} {lang === 'kn' ? 'ದಿನಗಳು' : 'Days'}
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.isArray(newCrop.lifecycle) && newCrop.lifecycle.map((stageItem, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      value={stageItem.stage} 
                      onChange={e => {
                        const updated = [...newCrop.lifecycle];
                        updated[index] = { ...updated[index], stage: e.target.value };
                        setNewCrop({ ...newCrop, lifecycle: updated });
                      }}
                      placeholder="Stage Name"
                      style={{ flex: 2, padding: '0.45rem 0.6rem', fontSize: '0.85rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white' }}
                    />
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input 
                        type="number" 
                        value={stageItem.days} 
                        onChange={e => {
                          const updated = [...newCrop.lifecycle];
                          updated[index] = { ...updated[index], days: Number(e.target.value) || 0 };
                          setNewCrop({ ...newCrop, lifecycle: updated });
                        }}
                        placeholder="Days"
                        style={{ width: '100%', padding: '0.45rem 0.5rem', textAlign: 'center', fontSize: '0.85rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>d</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowCreator(false)}>
                {lang === 'kn' ? 'ರದ್ದು' : 'Cancel'}
              </button>
              <button className="btn-primary" onClick={saveCustomCrop} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} 
                {lang === 'kn' ? 'ಉಳಿಸಿ' : 'Save Profile'}
              </button>
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }} onClick={saveAndActivateCustomCrop} disabled={isProcessing}>
                <Sparkles size={18} />
                {lang === 'kn' ? 'ಉಳಿಸಿ & ಸಕ್ರಿಯಗೊಳಿಸಿ' : 'Save & Activate'}
              </button>
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

              <button className="btn-location-method" onClick={() => setShowMapPicker(true)} disabled={isProcessing}>
                <div className="icon-circle" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)' }}>
                  <MapIcon size={20} />
                </div>
                <div className="method-text">
                  <strong>{lang === 'kn' ? 'ನಕ್ಷೆಯಲ್ಲಿ ಆಯ್ಕೆಮಾಡಿ (Map Picker)' : 'Pick on Interactive Map'}</strong>
                  <span>{lang === 'kn' ? 'ಸ್ಯಾಟಲೈಟ್ / ನಕ್ಷೆಯಲ್ಲಿ ಜಮೀನು ಗುರುತಿಸಿ' : 'Zoom into satellite view & drop a pin on your field'}</span>
                </div>
              </button>

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

      <MapPickerModal
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={(locData) => {
          setShowMapPicker(false);
          setLocationMode(null);
          confirmSetActiveCrop(locData);
        }}
        initialCoords={detectedCoords || { lat: 12.9716, lon: 77.5946 }}
        lang={lang}
      />

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
        .thresholds-editor { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); padding: 1.25rem; border-radius: 12px; margin: 1.5rem 0; box-sizing: border-box; }
        .editor-header h3 { font-size: 0.95rem; color: #a7f3d0; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px; font-weight: 600; }
        .editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; box-sizing: border-box; }
        .threshold-card { background: rgba(255, 255, 255, 0.03); padding: 0.75rem; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.05); box-sizing: border-box; }
        .threshold-card label { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 6px; display: block; font-weight: 500; }
        .range-group { display: flex; gap: 8px; width: 100%; box-sizing: border-box; }
        .input-subgroup { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .input-subgroup span { font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .input-subgroup input { width: 100%; min-width: 0; box-sizing: border-box; padding: 0.5rem; text-align: center; font-size: 0.85rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; }
        .input-subgroup input:focus { border-color: var(--primary); outline: none; background: rgba(0,0,0,0.6); }

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

        @media (max-width: 600px) {
          .creator-modal, .detail-modal, .location-modal {
            width: 95% !important;
            max-height: 85vh !important;
            overflow-y: auto !important;
            padding: 1.25rem !important;
          }
          .creator-form-grid {
            grid-template-columns: 1fr;
          }
          .span-2 {
            grid-column: span 1;
          }
          .editor-grid {
            grid-template-columns: 1fr;
          }
          .detail-stats {
            grid-template-columns: 1fr;
          }
          .modal-actions {
            flex-direction: column;
            width: 100%;
          }
          .modal-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default CropManager;
