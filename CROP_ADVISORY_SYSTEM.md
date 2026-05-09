# 🌾 Smart Farming Assistant — Dynamic Crop Advisory & Field Management System
## Implementation Plan: Dynamic Crops, Custom Definitions, and Gemini AI

---

> ### 📋 Project Overview & Core Requirements
> 1. **Active Field Crop Lifecycle**: The farmer can set which crop is currently being grown on their field. This active state persists. Once the yield is harvested, they can "Harvest/Reset" the field and start a new crop cycle.
> 2. **Custom Crop Definition**: Farmers can define their own unique crops (with custom moisture, nutrient, and temperature thresholds) which are saved and persisted to Firestore under their user account.
> 3. **Live Gemini AI Integration**: Seamlessly utilizes the confirmed `VITE_GEMINI_API_KEY` to provide natural language, professional agronomist advice alongside rule-based severity alerts.

---

```
                                  ┌───────────────────────────┐
                                  │   Firestore Database      │
                                  │  - User Active Crop       │
                                  │  - User Custom Crops      │
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
┌────────────────────────┐        ┌───────────────────────────┐        ┌─────────────────────────┐
│   CROP SELECTION UI    │───────►│    ADVICE GENERATOR       │◄───────│      SENSORS & GPS      │
│  - Select Built-in     │        │  - Deterministic Rules    │        │  - Moisture, Temp, NPK  │
│  - Define Custom Crop  │        │  - Gemini Flash AI        │        │  - Live Weather & Wind  │
└────────────────────────┘        └─────────────┬─────────────┘        └─────────────────────────┘
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │   DYNAMIC ADVICE CARDS    │
                                  │   & AUDIO TEXT-TO-SPEECH  │
                                  └───────────────────────────┘
```

---

## 📅 Phase 1 — Firestore Database Schema & Field State

Since the user's login state is already handled by Google Auth, we will store active field records and custom crops in Firestore under each user's UID.

### Firestore Collections Structure

```
users/
  └── {userId}/ (User Document)
        ├── activeCropId: "maize" (or "custom_rose_123")
        ├── plantingDate: Timestamp
        └── customCrops/ (Sub-collection)
              └── {cropId}/
                    ├── id: "custom_rose_123"
                    ├── name_en: "Rose"
                    ├── name_kn: "ಗುಲಾಬಿ"
                    ├── emoji: "🌹"
                    └── thresholds:
                          ├── soilMoisture: { low: 30, high: 70 }
                          ├── nutrients: { low: 40, high: 80 }
                          └── temperature: { low: 15, high: 35 }
```

---

## 🌾 Phase 2 — Built-In & Custom Crop Profiles

**File to Create:** `src/data/cropProfiles.js`

This file houses built-in crop thresholds and exports helpers to merge built-in crops with a user's custom Firestore crops.

```js
// src/data/cropProfiles.js

export const BUILT_IN_CROPS = {
  maize: {
    id: 'maize',
    name_en: 'Maize (Corn)',
    name_kn: 'ಮೆಕ್ಕೆಜೋಳ',
    emoji: '🌽',
    thresholds: {
      soilMoisture: { low: 40, optimal_min: 55, optimal_max: 75, high: 85 },
      nutrients:    { low: 35, optimal_min: 50, optimal_max: 70, high: 90 },
      temperature:  { low: 10, optimal_min: 21, optimal_max: 30, high: 38 },
    },
    weatherTips: {
      rainy_en: 'Maize is susceptible to lodging. Ensure field drainage.',
      rainy_kn: 'ಮಳೆಯಲ್ಲಿ ಮೆಕ್ಕೆಜೋಳ ಬೀಳುವ ಸಾಧ್ಯತೆ ಇದೆ. ತಕ್ಷಣ ನೀರು ಹರಿಯುವ ವ್ಯವಸ್ಥೆ ಮಾಡಿ.',
      sunny_en: 'Good sunshine benefits grain fill. Ensure adequate root zone moisture.',
      sunny_kn: 'ಒಳ್ಳೆ ಬಿಸಿಲು ಧಾನ್ಯ ತುಂಬಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ. ತೇವ ಸಾಕಷ್ಟು ಇರಲಿ.'
    }
  },
  rice: {
    id: 'rice',
    name_en: 'Rice (Paddy)',
    name_kn: 'ಭತ್ತ',
    emoji: '🌾',
    thresholds: {
      soilMoisture: { low: 60, optimal_min: 70, optimal_max: 90, high: 95 },
      nutrients:    { low: 40, optimal_min: 60, optimal_max: 80, high: 95 },
      temperature:  { low: 18, optimal_min: 22, optimal_max: 32, high: 38 },
    }
  }
  // Additional crops: tomato, beans, sugarcane, ragi, groundnut, banana
};
```

---

## 🎛️ Phase 3 — Hybrid Advice Engine (Deterministic + Gemini AI)

**Files to Create:**
1. `src/engine/adviceEngine.js` (For fast, offline-ready rule alerts)
2. `src/engine/geminiAdvisor.js` (For deep natural language crop-aware insights)

### 1. Deterministic Engine (`src/engine/adviceEngine.js`)
Analyzes soil sensors against the selected crop thresholds instantly.

```js
export function generateRuleAdvice(crop, moisture, nutrients, temperature, weather, lang) {
  const t = crop.thresholds;
  const L = lang;
  const alerts = [];

  // Moisture Alert
  if (moisture < t.soilMoisture.low) {
    alerts.push({ type: 'irrigation', severity: 'critical', text: L === 'en' ? 'Soil is too dry. Irrigate immediately.' : 'ಮಣ್ಣು ಒಣಗಿದೆ. ತಕ್ಷಣ ನೀರು ಉಣಿಸಿ.' });
  } else if (moisture > t.soilMoisture.high) {
    alerts.push({ type: 'irrigation', severity: 'warning', text: L === 'en' ? 'Waterlogging danger. Stop irrigation.' : 'ಹೆಚ್ಚು ನೀರು ನಿಂತಿದೆ. ನೀರಾವರಿ ನಿಲ್ಲಿಸಿ.' });
  } else {
    alerts.push({ type: 'irrigation', severity: 'ok', text: L === 'en' ? 'Moisture level is optimal.' : 'ಮಣ್ಣಿನ ತೇವಾಂಶ ಅತ್ಯುತ್ತಮವಾಗಿದೆ.' });
  }

  // Similar checks for Nutrients and Temperature...
  return alerts;
}
```

### 2. Gemini AI Engine (`src/engine/geminiAdvisor.js`)
Takes the live thresholds and readings to compose a professional agronomic recommendation.

```js
export async function fetchGeminiAdvice(crop, moisture, nutrients, temperature, weather, lang) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `
    You are an expert agronomist. A farmer is growing ${lang === 'kn' ? crop.name_kn : crop.name_en}.
    Current readings:
    - Moisture: ${moisture}% (Target: ${crop.thresholds.soilMoisture.optimal_min}-${crop.thresholds.soilMoisture.optimal_max}%)
    - Nutrients: ${nutrients}/100
    - Temp: ${temperature}°C
    - Local Weather: ${weather}

    Provide professional advice in ${lang === 'kn' ? 'Kannada' : 'English'}. Keep it under 100 words.
    Focus on immediate actions for the next 48 hours. Do not repeat the raw sensor numbers.
  `;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Gemini advice failed:", error);
    return null;
  }
}
```

---

## 🖥️ Phase 4 — UI Field Management & Custom Crop Creator

**File to Create:** `src/components/CropManager.jsx`

Provides a highly polished control panel where farmers manage their current crop cycle and define custom parameters.

### 1. Active Field State (Empty State)
If the farmer has no crop selected:
> *"No crop is currently planted on your field. Select a crop below or create a custom crop profile to begin monitoring."*

### 2. Active Field State (Planted)
Once selected, displays the Active Crop, planting date, and a prominent **"Harvest Crop / End Season"** button. Clicking this clears the active state in Firestore and resets the field for a new crop.

### 3. Custom Crop Form
Allows the farmer to save custom thresholds:
* Crop Name (English & Kannada)
* Emoji picker
* Sliders for Moisture target limits, Temperature targets, and Nutrients.

---

## 🛠️ Phase 5 — Wiring Components in `App.jsx`

We update `App.jsx` to load and bind these elements:
1. On login, retrieve user document `activeCropId` and sub-collection `customCrops`.
2. Compute fast rule-based alerts immediately when sensor sliders change.
3. Fetch dynamic Gemini advice when the farmer clicks "Analyse Field".
4. Support audio playback (Text-to-Speech) for both the rule summaries and the Gemini advice.

---

## 🚀 Summary: Implementation Steps
1. **Database Connection**: Create collections and link user state with Firestore.
2. **Crop Profiles & Selector**: Write `cropProfiles.js` and build the grid incorporating custom Firestore entries.
3. **Analytics Integration**: Wire `geminiAdvisor.js` using the configured API key.
4. **UI Refinements**: Implement `CropManager.jsx` containing active crop statuses, custom creation inputs, and harvest lifecycles.

**For your project, your current hardcoded dictionary system is actually the best foundation for the core UI!

When we implement the Dynamic Crop Advisory System, we will keep the UI buttons fast and free using your dictionary, but we will use Gemini to translate and write the complex, dynamic agricultural advice on the fly. This keeps your app lightning-fast while giving you infinite flexibility for crop recommendations!u


  1. Switched to the Stable API (v1)
  The main issue was that the standard Gemini Software Library (SDK) was automatically trying to use a version called v1beta.
  In many regions and for certain API keys, this version returns a 404 Not Found error because it's considered experimental.
   * What I did: I bypassed the library and wrote a direct "handshake" to Google's stable v1 endpoint. This version is much
     more reliable and widely available.

  2. Cleaned the "Invisible" Character in .env
  I noticed your .env file had a small typo: an extra . (dot) on a new line right after your API key. 
   * The Problem: Computers often read that dot as part of the key. Even a single extra space or dot will make the entire key
     invalid, but it's hard to see with the human eye. 
   * What I did: I cleaned the file and added code that automatically "trims" the key (removes accidental spaces) before
     sending it to Google.

  3. Adjusted Safety & Model Logic
  Google’s AI has very strict "Safety Filters" by default. Sometimes, words like "infected" or "disease" (which are necessary
  for your farming app) can trigger a false alarm, causing the AI to return an empty response.
   * What I did: I adjusted the settings to tell the AI, "We are doing agricultural analysis, so it is okay to talk about
     leaf infections and diseases."

  Essentially, I stopped the app from taking a "short-cut" that was broken and built a manual, more stable bridge directly to
  Google's servers.
