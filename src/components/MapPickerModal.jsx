import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, MapPin, Loader2, Navigation, Search } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet marker icon URLs
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MapPickerModal = ({ isOpen, onClose, onConfirm, initialCoords, lang = 'en' }) => {
  const [selectedCoords, setSelectedCoords] = useState(
    initialCoords || { lat: 12.9716, lon: 77.5946 }
  );
  const [locationName, setLocationName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const googleMapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const leafletMarkerRef = useRef(null);
  const googleMarkerRef = useRef(null);
  const mapContainerRef = useRef(null);

  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Reverse geocode coordinates to location name
  const reverseGeocode = useCallback(async (lat, lon) => {
    setIsGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        const name = address.village || address.suburb || address.town || address.city || address.county || data.display_name?.split(',')[0] || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        setLocationName(name);
      } else {
        setLocationName(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      }
    } catch (e) {
      console.warn("Reverse geocode failed:", e);
      setLocationName(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // Jump to Pincode or Area Name
  const handleSearchLocality = async () => {
    if (!searchQuery?.trim()) return;
    setIsSearching(true);
    try {
      const query = encodeURIComponent(searchQuery.trim());
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&q=${query}`);
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const first = results[0];
          const lat = parseFloat(first.lat);
          const lon = parseFloat(first.lon);
          setSelectedCoords({ lat, lon });
          setLocationName(first.display_name?.split(',')[0] || searchQuery);

          if (leafletMapRef.current) {
            leafletMapRef.current.setView([lat, lon], 15);
            if (leafletMarkerRef.current) leafletMarkerRef.current.setLatLng([lat, lon]);
          }
          if (googleMapRef.current) {
            googleMapRef.current.setCenter({ lat, lng: lon });
            if (googleMarkerRef.current) googleMarkerRef.current.setPosition({ lat, lng: lon });
          }
        } else {
          alert(lang === 'kn' ? "ಸ್ಥಳ ಸಿಗಲಿಲ್ಲ, ದಯವಿಟ್ಟು ಪಿನ್‌ಕೋಡ್ ಅಥವಾ ಸರಿಯಾದ ಹೆಸರನ್ನು ನಮೂದಿಸಿ." : "Location not found. Please check pincode or area name.");
        }
      }
    } catch (e) {
      console.error("Locality search failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;
    if (googleApiKey && window.google?.maps) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current).setView([selectedCoords.lat, selectedCoords.lon], 13);
      leafletMapRef.current = map;

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri Satellite Imagery'
      }).addTo(map);

      const marker = L.marker([selectedCoords.lat, selectedCoords.lon], { draggable: true }).addTo(map);
      leafletMarkerRef.current = marker;

      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        setSelectedCoords({ lat: pos.lat, lon: pos.lng });
        reverseGeocode(pos.lat, pos.lng);
      });

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setSelectedCoords({ lat, lon: lng });
        marker.setLatLng([lat, lng]);
        reverseGeocode(lat, lng);
      });

      reverseGeocode(selectedCoords.lat, selectedCoords.lon);
    } else {
      leafletMapRef.current.setView([selectedCoords.lat, selectedCoords.lon], 13);
      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng([selectedCoords.lat, selectedCoords.lon]);
      }
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [isOpen, googleApiKey, reverseGeocode, selectedCoords.lat, selectedCoords.lon]);

  // Load Google Maps API dynamically if key is available
  useEffect(() => {
    if (!isOpen || !googleApiKey) return;

    const initGoogleMap = () => {
      if (!mapContainerRef.current || !window.google?.maps) return;

      const latLng = { lat: Number(selectedCoords.lat), lng: Number(selectedCoords.lon) };
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: latLng,
        zoom: 15,
        mapTypeId: window.google.maps.MapTypeId.HYBRID,
        streetViewControl: false,
        mapTypeControl: true
      });
      googleMapRef.current = map;

      const marker = new window.google.maps.Marker({
        position: latLng,
        map: map,
        draggable: true,
        title: 'Field Location'
      });
      googleMarkerRef.current = marker;

      marker.addListener('dragend', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setSelectedCoords({ lat, lon: lng });
        reverseGeocode(lat, lng);
      });

      map.addListener('click', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setSelectedCoords({ lat, lon: lng });
        marker.setPosition({ lat, lng });
        reverseGeocode(lat, lng);
      });

      reverseGeocode(selectedCoords.lat, selectedCoords.lon);
    };

    if (window.google?.maps) {
      initGoogleMap();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places`;
    script.async = true;
    script.onload = () => initGoogleMap();
    document.head.appendChild(script);

  }, [isOpen, googleApiKey, reverseGeocode, selectedCoords.lat, selectedCoords.lon]);

  // Current Device Location
  const handleUseGPS = () => {
    if (!navigator.geolocation) return;
    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setSelectedCoords({ lat, lon });
        
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([lat, lon], 15);
          if (leafletMarkerRef.current) leafletMarkerRef.current.setLatLng([lat, lon]);
        }
        if (googleMapRef.current) {
          googleMapRef.current.setCenter({ lat, lng: lon });
          if (googleMarkerRef.current) googleMarkerRef.current.setPosition({ lat, lng: lon });
        }
        reverseGeocode(lat, lon);
      },
      (err) => {
        console.error("GPS detection failed:", err);
        setIsGeocoding(false);
      }
    );
  };

  const handleConfirm = () => {
    onConfirm({
      name: locationName || `${selectedCoords.lat.toFixed(4)}, ${selectedCoords.lon.toFixed(4)}`,
      lat: selectedCoords.lat,
      lon: selectedCoords.lon
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="glass-card map-picker-modal" style={{ width: '90%', maxWidth: '650px', padding: '1.25rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: 'white' }}>
            <MapPin size={20} className="text-primary" />
            {lang === 'kn' ? 'ಕ್ಷೇತ್ರದ ಸ್ಥಳ ಆಯ್ಕೆಮಾಡಿ (Map Picker)' : 'Select Plot Location on Map'}
          </h3>
          <button className="btn-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Pincode & Area Jump Search Bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '0.85rem' }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchLocality()}
              placeholder={lang === 'kn' ? "ಪಿನ್‌ಕೋಡ್ (ಉದಾ: 571401) ಅಥವಾ ಏರಿಯಾ ಹೆಸರು..." : "Enter Pincode (e.g. 571401) or Area/Village..."}
              style={{
                width: '100%',
                paddingLeft: '38px',
                paddingRight: '12px',
                paddingTop: '0.65rem',
                paddingBottom: '0.65rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>
          <button 
            onClick={handleSearchLocality}
            disabled={isSearching || !searchQuery.trim()}
            className="btn-primary"
            style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            {isSearching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            {lang === 'kn' ? 'ಸ್ಥಳಕ್ಕೆ ಜಂಪ್ ಮಾಡಿ' : 'Jump to Area'}
          </button>
        </div>

        {/* Map Container */}
        <div 
          ref={mapContainerRef} 
          style={{ 
            height: '350px', 
            width: '100%', 
            borderRadius: '12px', 
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.15)',
            marginBottom: '1rem',
            position: 'relative',
            background: '#1a1a1a'
          }} 
        />

        {/* Selected Coordinates & Reverse Geocoded Name */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {lang === 'kn' ? 'ಆಯ್ಕೆಮಾಡಿದ ಸ್ಥಳ' : 'Selected Field Location'}
            </div>
            <strong style={{ fontSize: '0.95rem', color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isGeocoding ? <Loader2 className="animate-spin" size={14} /> : null}
              {locationName || `${selectedCoords.lat.toFixed(4)}, ${selectedCoords.lon.toFixed(4)}`}
            </strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Lat: {selectedCoords.lat.toFixed(5)}, Lon: {selectedCoords.lon.toFixed(5)}
            </div>
          </div>

          <button 
            onClick={handleUseGPS}
            className="btn-secondary"
            style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem' }}
          >
            <Navigation size={14} /> {lang === 'kn' ? 'ನನ್ನ GPS' : 'My GPS'}
          </button>
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={onClose} style={{ flex: '1', minWidth: '100px' }}>
            {lang === 'kn' ? 'ರದ್ದು' : 'Cancel'}
          </button>
          <button className="btn-primary" onClick={handleConfirm} style={{ flex: '2', minWidth: '160px' }}>
            <Check size={18} /> {lang === 'kn' ? 'ಸ್ಥಳ ದೃಢೀಕರಿಸಿ' : 'Confirm Location'}
          </button>
        </div>
      </div>
      <style>{`
        .map-picker-modal {
          max-height: 90vh;
          overflow-y: auto;
          box-sizing: border-box;
        }
        @media (max-width: 600px) {
          .map-picker-modal {
            padding: 1rem !important;
            width: 95% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default MapPickerModal;
