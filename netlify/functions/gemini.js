/**
 * Netlify Function for Secure Gemini API Interaction
 * Moves API Key exposure from client to server.
 */

/* eslint-disable no-undef */

export const handler = async (event) => {
  // 1. Validations
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const API_KEY = process.env.GEMINI_API_KEY?.trim();
  if (!API_KEY) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: { message: "GEMINI_API_KEY is not configured in environment variables." } }) 
    };
  }

  try {
    const { contents, safetySettings } = JSON.parse(event.body);

    const payload = {
      contents,
      safetySettings
    };

    const makeRequest = async (apiVersion, modelName) => {
      const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${API_KEY}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        // Handle empty or non-JSON responses
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { error: { message: `Invalid JSON from Google API: ${text.substring(0, 100)}` } };
        }
        
        return { response, data };
      } catch (e) {
        return { response: { ok: false, status: 500 }, data: { error: { message: e.message } } };
      }
    };

    // Determine if request has image data
    const imageData = contents[0].parts.some(p => p.inline_data);
    
    // Tiered Fallback Sequence (Updated for May 2026: Prioritizing Cost-Efficient & Latest Models)
    const attempts = [
      // 1. Ultra-low cost / High Volume (Best for credits)
      { ver: 'v1', model: 'gemini-1.5-flash-8b' },
      { ver: 'v1', model: 'gemini-1.5-flash' },

      // 2. Latest Generation (May 2026) - Optimized "Lite" variants
      { ver: 'v1', model: 'gemini-3.1-flash-lite' },
      { ver: 'v1', model: 'gemini-2.5-flash-lite' },

      // 3. Latest Generation (May 2026) - Standard Flash
      { ver: 'v1', model: 'gemini-3.1-flash' },
      { ver: 'v1', model: 'gemini-2.5-flash' },

      // 4. Stable Fallbacks (if newer ones are overloaded)
      { ver: 'v1beta', model: 'gemini-3.1-flash' },
      { ver: 'v1beta', model: 'gemini-2.5-flash' }
    ];

    // Pro models are expensive; only use if Flash fails or for complex reasoning (non-image)
    if (!imageData) {
      attempts.push({ ver: 'v1', model: 'gemini-2.5-pro' });
      attempts.push({ ver: 'v1', model: 'gemini-3.1-pro' });
    }

    let lastError = null;

    for (const attempt of attempts) {
      const { response, data } = await makeRequest(attempt.ver, attempt.model);
      
      if (response.ok) {
        // Return only the text content or block info back to frontend
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          return { 
            statusCode: 200, 
            body: JSON.stringify({ text: data.candidates[0].content.parts[0].text }) 
          };
        } else if (data.candidates && data.candidates[0] && data.candidates[0].finishReason === "SAFETY") {
          return { statusCode: 200, body: JSON.stringify({ error: "SAFETY_BLOCKED" }) };
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
          return { statusCode: 200, body: JSON.stringify({ error: "PROMPT_BLOCKED", reason: data.promptFeedback.blockReason }) };
        }
      }

      // If we hit a 404 (model not found), 429 (rate limit), 503 (overloaded), or 500 (internal error),
      // we log it and try the next model in the list.
      if ([400, 404, 429, 500, 503, 504].includes(response.status)) {
        lastError = { status: response.status, model: attempt.model, message: data.error?.message };
        console.warn(`Fallback triggered: ${attempt.model} failed with ${response.status}: ${data.error?.message}`);
        continue;
      }

      // For other errors (like 401 Unauthorized), return immediately as fallback won't help
      return { 
        statusCode: response.status, 
        body: JSON.stringify({ error: data.error || { message: "Upstream API Error" } }) 
      };
    }

    // If all attempts fail
    return { 
      statusCode: lastError ? lastError.status : 404, 
      body: JSON.stringify({ 
        error: { 
          message: `All AI models failed or were unavailable. Last tried ${lastError?.model}: ${lastError?.message}` 
        } 
      }) 
    };

  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: "Internal server error: " + error.message } }) };
  }
};
