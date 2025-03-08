// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('paradiseForm');
    const resultDiv = document.getElementById('result');

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        
        const location = document.getElementById('location').value;
        
        resultDiv.innerHTML = 'Calculating direction to Paradise...';
        
        try {
            // Determine whether we're running locally or on Vercel
            let geocodeUrl;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // For local testing - use direct OpenCage API (not recommended for production)
                // You would need to add your key directly for testing
                const testApiKey = 'your-test-api-key'; // Replace with a test key for local development
                geocodeUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${testApiKey}`;
            } else {
                // For production deployment - use API endpoint
                geocodeUrl = `/api/geocode?location=${encodeURIComponent(location)}`;
            }
            
            console.log("Fetching geocode data from:", geocodeUrl.replace(/key=([^&]*)/, 'key=HIDDEN'));
            
            const response = await fetch(geocodeUrl);
            console.log("API Response status:", response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("API Error:", errorText);
                throw new Error(`Geocoding service unavailable: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("API Data received:", data);
            
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
            resultDiv.innerHTML = `Error: ${error.message || 'Failed to calculate direction'}. Please try again.`;
        }
    });
});

function calculateDirectionToParadise(lat, lng, datetime) {
    // Galactic Center (SgrA*) - J2000 coordinates
    const GC = {
        ra: 17.761111 * 15, // RA: 17h 45m 40.04s to degrees (multiply by 15)
        dec: -29.0078       // Dec: -29° 00′ 28.1″
    };
    
    // Convert input date to UTC
    const date = new Date(datetime);
    
    // STEP 1: Calculate Julian Date (days since Jan 1, 4713 BC Greenwich noon)
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    let jd = 367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) - 
             Math.floor(3 * (Math.floor((y + (m - 9) / 7) / 100) + 1) / 4) + 
             Math.floor(275 * m / 9) + d + 1721028.5;
    
    // Add time of day
    jd += (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;
    
    // STEP 2: Calculate GMST (Greenwich Mean Sidereal Time)
    // Days since J2000 epoch
    const jd2000 = jd - 2451545.0;
    const t = jd2000 / 36525;  // Julian Centuries
    
    // GMST at 0h UT formula (in hours)
    let gmst = 6.697374558 + 0.06570982441908 * jd2000 + 0.000026 * t * t;
    
    // Add correction for current time of day
    const H = (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600);
    gmst = gmst + H * 1.002737909;
    
    // Convert to range 0-24
    gmst = gmst % 24;
    if (gmst < 0) gmst += 24;
    
    // STEP 3: Calculate Local Sidereal Time (adding longitude, expressed in hours)
    let lst = gmst + lng / 15;
    // Convert to range 0-24
    lst = lst % 24;
    if (lst < 0) lst += 24;
    
    // STEP 4: Calculate Hour Angle of the Galactic Center (in degrees)
    let ha = (lst * 15) - GC.ra;  // Convert LST to degrees then subtract RA
    if (ha < -180) ha += 360;
    if (ha > 180) ha -= 360;
    
    // STEP 5: Convert to radians for trig functions
    const latRad = lat * Math.PI / 180;
    const decRad = GC.dec * Math.PI / 180;
    const haRad = ha * Math.PI / 180;
    
    // STEP 6: Calculate altitude/elevation
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    
    // STEP 7: Calculate azimuth (0 = North, 90 = East, 180 = South, 270 = West)
    // Numerator and denominator for atan2 to calculate azimuth
    const y = Math.sin(haRad);
    const x = Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad);
    
    // Use atan2 to get correct quadrant
    let az = Math.atan2(y, x) * 180 / Math.PI + 180; // +180 to convert from -180:180 to 0:360 with north at 0
    
    // Debug output
    console.log(`JD: ${jd.toFixed(5)}, GMST: ${(gmst * 15).toFixed(5)}°, LST: ${(lst * 15).toFixed(5)}°`);
    console.log(`HA: ${ha.toFixed(5)}°, Alt: ${alt.toFixed(5)}°, Az: ${az.toFixed(5)}°`);
    console.log(`Location: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°, Time UTC: ${date.toUTCString()}`);
    
    // Convert azimuth to compass direction
    const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                              'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compassIndex = Math.floor(((az + 11.25) % 360) / 22.5);
    
    return {
        azimuth: az,
        elevation: Math.abs(alt),
        isAboveHorizon: alt > 0,
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
