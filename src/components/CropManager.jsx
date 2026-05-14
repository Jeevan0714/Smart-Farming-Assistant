import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { BUILT_IN_CROPS } from '../data/cropProfiles';
import { Plus, Trash2, Check, MapPin, Navigation, Edit2, X, Search, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const CropManager = () => {
  const { 
    user, lang, setActiveCrop, activeCrop, 
    customCrops, setCustomCrops, isDataLoading, loadUserData 
  } = useAppContext();
  
  const [showCreator, setShowCreator] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form State for Custom Crop
  const [newCrop, setNewCrop] = useState({
    name_en: '',
    name_kn: '',
    emoji: '🌱',
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

  useEffect(() => {
    // If user is logged in but data hasn't started loading, trigger it
    // This is a safety check in case the global load didn't happen for some reason
    if (user && customCrops.length === 0 && !activeCrop && !isDataLoading) {
      loadUserData(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    console.log("confirmSetActiveCrop started with:", locationData);
    if (!pendingCrop) {
      console.error("No pending crop selected");
      alert(lang === 'kn' ? "ಯಾವುದೇ ಬೆಳೆ ಆಯ್ಕೆ ಮಾಡಿಲ್ಲ." : "No crop selected.");
      return;
    }
    if (!user || !user.uid) {
      console.error("No user authenticated");
      alert(lang === 'kn' ? "ಲಾಗಿನ್ ಅಗತ್ಯವಿದೆ." : "Login required.");
      return;
    }

    // Ensure coordinates are valid numbers
    const lat = Number(locationData.lat);
    const lon = Number(locationData.lon);

    if (isNaN(lat) || isNaN(lon)) {
      console.error("Invalid coordinates received:", locationData);
      alert(lang === 'kn' ? "ಅಮಾನ್ಯವಾದ ಸ್ಥಳ ಡೇಟಾ." : "Invalid location data received.");
      return;
    }

    setIsProcessing(true);

    try {
      console.log("[CropManager] confirmSetActiveCrop starting. Location:", locationData);
      const userDocRef = doc(db, 'users', user.uid);
      const activeFieldInfo = {
        plantingDate: new Date().toISOString(),
        location: {
          name: (locationData.name || 'Selected Location').substring(0, 100),
          lat: lat,
          lon: lon
        }
      };
      
      console.log("[CropManager] Attempting Firestore write to path: users/" + user.uid);
      
      const writePromise = setDoc(userDocRef, {
        activeCropId: pendingCrop.id,
        activeFieldInfo: activeFieldInfo
      }, { merge: true });

      // Increased timeout to 30 seconds for slower networks
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database timeout (30s reached)")), 30000)
      );

      console.log("[CropManager] Waiting for writePromise or timeout...");
      await Promise.race([writePromise, timeoutPromise]);
      console.log("[CropManager] Firestore write successful.");

      const fullCrop = { ...pendingCrop, ...activeFieldInfo };
      console.log("[CropManager] Updating context state with new active crop.");
      setActiveCrop(fullCrop);
      
      // Cleanup - only on success
      setPendingCrop(null);
      setLocationMode(null);
      setLocationQuery('');
      setSearchResults([]);
      console.log("[CropManager] confirmSetActiveCrop completed successfully.");
    } catch (e) {
      console.error("[CropManager] Detailed Error in confirmSetActiveCrop:", e);
      alert(lang === 'kn' ? `ದೋಷ ಸಂಭವಿಸಿದೆ: ${e.message}` : `Error occurred: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const searchManualLocation = async () => {
    console.log("searchManualLocation started with query:", locationQuery);
    if (!locationQuery || isProcessing) return;
    
    setIsProcessing(true);
    setSearchResults([]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=5&addressdetails=1`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept-Language': lang === 'kn' ? 'kn' : 'en',
          'User-Agent': 'SmartFarmingAssistant/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`Search service error: ${res.status}`);
      
      const data = await res.json();
      console.log("Search results received:", data);
      setSearchResults(data);
      
      if (data.length === 0) {
        alert(lang === 'kn' ? 'ಸ್ಥಳ ಕಂಡುಬಂದಿಲ್ಲ' : 'No locations found. Try being more specific.');
      }
    } catch (e) {
      console.error("Search API failed:", e);
      const msg = e.name === 'AbortError' ? 'Search timed out' : e.message;
      alert(lang === 'kn' ? `ಹುಡುಕಾಟ ವಿಫಲವಾಗಿದೆ: ${msg}` : `Search failed: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const requestGPSLocation = () => {
    console.log("requestGPSLocation triggered");
    if (!navigator.geolocation) {
      alert(lang === 'kn' ? 'ಜಿಯೋಲೋಕೇಶನ್ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ' : 'Geolocation not supported');
      setLocationMode('manual');
      return;
    }

    setIsProcessing(true);
    
    const geoTimeout = setTimeout(() => {
      console.warn("Geolocation request timed out");
      alert(lang === 'kn' ? 'ಸ್ಥಳ ಪಡೆಯಲು ತಡವಾಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಕೈಯಾರೆ ನಮೂದಿಸಿ.' : 'Location request timed out. Please enter manually.');
      setLocationMode('manual');
      setIsProcessing(false);
    }, 15000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(geoTimeout);
        const { latitude, longitude } = pos.coords;
        console.log("GPS Coordinates received:", latitude, longitude);
        
        try {
          const controller = new AbortController();
          const reverseTimeoutId = setTimeout(() => controller.abort(), 8000);

          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`;
          const res = await fetch(url, {
            signal: controller.signal,
            headers: {
              'Accept-Language': lang === 'kn' ? 'kn' : 'en',
              'User-Agent': 'SmartFarmingAssistant/1.0'
            }
          });
          
          clearTimeout(reverseTimeoutId);
          const data = await res.json();
          console.log("Reverse geo data received:", data);
          
          const addr = data?.address || {};
          const localArea = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city_district || data?.display_name?.split(',')[0] || 'Current Location';
          const city = addr.city || addr.town || addr.municipality || '';
          const finalName = city && localArea !== city ? `${localArea}, ${city}` : localArea;
          
          console.log("Proceeding to confirm crop with name:", finalName);
          await confirmSetActiveCrop({ 
            name: finalName, 
            lat: latitude, 
            lon: longitude 
          });
        } catch (err) {
          console.warn("Reverse geocoding fallback:", err);
          await confirmSetActiveCrop({ 
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, 
            lat: latitude, 
            lon: longitude 
          });
        }
      },
      (err) => {
        clearTimeout(geoTimeout);
        console.error("Geolocation precision error:", err);
        alert(lang === 'kn' ? 'ಸ್ಥಳ ಪ್ರವೇಶ ವಿಫಲವಾಗಿದೆ ಅಥವಾ ನಿರಾಕರಿಸಲಾಗಿದೆ.' : 'Location access failed or denied.');
        setLocationMode('manual');
        setIsProcessing(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const saveCustomCrop = async () => {
    if (!newCrop.name_en || !newCrop.name_kn) {
      alert(lang === 'kn' ? 'ಹೆಸರನ್ನು ನಮೂದಿಸಿ' : 'Please enter crop names');
      return;
    }

    setIsProcessing(true);
    try {
      const cropId = `custom_${Date.now()}`;
      const docRef = doc(db, 'users', user.uid, 'customCrops', cropId);
      await setDoc(docRef, { ...newCrop, id: cropId });
      
      setCustomCrops([...customCrops, { ...newCrop, id: cropId }]);
      setShowCreator(false);
      setNewCrop({
        name_en: '',
        name_kn: '',
        emoji: '🌱',
        thresholds: {
          soilMoisture: { low: 30, optimal_min: 50, optimal_max: 70, high: 85 },
          nutrients: { low: 30, optimal_min: 50, optimal_max: 70, high: 90 },
          temperature: { low: 10, optimal_min: 20, optimal_max: 30, high: 40 }
        }
      });
    } catch (e) {
      console.error("Error saving custom crop:", e);
    }
    setIsProcessing(false);
  };

  const deleteCustomCrop = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm(lang === 'kn' ? 'ಈ ಬೆಳೆಯನ್ನು ಅಳಿಸುವುದೇ?' : 'Delete this custom crop?')) return;
    
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'customCrops', id));
      setCustomCrops(customCrops.filter(c => c.id !== id));
      if (activeCrop?.id === id) {
        handleHarvest();
      }
    } catch (e) {
      console.error("Error deleting crop:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isDataLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1rem' }}>
      <div className="spinner"></div>
      <p style={{ color: 'var(--text-secondary)' }}>{lang === 'kn' ? 'ಡೇಟಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ...' : 'Loading field data...'}</p>
    </div>
  );

  return (
    <div className="crop-manager">
      {/* Active Field Header */}
      <section className="glass-card active-field-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            {lang === 'kn' ? '🚜 ಸಕ್ರಿಯ ಕ್ಷೇತ್ರ' : '🚜 Active Field State'}
          </h2>
          {activeCrop && (
            <button className="btn-harvest" onClick={handleHarvest} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin" size={14} /> : (lang === 'kn' ? 'ಕೊಯ್ಲು / ರಿಸೆಟ್' : 'Harvest / Reset')}
            </button>
          )}
        </div>

        {activeCrop ? (
          <div className="active-crop-info">
            <div className="crop-badge big">
              <span className="emoji">{activeCrop.emoji}</span>
              <div className="info">
                <h3>{lang === 'kn' ? activeCrop.name_kn : activeCrop.name_en}</h3>
                <p>
                  <MapPin size={14} style={{ marginRight: '4px', color: 'var(--primary)' }} />
                  {activeCrop.location?.name || 'Unknown Location'}
                </p>
                <small>
                  {lang === 'kn' ? 'ಬಿತ್ತನೆ ದಿನಾಂಕ: ' : 'Planted on: '}
                  {new Date(activeCrop.plantingDate).toLocaleDateString()}
                </small>
              </div>
            </div>
          </div>
        ) : (
          <p className="empty-state">
            {lang === 'kn' 
              ? 'ಯಾವುದೇ ಬೆಳೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿಲ್ಲ. ಮೇಲ್ವಿಚಾರಣೆ ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗಿನ ಪಟ್ಟಿಯಿಂದ ಒಂದನ್ನು ಆರಿಸಿ.' 
              : 'No crop is currently planted. Select one from below to begin monitoring.'}
          </p>
        )}
      </section>

      {/* Location Modal Overlay */}
      {locationMode && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '500px' }}>
            <button 
              className="btn-close" 
              onClick={() => setLocationMode(null)} 
              disabled={isProcessing}
            >
              <X size={18} />
            </button>
            
            {locationMode === 'prompt' && (
              <>
                <h3>{lang === 'kn' ? 'ಕ್ಷೇತ್ರದ ಸ್ಥಳವನ್ನು ಹೊಂದಿಸಿ' : 'Set Field Location'}</h3>
                <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                  {lang === 'kn' ? 'ಈ ಬೆಳೆಗೆ ಸ್ಥಳವನ್ನು ಹೇಗೆ ನೀಡಲು ಬಯಸುವಿರಿ?' : 'How would you like to set the location for this field?'}
                </p>
                <div className="modal-actions" style={{ gridTemplateColumns: '1fr' }}>
                  <button className="btn-primary" onClick={requestGPSLocation} disabled={isProcessing} style={{ padding: '1.2rem' }}>
                    {isProcessing ? <Loader2 className="animate-spin" /> : <Navigation size={20} />}
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600 }}>{lang === 'kn' ? 'ಪ್ರಸ್ತುತ GPS ಬಳಸಿ' : 'Use Current GPS'}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{lang === 'kn' ? 'ನಿಮ್ಮ ಮೊಬೈಲ್‌ನ ನಿಖರ ಸ್ಥಳ' : 'Precise location from your device'}</div>
                    </div>
                  </button>
                  <button className="btn-secondary" onClick={() => setLocationMode('manual')} style={{ padding: '1.2rem', justifyContent: 'flex-start', gap: '15px' }}>
                    <Edit2 size={20} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600 }}>{lang === 'kn' ? 'ಬೇರೆ ಸ್ಥಳ ಹುಡುಕಿ' : 'Search for a Location'}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{lang === 'kn' ? 'ಕ್ಷೇತ್ರದ ಹೆಸರನ್ನು ನಮೂದಿಸಿ' : 'Enter city, village or area name'}</div>
                    </div>
                  </button>
                </div>
              </>
            )}

            {locationMode === 'manual' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                  <button onClick={() => setLocationMode('prompt')} className="btn-icon"><X size={16} style={{ transform: 'rotate(90deg)' }} /></button>
                  <h3>{lang === 'kn' ? 'ಸ್ಥಳ ಹುಡುಕಾಟ' : 'Location Search'}</h3>
                </div>
                
                <div className="search-box" style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                  <input 
                    type="text" 
                    placeholder={lang === 'kn' ? 'ಊರಿನ ಹೆಸರು...' : 'Search city or area...'}
                    value={locationQuery}
                    onChange={e => setLocationQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchManualLocation()}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                  />
                  <button className="btn-primary" onClick={searchManualLocation} disabled={isProcessing} style={{ padding: '0 15px' }}>
                    {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                  </button>
                </div>

                <div className="search-results" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {searchResults.map((res, idx) => (
                    <div 
                      key={idx} 
                      className="search-result-item" 
                      onClick={() => confirmSetActiveCrop({
                        name: res.display_name.split(',')[0] + (res.address ? (', ' + (res.address.city || res.address.town || res.address.state || '')) : ''),
                        lat: parseFloat(res.lat),
                        lon: parseFloat(res.lon)
                      })}
                      style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' }}
                    >
                      <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{res.display_name}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Crop Selector Grid */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            {lang === 'kn' ? '🌾 ಬೆಳೆ ಆಯ್ಕೆಮಾಡಿ' : '🌾 Select/Create Crop'}
          </h2>
          <button className="btn-add-crop" onClick={() => setShowCreator(true)}>
            <Plus size={18} /> {lang === 'kn' ? 'ಹೊಸ ಬೆಳೆ' : 'New Crop'}
          </button>
        </div>

        <div className="crop-grid">
          {/* Built-in Crops */}
          {Object.values(BUILT_IN_CROPS).map(crop => (
            <div 
              key={crop.id}
              className={`crop-option ${activeCrop?.id === crop.id ? 'active' : ''}`}
              onClick={() => handleSetActiveCrop(crop.id)}
            >
              <span className="emoji">{crop.emoji}</span>
              <span className="label">{lang === 'kn' ? crop.name_kn : crop.name_en}</span>
              {activeCrop?.id === crop.id && <Check size={14} className="active-tick" />}
            </div>
          ))}

          {/* Custom Crops */}
          {customCrops.map(crop => (
            <div 
              key={crop.id}
              className={`crop-option custom ${activeCrop?.id === crop.id ? 'active' : ''}`}
              onClick={() => handleSetActiveCrop(crop.id)}
            >
              <span className="emoji">{crop.emoji}</span>
              <span className="label">{lang === 'kn' ? crop.name_kn : crop.name_en}</span>
              <button className="btn-delete-crop" onClick={(e) => deleteCustomCrop(crop.id, e)}>
                <Trash2 size={14} />
              </button>
              {activeCrop?.id === crop.id && <Check size={14} className="active-tick" />}
            </div>
          ))}
        </div>
      </section>

      {/* Custom Crop Creator Modal */}
      {showCreator && (
        <div className="modal-overlay">
          <div className="glass-card creator-modal">
            <button className="btn-close" onClick={() => setShowCreator(false)}><X size={18} /></button>
            <h2 className="section-title">{lang === 'kn' ? 'ಹೊಸ ಬೆಳೆ ವ್ಯಾಖ್ಯಾನಿಸಿ' : 'Define Custom Crop Profile'}</h2>
            
            <div className="form-grid">
              <div className="form-group">
                <label>English Name</label>
                <input 
                  type="text" 
                  value={newCrop.name_en}
                  onChange={e => setNewCrop({...newCrop, name_en: e.target.value})}
                  placeholder="e.g. Cotton"
                />
              </div>
              <div className="form-group">
                <label>ಕನ್ನಡ ಹೆಸರು</label>
                <input 
                  type="text" 
                  value={newCrop.name_kn}
                  onChange={e => setNewCrop({...newCrop, name_kn: e.target.value})}
                  placeholder="ಉದಾ: ಹತ್ತಿ"
                />
              </div>
              <div className="form-group">
                <label>Emoji</label>
                <input 
                  type="text" 
                  value={newCrop.emoji}
                  onChange={e => setNewCrop({...newCrop, emoji: e.target.value})}
                  maxLength="2"
                />
              </div>
            </div>

            <div className="thresholds-editor">
              <h3>{lang === 'kn' ? 'ಅತ್ಯುತ್ತಮ ಶ್ರೇಣಿಗಳು (Optimal Ranges)' : 'Thresholds & Optimal Ranges'}</h3>
              
              <div className="threshold-item">
                <label>{lang === 'kn' ? 'ಮಣ್ಣಿನ ತೇವಾಂಶ (%)' : 'Soil Moisture (%)'}</label>
                <div className="range-inputs">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Min: {newCrop.thresholds.soilMoisture.optimal_min}%</span>
                    <span>Max: {newCrop.thresholds.soilMoisture.optimal_max}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" 
                    value={newCrop.thresholds.soilMoisture.optimal_min}
                    onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, soilMoisture: {...newCrop.thresholds.soilMoisture, optimal_min: parseInt(e.target.value)}}})}
                  />
                  <input 
                    type="range" min="0" max="100" 
                    value={newCrop.thresholds.soilMoisture.optimal_max}
                    onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, soilMoisture: {...newCrop.thresholds.soilMoisture, optimal_max: parseInt(e.target.value)}}})}
                  />
                </div>
              </div>

              <div className="threshold-item">
                <label>{lang === 'kn' ? 'ಪೋಷಕಾಂಶಗಳು (NPK)' : 'Nutrients (NPK)'}</label>
                <div className="range-inputs">
                  <span>Target Min: {newCrop.thresholds.nutrients.optimal_min}</span>
                  <input 
                    type="range" min="0" max="100" 
                    value={newCrop.thresholds.nutrients.optimal_min}
                    onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, nutrients: {...newCrop.thresholds.nutrients, optimal_min: parseInt(e.target.value)}}})}
                  />
                </div>
              </div>

              <div className="threshold-item">
                <label>{lang === 'kn' ? 'ತಾಪಮಾನ (°C)' : 'Temperature (°C)'}</label>
                <div className="range-inputs">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Min: {newCrop.thresholds.temperature.optimal_min}°C</span>
                    <span>Max: {newCrop.thresholds.temperature.optimal_max}°C</span>
                  </div>
                  <input 
                    type="range" min="0" max="50" 
                    value={newCrop.thresholds.temperature.optimal_min}
                    onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, temperature: {...newCrop.thresholds.temperature, optimal_min: parseInt(e.target.value)}}})}
                  />
                  <input 
                    type="range" min="0" max="50" 
                    value={newCrop.thresholds.temperature.optimal_max}
                    onChange={e => setNewCrop({...newCrop, thresholds: {...newCrop.thresholds, temperature: {...newCrop.thresholds.temperature, optimal_max: parseInt(e.target.value)}}})}
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={saveCustomCrop} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin" /> : (lang === 'kn' ? 'ಉಳಿಸಿ' : 'Save Crop Profile')}
              </button>
              <button className="btn-secondary" onClick={() => setShowCreator(false)} disabled={isProcessing}>
                {lang === 'kn' ? 'ರದ್ದುಮಾಡಿ' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CropManager;
