// src/engine/geminiAdvisor.js

/**
 * Common function to call our Netlify Backend for Gemini AI
 */
export async function callGeminiAPI(prompt, imageData = null, tools = null) {
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
    ...(tools ? { tools } : {}),
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
      console.error("Malformed server response:", parseError, text);
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
export async function generateCropProfile(cropName, variety = '', soilType = '', lang = 'en') {
  const varietyContext = variety ? `Variety/Cultivar: "${variety}". ` : '';
  const soilContext = soilType ? `Soil Type: "${soilType}". ` : '';

  const prompt = `
    You are a senior agricultural scientist at FAO and ICAR. Create a scientifically accurate crop growth profile for: "${cropName}".
    ${varietyContext}${soilContext}
    Return the response ONLY as a clean JSON object with this exact structure:
    {
      "name_en": "Common English Name",
      "name_kn": "Common Kannada Name",
      "emoji": "🍎",
      "variety": "${variety || 'Standard'}",
      "soilType": "${soilType || 'Loam'}",
      "lifecycle": [
        { "stage": "Bud Break / Germination", "days": 20, "thresholds": { "soilMoisture": { "low": 40, "optimal_min": 55, "optimal_max": 70, "high": 85 }, "nutrients": { "low": 30, "optimal_min": 50 } } },
        { "stage": "Vegetative / Leafing", "days": 35, "thresholds": { "soilMoisture": { "low": 50, "optimal_min": 65, "optimal_max": 80, "high": 90 }, "nutrients": { "low": 45, "optimal_min": 65 } } },
        { "stage": "Flowering & Pollination", "days": 25, "thresholds": { "soilMoisture": { "low": 55, "optimal_min": 70, "optimal_max": 85, "high": 95 }, "nutrients": { "low": 50, "optimal_min": 75 } } },
        { "stage": "Fruit Development & Ripening", "days": 60, "thresholds": { "soilMoisture": { "low": 50, "optimal_min": 60, "optimal_max": 75, "high": 85 }, "nutrients": { "low": 40, "optimal_min": 60 } } }
      ],
      "thresholds": {
        "soilMoisture": { "low": 40, "optimal_min": 60, "optimal_max": 80, "high": 90 },
        "nutrients": { "low": 35, "optimal_min": 55, "optimal_max": 75, "high": 95 },
        "temperature": { "low": 15, "optimal_min": 22, "optimal_max": 30, "high": 38 }
      }
    }

    IMPORTANT ACCURACY RULES (FAO-56 & ICAR GROUNDING):
    1. Base stage days strictly on active growing days until harvest for "${cropName}" (${variety || 'standard variety'}), excluding winter dormancy.
    2. Adjust optimal moisture and temperature ranges according to ${soilType || 'loamy'} soil water holding capacity.
    3. Include 3 to 5 realistic growth stages matching FAO-56 crop coefficient stages.
    4. Ensure the Kannada name is accurate (user language: ${lang}).
  `;

  let result = await callGeminiAPI(prompt, null, [{ googleSearch: {} }]);
  
  // If Search Grounding encounters quota limits (429) or tool restriction, retry with standard generation
  if (!result || typeof result !== 'string' || result.startsWith('AI Error') || result.startsWith('Connection') || result.includes('quota') || result.includes('RESOURCE_EXHAUSTED')) {
    console.warn("Search Grounding rate limited or unavailable, retrying standard generation...");
    result = await callGeminiAPI(prompt);
  }

  if (!result || typeof result !== 'string' || result.startsWith('AI Error') || result.startsWith('Connection')) {
    console.error("AI Generation Error or Invalid Result:", result);
    return null;
  }

  try {
    const startIdx = result.indexOf('{');
    const endIdx = result.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("No JSON object found in AI response");
    }
    
    const jsonStr = result.substring(startIdx, endIdx + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse AI crop profile. Error:", e.message, "Full result:", result);
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
