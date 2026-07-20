// src/engine/adviceEngine.js

// src/engine/adviceEngine.js

/**
 * Calculates the current growth stage based on planting date and lifecycle data
 */
export function getCurrentStage(crop, plantingDate) {
  if (!crop || !Array.isArray(crop.lifecycle) || crop.lifecycle.length === 0 || !plantingDate) return null;
  
  const start = new Date(plantingDate);
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
  
  let accumulatedDays = 0;
  for (const phase of crop.lifecycle) {
    accumulatedDays += Number(phase.days) || 0;
    if (diffDays <= accumulatedDays) {
      return { ...phase, daysPassed: diffDays };
    }
  }
  
  return { ...crop.lifecycle[crop.lifecycle.length - 1], daysPassed: diffDays, isOverdue: true };
}

export function generateRuleAdvice(crop, moisture, nutrients, temperature, weather, lang) {
  if (!crop || !crop.thresholds) return [];
  
  // Use stage-specific thresholds if available
  const currentStage = getCurrentStage(crop, crop.plantingDate);
  const stageThresholds = currentStage?.thresholds;
  
  const defaultMoisture = { low: 30, optimal_min: 50, optimal_max: 75, high: 85 };
  const defaultNutrients = { low: 30, optimal_min: 50, optimal_max: 75, high: 90 };
  const defaultTemp = { low: 10, optimal_min: 20, optimal_max: 30, high: 40 };

  const t = {
    soilMoisture: { ...defaultMoisture, ...(stageThresholds?.soilMoisture || crop.thresholds.soilMoisture || {}) },
    nutrients: { ...defaultNutrients, ...(stageThresholds?.nutrients || crop.thresholds.nutrients || {}) },
    temperature: { ...defaultTemp, ...(crop.thresholds.temperature || {}) }
  };

  const L = lang;
  const alerts = [];

  // Stage Info (Informational)
  if (currentStage) {
    alerts.push({
      type: 'stage',
      severity: 'info',
      text: L === 'en' 
        ? `Crop is in ${currentStage.stage} stage (Day ${currentStage.daysPassed}).` 
        : `ಬೆಳೆಯು ${currentStage.stage} ಹಂತದಲ್ಲಿದೆ (ದಿನ ${currentStage.daysPassed}).`
    });
  }

  // Moisture Alert
  if (moisture < t.soilMoisture.low) {
    alerts.push({ 
      type: 'moisture', 
      severity: 'critical', 
      text: L === 'en' ? 'Soil is critically dry. Irrigate immediately.' : 'ಮಣ್ಣು ಗಂಭೀರವಾಗಿ ಒಣಗಿದೆ. ತಕ್ಷಣ ನೀರು ಉಣಿಸಿ.' 
    });
  } else if (moisture < t.soilMoisture.optimal_min) {
    alerts.push({ 
      type: 'moisture', 
      severity: 'warning', 
      text: L === 'en' ? 'Soil moisture is low. Consider watering.' : 'ಮಣ್ಣಿನ ತೇವಾಂಶ ಕಡಿಮೆ ಇದೆ. ನೀರು ಹಾಕುವುದನ್ನು ಪರಿಗಣಿಸಿ.' 
    });
  } else if (moisture > t.soilMoisture.high) {
    alerts.push({ 
      type: 'moisture', 
      severity: 'critical', 
      text: L === 'en' ? 'Critical waterlogging danger. Stop all irrigation.' : 'ನೀರು ನಿಲ್ಲುವ ಗಂಭೀರ ಅಪಾಯವಿದೆ. ಎಲ್ಲಾ ನೀರಾವರಿ ನಿಲ್ಲಿಸಿ.' 
    });
  } else if (moisture > t.soilMoisture.optimal_max) {
    alerts.push({ 
      type: 'moisture', 
      severity: 'warning', 
      text: L === 'en' ? 'Soil is very wet. Monitor drainage.' : 'ಮಣ್ಣು ತುಂಬಾ ತೇವವಾಗಿದೆ. ಒಳಚರಂಡಿಯನ್ನು ಗಮನಿಸಿ.' 
    });
  } else {
    alerts.push({ 
      type: 'moisture', 
      severity: 'ok', 
      text: L === 'en' ? 'Moisture level is optimal for this stage.' : 'ಈ ಹಂತಕ್ಕೆ ತೇವಾಂಶದ ಮಟ್ಟವು ಅತ್ಯುತ್ತಮವಾಗಿದೆ.' 
    });
  }

  // Nutrients Alert
  if (nutrients < t.nutrients.low) {
    alerts.push({ 
      type: 'nutrients', 
      severity: 'critical', 
      text: L === 'en' ? 'Nutrients are critically low. Apply immediate fertilization.' : 'ಪೋಷಕಾಂಶಗಳು ಗಂಭೀರವಾಗಿ ಕಡಿಮೆಯಾಗಿವೆ. ತಕ್ಷಣ ಗೊಬ್ಬರ ಹಾಕಿ.' 
    });
  } else if (nutrients < t.nutrients.optimal_min) {
    alerts.push({ 
      type: 'nutrients', 
      severity: 'warning', 
      text: L === 'en' ? 'Nutrient levels are declining. Plan for fertilization.' : 'ಪೋಷಕಾಂಶಗಳ ಮಟ್ಟ ಕುಸಿಯುತ್ತಿದೆ. ಗೊಬ್ಬರ ಹಾಕಲು ಯೋಜಿಸಿ.' 
    });
  } else {
    alerts.push({ 
      type: 'nutrients', 
      severity: 'ok', 
      text: L === 'en' ? 'Soil nutrients are sufficient for current needs.' : 'ಪ್ರಸ್ತುತ ಅಗತ್ಯಗಳಿಗೆ ಮಣ್ಣಿನ ಪೋಷಕಾಂಶಗಳು ಸಮರ್ಪಕವಾಗಿವೆ.' 
    });
  }

  // Temperature Alert
  if (temperature < t.temperature.low) {
    alerts.push({ 
      type: 'temperature', 
      severity: 'critical', 
      text: L === 'en' ? 'Temperature is too low for this crop. Provide protection if possible.' : 'ಈ ಬೆಳೆಗೆ ತಾಪಮಾನ ತುಂಬಾ ಕಡಿಮೆಯಿದೆ. ಸಾಧ್ಯವಾದರೆ ರಕ್ಷಣೆ ನೀಡಿ.' 
    });
  } else if (temperature > t.temperature.high) {
    alerts.push({ 
      type: 'temperature', 
      severity: 'critical', 
      text: L === 'en' ? 'Extreme heat stress detected. Increase irrigation frequency.' : 'ತೀವ್ರ ಶಾಖದ ಒತ್ತಡ ಕಂಡುಬಂದಿದೆ. ನೀರಾವರಿ ಆವರ್ತನವನ್ನು ಹೆಚ್ಚಿಸಿ.' 
    });
  } else if (temperature < t.temperature.optimal_min || temperature > t.temperature.optimal_max) {
    alerts.push({ 
      type: 'temperature', 
      severity: 'warning', 
      text: L === 'en' ? 'Temperature is outside the optimal range.' : 'ತಾಪಮಾನವು ಅತ್ಯುತ್ತಮ ಶ್ರೇಣಿಯ ಹೊರಗಿದೆ.' 
    });
  } else {
    alerts.push({ 
      type: 'temperature', 
      severity: 'ok', 
      text: L === 'en' ? 'Temperature is ideal for healthy growth.' : 'ತಾಪಮಾನವು ಆರೋಗ್ಯಕರ ಬೆಳವಣಿಗೆಗೆ ಸೂಕ್ತವಾಗಿದೆ.' 
    });
  }

  return alerts;
}

