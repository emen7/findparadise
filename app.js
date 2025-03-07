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
    
    // Parse the datetime input
    const date = new Date(datetime);
    
    // Calculate Local Sidereal Time (LST)
    const utc = date.getTime() / 86400000 + 2440587.5; // Convert to Julian Date
    const jd2000 = 2451545.0;
    const t = (utc - jd2000) / 36525;
    const gmst = (280.46061837 + 360.98564736629 * (utc - jd2000) + 0.000387933 * t * t - t * t * t / 38710000.0) % 360;
    const lst = (gmst + lng) % 360;
    
    // Calculate hour angle in degrees
    const hourAngle = (lst - SgrA.ra + 360) % 360;
    
    // Convert degrees to radians
    const latRad = lat * Math.PI / 180;
    const decRad = SgrA.dec * Math.PI / 180;
    const haRad = hourAngle * Math.PI / 180;
    
    // Calculate altitude (elevation)
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    const elevation = Math.asin(sinAlt) * 180 / Math.PI;
    
    // Calculate azimuth
    let cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
    cosAz = Math.max(-1, Math.min(1, cosAz)); // Clamp to valid range
    
    let azimuth = Math.acos(cosAz) * 180 / Math.PI;
    if (Math.sin(haRad) > 0) {
        azimuth = 360 - azimuth;
    }
    
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
