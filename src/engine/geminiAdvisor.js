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
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return `AI Error (${response.status}): ${data.error?.message || 'Server connection failed'}`;
    }

    if (data.text) {
      return data.text;
    } else if (data.error === "SAFETY_BLOCKED") {
      return "AI analysis was blocked by safety filters. Try a clearer image or different query.";
    } else if (data.error === "PROMPT_BLOCKED") {
      return `AI Blocked: ${data.reason}`;
    } else {
      return "AI returned an unexpected response. Please try again.";
    }
  } catch (e) {
    console.error("Gemini connection error:", e);
    return `Connection failed: ${e.message}. Please check your internet.`;
  }
}

/**
 * Specialized advisor for active crop monitoring
 */
export async function fetchFieldAdvice(crop, moisture, nutrients, temperature, weather, lang) {
  const prompt = `
    You are an expert agronomist advisor. A farmer is growing ${lang === 'kn' ? crop.name_kn : crop.name_en}.
    Current field sensor readings:
    - Soil Moisture: ${moisture}% (Optimal range for this crop is ${crop.thresholds.soilMoisture.optimal_min}% to ${crop.thresholds.soilMoisture.optimal_max}%)
    - Nutrient Level (NPK): ${nutrients}/100 (Optimal min is ${crop.thresholds.nutrients.optimal_min})
    - Temperature: ${temperature}°C (Optimal range is ${crop.thresholds.temperature.optimal_min}°C to ${crop.thresholds.temperature.optimal_max}°C)
    - Local Weather Condition: ${weather}

    Provide professional, practical, and highly specific advice for this farmer in ${lang === 'kn' ? 'Kannada' : 'English'}. 
    Focus on immediate actions needed within the next 48 hours to optimize yield and plant health.
    Keep the response under 100 words and do not repeat the raw sensor numbers unless providing a corrective target.
  `;

  return await callGeminiAPI(prompt);
}
