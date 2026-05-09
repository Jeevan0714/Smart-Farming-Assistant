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

  const API_KEY = process.env.GEMINI_API_KEY;
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
        const data = await response.json();
        return { response, data };
      } catch (e) {
        return { response: { ok: false, status: 500 }, data: { error: { message: e.message } } };
      }
    };

    // Determine fallback attempts based on payload
    const imageData = contents[0].parts.some(p => p.inline_data);
    
    const attempts = [
      { ver: 'v1', model: 'gemini-1.5-flash' },
      { ver: 'v1beta', model: 'gemini-1.5-flash' },
      { ver: 'v1', model: 'gemini-2.0-flash-exp' },
      { ver: 'v1', model: 'gemini-1.5-flash-8b' },
      { ver: 'v1', model: 'gemini-1.5-pro' },
      { ver: 'v1beta', model: 'gemini-1.5-pro' }
    ];

    if (!imageData) {
      attempts.push({ ver: 'v1', model: 'gemini-1.0-pro' });
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

      if (response.status === 404 || response.status === 400) {
        lastError = { status: response.status, model: attempt.model };
        continue;
      }

      return { 
        statusCode: response.status, 
        body: JSON.stringify({ error: data.error || { message: "Upstream API Error" } }) 
      };
    }

    return { 
      statusCode: lastError ? lastError.status : 404, 
      body: JSON.stringify({ error: { message: `No compatible models found. Last tried: ${lastError?.model}` } }) 
    };

  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: { message: "Invalid request body" } }) };
  }
};
