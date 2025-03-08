export default async function handler(req, res) {
  // Set CORS headers to allow requests from any origin during development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { location } = req.query;
  
  if (!location) {
    return res.status(400).json({ error: 'Location parameter is required' });
  }

  try {
    // Get API key from environment variable
    const apiKey = process.env.OPENCAGE_API_KEY;
    
    if (!apiKey) {
      console.error('API key not configured in environment variables');
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${apiKey}`;
    
    console.log(`Geocoding request for: ${location}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenCage API Error: ${response.status}`, errorText);
      return res.status(response.status).json({ 
        error: 'OpenCage API error', 
        details: errorText
      });
    }
    
    const data = await response.json();
    
    // Check if we have actual results
    if (!data.results || data.results.length === 0) {
      console.log('No results found for location:', location);
    } else {
      console.log('Successfully geocoded location:', location);
    }
    
    // Return the data in the format the frontend expects
    return res.status(200).json(data);
  } catch (error) {
    console.error('Geocoding error:', error);
    return res.status(500).json({ error: 'Failed to geocode location', details: error.message });
  }
}
