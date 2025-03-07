// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('paradiseForm');
    const resultDiv = document.getElementById('result');

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        
        const location = document.getElementById('location').value;
        const datetime = document.getElementById('datetime').value;
        
        resultDiv.innerHTML = 'Calculating direction to Paradise...';
        
        try {
            // For Vercel deployment, use API endpoint to securely access API key
            const geocodeUrl = `/api/geocode?location=${encodeURIComponent(location)}`;
            
            const response = await fetch(geocodeUrl);
            if (!response.ok) {
                throw new Error('Geocoding service unavailable');
            }
            
            const data = await response.json();
            if (!data || !data.results || data.results.length === 0) {
                resultDiv.innerHTML = 'Location not found. Please try a different location.';
                return;
            }
            
            const coordinates = data.results[0].geometry;
            
            // Calculate direction to Paradise (using SgrA* as reference)
            const direction = calculateDirectionToParadise(coordinates.lat, coordinates.lng, datetime);
            
            resultDiv.innerHTML = `
                <strong>Location:</strong> ${data.results[0].formatted}<br>
                <strong>Direction to Paradise:</strong> ${direction.compass} (${direction.azimuth.toFixed(2)}°)<br>
                <strong>Elevation:</strong> ${direction.elevation.toFixed(2)}° ${direction.elevation > 0 ? 'above' : 'below'} horizon
            `;
            
            // Draw the visual angle representation if we have a canvas
            const canvas = document.getElementById('angleClock');
            if (canvas && typeof drawClock === 'function') {
                drawClock(direction.elevation);
            }
            
        } catch (error) {
            console.error('Error:', error);
            resultDiv.innerHTML = 'Error calculating direction. Please try again.';
        }
    });
});

function calculateDirectionToParadise(lat, lng, datetime) {
    // SgrA* coordinates (Galactic Center)
    const SgrA = {
        ra: 266.41683, // Right Ascension in degrees (17h 45m 40.04s)
        dec: -29.00781 // Declination in degrees (-29° 0' 28.1")
    };
    
    // Convert to astronomical coordinates and calculate azimuth/elevation
    // This is a placeholder - implement actual astronomical calculations here
    const date = new Date(datetime);
    
    // Simplified calculation for demo purposes
    // In a real app, use a proper astronomical library
    const hourAngle = (date.getUTCHours() + date.getUTCMinutes()/60) * 15 - lng - SgrA.ra;
    
    // Very simplified azimuth calculation (not accurate)
    const azimuth = ((hourAngle + 360) % 360);
    
    // Very simplified elevation calculation (not accurate)
    const elevation = SgrA.dec - lat + Math.sin(date.getUTCHours() / 24 * 2 * Math.PI) * 10;
    
    // Convert azimuth to compass direction
    const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                              'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compassIndex = Math.round(azimuth / 22.5) % 16;
    const compass = compassDirections[compassIndex];
    
    return {
        azimuth: azimuth,
        elevation: elevation,
        compass: compass
    };
}
