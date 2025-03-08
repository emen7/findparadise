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
    // SgrA* coordinates - J2000 epoch
    const SgrA = {
        ra: 266.4168, // Right Ascension in degrees (17h 45m 40.04s)
        dec: -29.0078 // Declination in degrees (-29° 00' 28.1")
    };
    
    // Parse the datetime input
    const date = new Date(datetime);
    
    // Calculate Julian date more accurately
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = date.getUTCSeconds();
    
    // Calculate Julian Date using Meeus algorithm
    let jd;
    if (month <= 2) {
        jd = Math.floor(365.25 * (year - 1)) + Math.floor(30.6001 * (month + 12)) + day + 1720981.5;
    } else {
        jd = Math.floor(365.25 * year) + Math.floor(30.6001 * (month + 1)) + day + 1720981.5;
    }
    jd += (hour + minute/60 + second/3600) / 24.0;
    
    // Calculate GST using more accurate formula
    const T = (jd - 2451545.0) / 36525;
    const T0 = 6.697374558 + (2400.051336 * T) + (0.000025862 * T * T);
    let GST = T0;
    
    // Convert to degrees and add the rotation for the current time
    GST = (GST * 15 + 15 * (hour + minute/60 + second/3600) * 1.002737909) % 360;
    if (GST < 0) GST += 360;
    
    // Calculate Local Sidereal Time
    let LST = (GST + lng) % 360;
    if (LST < 0) LST += 360;
    
    // Calculate hour angle
    let HA = LST - SgrA.ra;
    if (HA < -180) HA += 360;
    if (HA > 180) HA -= 360;
    
    // Convert to radians
    const latRad = lat * Math.PI / 180;
    const decRad = SgrA.dec * Math.PI / 180;
    const HArad = HA * Math.PI / 180;
    
    // Calculate altitude using the standard formula
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(HArad);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    
    // Calculate azimuth using the standard formula - NOTE N=0, E=90, S=180, W=270
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
    
    // Adjust azimuth based on hour angle
    if (Math.sin(HArad) > 0) {
        az = 360 - az;
    }
    
    const isAboveHorizon = alt > 0;
    
    // Extra logging to diagnose issues
    console.log(`Time UTC: ${date.toUTCString()}, JD: ${jd.toFixed(5)}`);
    console.log(`GST: ${GST.toFixed(4)}°, LST: ${LST.toFixed(4)}°, HA: ${HA.toFixed(4)}°`);
    console.log(`Alt: ${alt.toFixed(2)}°, Az: ${az.toFixed(2)}°`);
    
    // Convert azimuth to compass direction
    const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                              'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compassIndex = Math.floor(((az + 11.25) % 360) / 22.5);
    
    return {
        azimuth: az,
        elevation: Math.abs(alt),
        isAboveHorizon: isAboveHorizon,
        compass: compassDirections[compassIndex]
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
    // Make the circle slightly smaller to allow more space for text
    const radius = Math.min(width, height) / 2.5; 
    
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
    
    // 0° marks (left and right) - position further out
    ctx.fillText("0°", centerX - radius - 20, centerY);
    ctx.fillText("0°", centerX + radius + 20, centerY);
    
    // 90° marks (top and bottom)
    ctx.fillText("90°", centerX, centerY - radius - 15);
    ctx.fillText("90°", centerX, centerY + radius + 15);
    
    // Determine which side to show the compass direction
    const isWesterly = (azimuth >= 225 && azimuth <= 360) || (azimuth >= 0 && azimuth < 45);
    
    // Display the compass direction - change color to orange
    ctx.font = '16px Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFA500'; // Change to orange
    const compassDirection = getCompassDirection(azimuth);
    
    if (isWesterly) {
        // Position westerly directions closer to the circle
        ctx.fillText(compassDirection, centerX - radius - 40, centerY - 20);
    } else {
        // Position easterly directions further right with more space
        ctx.fillText(compassDirection, centerX + radius + 60, centerY - 20);
    }
    
    // Reset fill color for other elements
    ctx.fillStyle = '#a9a9aa';
    
    // Calculate the position of the indicator line
    const elevationRadians = Math.abs(elevation) * Math.PI / 180;
    const directionMultiplier = isWesterly ? -1 : 1; // Left or right side
    const verticalMultiplier = elevation >= 0 ? -1 : 1; // Above or below horizon
    
    const indicatorEndX = centerX + directionMultiplier * radius * Math.cos(elevationRadians);
    const indicatorEndY = centerY + verticalMultiplier * radius * Math.sin(elevationRadians);
    
    // Draw the indicator line - change to orange
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(indicatorEndX, indicatorEndY);
    ctx.strokeStyle = '#FFA500'; // Change from yellow to orange
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw the angle value at the end of the line - prevent edge cutoff
    ctx.fillStyle = '#FFA500'; // Orange
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Roboto, sans-serif'; // Increased from 14px to match direction text size
    
    // Calculate text position with padding to prevent cutoff
    let textX = centerX + directionMultiplier * (radius + 40) * Math.cos(elevationRadians);
    let textY = centerY + verticalMultiplier * (radius + 40) * Math.sin(elevationRadians);
    
    // Add padding to ensure text stays within canvas boundaries
    const padding = 20;
    if (textX < padding) textX = padding;
    if (textX > width - padding) textX = width - padding;
    if (textY < padding) textY = padding;
    if (textY > height - padding) textY = height - padding;
    
    ctx.fillText(`${Math.abs(elevation).toFixed(1)}°`, textX, textY);
}

// Helper function to get compass direction from azimuth
function getCompassDirection(azimuth) {
    const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                              'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compassIndex = Math.floor(((azimuth + 11.25) % 360) / 22.5);
    return compassDirections[compassIndex];
}
