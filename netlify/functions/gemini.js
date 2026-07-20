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
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: { message: "Empty request body received." } })
      };
    }

    let contents = [];
    let safetySettings = [];
    let tools = null;

    try {
      const parsedBody = JSON.parse(event.body);
      contents = parsedBody.contents || [];
      safetySettings = parsedBody.safetySettings || [];
      tools = parsedBody.tools || null;
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: { message: "Invalid JSON request payload." } })
      };
    }

    if (!Array.isArray(contents) || contents.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: { message: "No contents provided for AI generation." } })
      };
    }

    const makeRequest = async (apiVersion, modelName, includeTools = true) => {
      const currentPayload = {
        contents,
        safetySettings,
        ...(includeTools && tools ? { tools } : {})
      };
      const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${API_KEY}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentPayload)
        });
        
        // Handle empty or non-JSON responses
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error("Failed to parse Google API response JSON:", parseError);
          data = { error: { message: `Invalid JSON from Google API: ${text.substring(0, 100)}` } };
        }
        
        return { response, data };
      } catch (e) {
        return { response: { ok: false, status: 500 }, data: { error: { message: e.message } } };
      }
    };
    
    // Tiered Fallback Sequence with active Gemini & Gemma redundancy
    const attempts = [
      { ver: 'v1beta', model: 'gemini-flash-latest' },
      { ver: 'v1beta', model: 'gemini-2.0-flash' },
      { ver: 'v1beta', model: 'gemini-2.0-flash-lite' },
      { ver: 'v1beta', model: 'gemini-pro-latest' },
      { ver: 'v1beta', model: 'gemma-4-26b-a4b-it' },
      { ver: 'v1beta', model: 'gemma-4-31b-it' },
      { ver: 'v1', model: 'gemini-2.0-flash' },
      { ver: 'v1', model: 'gemini-flash-latest' }
    ];

    let lastError = null;

    for (const attempt of attempts) {
      let { response, data } = await makeRequest(attempt.ver, attempt.model, true);
      
      // If tool grounding failed due to unsupported parameters or rate limits (400/429/404), retry without tools
      if (!response.ok && tools && (response.status === 400 || response.status === 429 || response.status === 404)) {
        console.warn(`Tool grounding rejected for ${attempt.model} (${response.status}), retrying without tools...`);
        const retryResult = await makeRequest(attempt.ver, attempt.model, false);
        response = retryResult.response;
        data = retryResult.data;
      }
      
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

      // If we hit a 400 (bad argument/tools), 404 (model not found), 429 (rate limit), 503 (overloaded), or 500 (internal error),
      // log it and try the next model in the list.
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
