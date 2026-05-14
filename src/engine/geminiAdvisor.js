// src/engine/geminiAdvisor.js

/**
 * Common function to call our Netlify Backend for Gemini AI
 */
export async function callGeminiAPI(prompt, imageData = null) {
  const contents = [{
    parts: [{ text: prompt }]
  }];

  if (imageData) {
    const mimeType = imageData.match(/data:(image\/[a-zA-Z*]+);base64/)?.[1] || "image/jpeg";
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    contents[0].parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Data
      }
    });
  }

  const payload = {
    contents,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };

  try {
    // 1. Pre-flight check: Image size (Netlify limit is ~6MB total request)
    if (imageData && imageData.length > 5 * 1024 * 1024) {
      return "The image is too large. Please use a photo smaller than 5MB.";
    }

    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // 2. Safe Parsing (Prevents "Unexpected end of JSON input")
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Malformed server response:", text);
      return `Connection error: Server returned an invalid response (Status ${response.status}).`;
    }

    if (!response.ok) {
      // Handle known error formats from our Netlify function
      const msg = data.error?.message || 'The AI service is currently busy or unavailable.';
      return `AI Error (${response.status}): ${msg}`;
    }

    if (data.text) {
      return data.text;
    } else if (data.error === "SAFETY_BLOCKED") {
      return "AI analysis was blocked by safety filters. Try a clearer image or a different farming query.";
    } else if (data.error === "PROMPT_BLOCKED") {
      return `AI Blocked: ${data.reason || 'Restricted content'}`;
    } else {
      return "AI returned an unexpected response. Please try again.";
    }
  } catch (e) {
    console.error("Gemini connection error:", e);
    return `Connection failed: ${e.message}. Please check your internet.`;
  }
}

import { getCurrentStage } from './adviceEngine';

/**
 * AI function to generate a scientific crop profile for new plants
 */
export async function generateCropProfile(cropName, lang) {
  const prompt = `
    You are a professional agricultural scientist. Create a detailed growth profile for the plant: "${cropName}".
    Return the response ONLY as a clean JSON object with this exact structure:
    {
      "name_en": "Common English Name",
      "name_kn": "Common Kannada Name",
      "emoji": "🌱",
      "lifecycle": [
        { "stage": "Seedling", "days": 20, "thresholds": { "soilMoisture": { "low": 40, "optimal_min": 55, "optimal_max": 70, "high": 85 }, "nutrients": { "low": 30, "optimal_min": 50 } } },
        { "stage": "Vegetative", "days": 35, "thresholds": { "soilMoisture": { "low": 50, "optimal_min": 65, "optimal_max": 80, "high": 90 }, "nutrients": { "low": 45, "optimal_min": 65 } } },
        { "stage": "Flowering/Fruiting", "days": 30, "thresholds": { "soilMoisture": { "low": 55, "optimal_min": 70, "optimal_max": 85, "high": 95 }, "nutrients": { "low": 50, "optimal_min": 75 } } }
      ],
      "thresholds": {
        "soilMoisture": { "low": 40, "optimal_min": 60, "optimal_max": 80, "high": 90 },
        "nutrients": { "low": 35, "optimal_min": 55, "optimal_max": 75, "high": 95 },
        "temperature": { "low": 15, "optimal_min": 22, "optimal_max": 30, "high": 38 }
      }
    }
    Base the thresholds on scientific data for this specific plant. Ensure the Kannada name is accurate.
  `;

  const result = await callGeminiAPI(prompt);
  try {
    const jsonStr = result.includes('```json') 
      ? result.split('```json')[1].split('```')[0] 
      : result.includes('```') 
        ? result.split('```')[1].split('```')[0]
        : result;
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse AI crop profile:", result);
    return null;
  }
}

/**
 * Specialized advisor for active crop monitoring
 */
export async function fetchFieldAdvice(crop, moisture, nutrients, temperature, weather, lang) {
  const stageInfo = getCurrentStage(crop, crop.plantingDate);
  const stageContext = stageInfo 
    ? `The crop is currently in the ${stageInfo.stage} stage (Day ${stageInfo.daysPassed} of growth).` 
    : '';

  const prompt = `
    You are an expert agronomist advisor. A farmer is growing ${lang === 'kn' ? crop.name_kn : crop.name_en}.
    ${stageContext}
    
    Current field sensor readings:
    - Soil Moisture: ${moisture}% (Target for this stage: ${stageInfo?.thresholds?.soilMoisture?.optimal_min || crop.thresholds.soilMoisture.optimal_min}% to ${stageInfo?.thresholds?.soilMoisture?.optimal_max || crop.thresholds.soilMoisture.optimal_max}%)
    - Nutrient Level (NPK): ${nutrients}/100 (Target for this stage: ${stageInfo?.thresholds?.nutrients?.optimal_min || crop.thresholds.nutrients.optimal_min})
    - Temperature: ${temperature}°C
    - Local Weather Condition: ${weather}

    Provide professional, practical, and highly specific advice for this farmer in ${lang === 'kn' ? 'Kannada' : 'English'}. 
    Focus on immediate actions needed within the next 48 hours to optimize yield for this specific growth stage.
    Keep the response under 100 words and do not repeat the raw sensor numbers unless providing a corrective target.
  `;

  return await callGeminiAPI(prompt);
}
