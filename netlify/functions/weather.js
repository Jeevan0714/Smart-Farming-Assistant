/**
 * Netlify Function for Secure Weather API Interaction
 * Using Open-Meteo (Open Source & Keyless for non-commercial use)
 */

export const handler = async (event) => {
  const { lat, lon } = event.queryStringParameters;
  
  if (!lat || !lon) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Latitude and longitude are required" })
    };
  }

  try {
    // Open-Meteo doesn't require an API key!
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.message || "Failed to fetch weather data" })
      };
    }

    // Map Open-Meteo response to a simpler format for our frontend
    // WMO Weather interpretation codes (WW)
    // 0: Clear sky -> sunny
    // 1, 2, 3: Mainly clear, partly cloudy, and overcast -> cloudy
    // 51-67, 80-82: Rain/Drizzle -> rainy
    // others default to sunny or dry
    
    const code = data.current.weather_code;
    let condition = 'sunny';
    
    if (code >= 1 && code <= 3) {
      condition = 'cloudy';
    } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) {
      condition = 'rainy';
    } else if (code === 0) {
      condition = 'sunny';
    } else {
      condition = 'dry'; // For other codes like fog or snow (mapped to dry for this specific app)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        temp: data.current.temperature_2m,
        condition: condition,
        raw_code: code
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
