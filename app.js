// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('paradiseForm');
    const resultDiv = document.getElementById('result');

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        
        const location = document.getElementById('location').value;
        
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
            
            // Get current date/time
            const now = new Date();
            
            // Use timezone from API if available
            let localTime = now;
            if (data.results[0].annotations && data.results[0].annotations.timezone) {
                // Get timezone offset in minutes
                const tzOffset = data.results[0].annotations.timezone.offset_sec / 60;
                // Get user's local offset in minutes
                const localOffset = now.getTimezoneOffset();
                // Apply the difference to adjust for the location's timezone
                localTime = new Date(now.getTime() + (localOffset + tzOffset) * 60000);
            }
            
            // Calculate direction to Paradise using the local time at the searched location
            const direction = calculateDirectionToParadise(coordinates.lat, coordinates.lng, localTime);
            
            const timeString = localTime.toLocaleString(undefined, {
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            resultDiv.innerHTML = `
                <div class="result-section">
                    <strong>From Location:</strong> ${data.results[0].formatted}
                </div>
                
                <div class="result-section">
                    <strong>At Local Time:</strong> ${timeString}
                </div>
                
                <div class="result-section">
                    <strong>To Find Paradise:</strong> Face ${direction.compass} (${direction.azimuth.toFixed(2)}°) and look 
                    ${direction.isAboveHorizon ? 'up' : 'down'} ${direction.elevation.toFixed(2)}° 
                    from the horizon.
                </div>
            `;

            // Draw the direction indicator
            drawDirectionIndicator(direction.azimuth, direction.isAboveHorizon ? direction.elevation : -direction.elevation);
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
    let elevation = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    
    // Simply determine if it's above or below horizon, but keep actual value
    const isAboveHorizon = elevation > 0;
    // Use absolute value only for display purposes, don't cap at 45
    const absElevation = Math.abs(elevation);
    
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
        elevation: absElevation, // Return the absolute value without capping
        isAboveHorizon: isAboveHorizon,
        compass: compass
    };
}

// Function to draw the direction and elevation indicator
function drawDirectionIndicator(azimuth, elevation) {
    const canvas = document.getElementById('directionIndicator');
    if (!canvas) return;
    
    // Make canvas visible
    canvas.style.display = 'block';
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2.2; // Slightly smaller than canvas
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set styles for dark mode
    ctx.strokeStyle = '#a9a9aa';
    ctx.fillStyle = '#a9a9aa';
    ctx.lineWidth = 2;
    ctx.font = '14px Roboto, sans-serif';
    
    // Draw the circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw horizon line
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.stroke();
    
    // Draw degree markings
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 0° marks (left and right)
    ctx.fillText("0°", centerX - radius - 15, centerY);
    ctx.fillText("0°", centerX + radius + 15, centerY);
    
    // 90° marks (top and bottom)
    ctx.fillText("90°", centerX, centerY - radius - 15);
    ctx.fillText("90°", centerX, centerY + radius + 15);
    
    // Determine which side to show the compass direction
    const isWesterly = (azimuth >= 225 && azimuth <= 360) || (azimuth >= 0 && azimuth < 45);
    
    // Display the compass direction
    ctx.font = '16px Roboto, sans-serif';
    ctx.textAlign = 'center';
    if (isWesterly) {
        ctx.fillText(getCompassDirection(azimuth), centerX - radius - 25, centerY - 20);
    } else {
        ctx.fillText(getCompassDirection(azimuth), centerX + radius + 25, centerY - 20);
    }
    
    // Calculate the position of the indicator line
    const elevationRadians = Math.abs(elevation) * Math.PI / 180;
    const directionMultiplier = isWesterly ? -1 : 1; // Left or right side
    const verticalMultiplier = elevation >= 0 ? -1 : 1; // Above or below horizon
    
    const indicatorEndX = centerX + directionMultiplier * radius * Math.cos(elevationRadians);
    const indicatorEndY = centerY + verticalMultiplier * radius * Math.sin(elevationRadians);
    
    // Draw the indicator line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(indicatorEndX, indicatorEndY);
    ctx.strokeStyle = '#ff2d55'; // Use accent color for the line
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw the angle value at the end of the line
    ctx.fillStyle = '#ff2d55'; // Use accent color for the text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '14px Roboto, sans-serif';
    ctx.fillText(`${Math.abs(elevation).toFixed(1)}°`, 
        centerX + directionMultiplier * (radius + 25) * Math.cos(elevationRadians),
        centerY + verticalMultiplier * (radius + 25) * Math.sin(elevationRadians));
}

// Helper function to get compass direction from azimuth
function getCompassDirection(azimuth) {
    const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                              'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compassIndex = Math.floor(((azimuth + 11.25) % 360) / 22.5);
    return compassDirections[compassIndex];
}
