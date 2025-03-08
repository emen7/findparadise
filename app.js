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
    // More accurate SgrA* (Galactic Center) coordinates - J2000 epoch
    const SgrA = {
        ra: 266.4168, // Updated RA in degrees (17h 45m 40.04s)
        dec: -29.0078 // Updated Dec in degrees (-29° 00' 28.1")
    };
    
    // Parse the datetime input
    const date = new Date(datetime);
    
    // Calculate Julian Date with more precision
    const jd = (date.getTime() / 86400000.0) + 2440587.5;
    
    // Calculate time in Julian centuries since J2000.0
    const T = (jd - 2451545.0) / 36525;
    
    // Apply precession correction to coordinates (Simplified precession model)
    const precessionRate = 0.0139; // degrees per year (simplified average)
    const yearsSinceJ2000 = T * 100;
    let correctedRA = SgrA.ra + precessionRate * yearsSinceJ2000;
    correctedRA = correctedRA % 360;
    
    // Calculate GMST with higher precision formula
    // Meeus, Astronomical Algorithms, 2nd ed, Chapter 12
    let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
    gmst += 0.000387933 * T * T - T * T * T / 38710000.0;
    
    // Add contribution from UT hours
    const dayFraction = (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;
    gmst += dayFraction * 360.0 * 1.00273781191135448;
    gmst = gmst % 360;
    if (gmst < 0) gmst += 360;
    
    // Calculate local sidereal time in degrees
    const lst = (gmst + lng) % 360;
    
    // Calculate hour angle with corrected RA
    let ha = lst - correctedRA;
    if (ha < -180) ha += 360;
    if (ha > 180) ha -= 360;
    
    // Convert to radians
    const latRad = lat * Math.PI / 180;
    const decRad = SgrA.dec * Math.PI / 180;
    const haRad = ha * Math.PI / 180;
    
    // Calculate altitude (elevation) - refined formula
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const elevation = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    
    // Fix azimuth calculation - correct formula with proper quadrant handling
    // This is the standard astronomical formula for azimuth from north through east
    let y = -Math.sin(haRad);
    let x = Math.tan(decRad) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(haRad);
    let azimuth = Math.atan2(y, x) * 180 / Math.PI;
    
    // Convert to 0-360 range
    azimuth = (azimuth + 360) % 360;
    
    // Account for atmospheric refraction near horizon
    let correctedElevation = elevation;
    if (elevation < 10) {
        // Simplified refraction correction formula
        const R = 1.02 / Math.tan((elevation + 10.3 / (elevation + 5.11)) * Math.PI / 180);
        correctedElevation = elevation + R / 60; // R is in arcminutes, convert to degrees
    }
    
    // Other calculations remain the same
    const isAboveHorizon = correctedElevation > 0;
    const absElevation = Math.abs(correctedElevation);
    
    // Convert to compass direction - same as before
    const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                              'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compassIndex = Math.floor(((azimuth + 11.25) % 360) / 22.5);
    const compass = compassDirections[compassIndex];
    
    console.log(`Location: ${lat}, ${lng}, Corrected RA: ${correctedRA.toFixed(4)}, LST: ${lst.toFixed(4)}`);
    console.log(`Elevation: ${elevation.toFixed(2)}, Corrected: ${correctedElevation.toFixed(2)}, Azimuth: ${azimuth.toFixed(2)}`);
    
    return {
        azimuth: azimuth,
        elevation: absElevation,
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
