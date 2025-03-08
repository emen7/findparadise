export default async function handler(req, res) {
  const { location } = req.query;
  
  if (!location) {
    return res.status(400).json({ error: 'Location parameter is required' });
  }

  try {
    const apiKey = process.env.OPENCAGE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Geocoding failed' });
    }
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to geocode location' });
  }
}
