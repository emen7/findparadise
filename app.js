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
    
    // Calculate days since J2000
    const j2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
    const daysSinceJ2000 = (date - j2000) / (1000 * 60 * 60 * 24);
    
    // Calculate Greenwich Mean Sidereal Time (GMST)
    const T = daysSinceJ2000 / 36525;
    let gmstHours = 6.697374558 + 0.06570982441908 * daysSinceJ2000 + 1.00273790935 * (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600);
    gmstHours = gmstHours % 24;
    if (gmstHours < 0) gmstHours += 24;
    
    // Calculate Local Sidereal Time (LST)
    let lstHours = gmstHours + lng / 15;
    lstHours = lstHours % 24;
    if (lstHours < 0) lstHours += 24;
    
    // Calculate hour angle in hours
    let haHours = lstHours - SgrA.ra / 15;
    if (haHours < -12) haHours += 24;
    if (haHours > 12) haHours -= 24;
    
    // Convert to radians
    const latRad = lat * Math.PI / 180;
    const decRad = SgrA.dec * Math.PI / 180;
    const haRad = haHours * 15 * Math.PI / 180;
    
    // Calculate altitude (elevation)
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    const elevation = Math.asin(sinAlt) * 180 / Math.PI;
    
    // Calculate azimuth - measured from North
    let sinA = Math.sin(haRad) * Math.cos(decRad) / Math.cos(Math.asin(sinAlt));
    let cosA = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
    
    // Handle potential numerical errors
    sinA = Math.max(-1, Math.min(1, sinA));
    cosA = Math.max(-1, Math.min(1, cosA));
    
    let azimuth = Math.atan2(sinA, cosA) * 180 / Math.PI;
    if (azimuth < 0) azimuth += 360;
    
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
