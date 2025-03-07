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
                <strong>To Find Paradise:</strong> Face ${direction.compass} (${direction.azimuth.toFixed(2)}°) and look 
                ${direction.elevation > 0 ? 'up' : 'down'} ${Math.abs(direction.elevation).toFixed(2)}° 
                from the horizon.
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
    
    // Calculate Julian Date
    const jd = (date.getTime() / 86400000.0) + 2440587.5;
    
    // Calculate GMST in degrees
    const jd0 = Math.floor(jd - 0.5) + 0.5;
    const t = (jd0 - 2451545.0) / 36525.0;
    const ut = ((jd + 0.5) % 1.0) * 24.0;
    let gmst = 280.46061837 + 360.98564736629 * (jd0 - 2451545.0) + 0.000387933 * t * t - t * t * t / 38710000.0;
    gmst = (gmst + ut * 15.04107) % 360;
    if (gmst < 0) gmst += 360;
    
    // Calculate local sidereal time in degrees
    const lst = (gmst + lng) % 360;
    
    // Calculate hour angle in degrees
    let ha = lst - SgrA.ra;
    if (ha < -180) ha += 360;
    if (ha > 180) ha -= 360;
    
    // Convert to radians
    const latRad = lat * Math.PI / 180;
    const decRad = SgrA.dec * Math.PI / 180;
    const haRad = ha * Math.PI / 180;
    
    // Calculate altitude (elevation)
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const elevation = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    
    // Calculate azimuth (from north, clockwise)
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
    
    // Determine the quadrant for azimuth
    if (Math.sin(haRad) > 0) {
        azimuth = 360 - azimuth;
    }
    
    // Convert azimuth to compass direction
    const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                              'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compassIndex = Math.floor(((azimuth + 11.25) % 360) / 22.5);
    const compass = compassDirections[compassIndex];
    
    return {
        azimuth: azimuth,
        elevation: elevation,
        compass: compass
    };
}
