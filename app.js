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
            
            // Get current date/time - use the local time to avoid 2025 date issue
            const now = new Date();
            console.log("Device current time: ", now.toString());
            
            // Use timezone from API if available - simplified approach
            let localTime = now;
            if (data.results[0].annotations && data.results[0].annotations.timezone) {
                // Get timezone offset in minutes
                const tzOffset = data.results[0].annotations.timezone.offset_sec / 60;
                // Get user's local offset in minutes
                const localOffset = now.getTimezoneOffset();
                // Apply the difference to adjust for the location's timezone
                localTime = new Date(now.getTime() + (localOffset + tzOffset) * 60000);
                console.log("Adjusted location time: ", localTime.toString());
            }
            
            // Ensure current year is used, not future date
            if (localTime.getFullYear() > now.getFullYear()) {
                localTime.setFullYear(now.getFullYear());
                console.log("Fixed year: ", localTime.toString());
            }
            
            // Calculate direction to Paradise using the local time at the searched location
            const direction = calculateDirectionToParadise(coordinates.lat, coordinates.lng, localTime);
            
            // Basic formatting using locale string
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
                    <strong>From Location:</strong> ${formatShortLocation(data.results[0])}
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
    // Ensure longitude is normalized to [-180, 180] range
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
    
    // SgrA* coordinates (Galactic Center)
    const GC = {
        ra: 266.41683, // Right Ascension in degrees
        dec: -29.00781 // Declination in degrees
    };
    
    // Parse the datetime input
    const date = new Date(datetime);
    
    // Calculate Julian Date - standard astronomy formula
    const jd = (date.getTime() / 86400000.0) + 2440587.5;
    
    // Calculate GMST in degrees - using standard formula
    const jd0 = Math.floor(jd - 0.5) + 0.5;
    const t = (jd0 - 2451545.0) / 36525.0;
    const ut = ((jd + 0.5) % 1.0) * 24.0;
    let gmst = 280.46061837 + 360.98564736629 * (jd0 - 2451545.0) + 0.000387933 * t * t - t * t * t / 38710000.0;
    gmst = (gmst + ut * 15.04107) % 360;
    if (gmst < 0) gmst += 360;
    
    // Calculate local sidereal time in degrees
    const lst = (gmst + lng) % 360;
    
    // Calculate hour angle in degrees
    let ha = lst - GC.ra;
    if (ha < -180) ha += 360;
    if (ha > 180) ha -= 360;
    
    // Convert to radians
    const latRad = lat * Math.PI / 180;
    const decRad = GC.dec * Math.PI / 180;
    const haRad = ha * Math.PI / 180;
    
    // Calculate altitude (elevation) - standard formula
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    
    // Calculate azimuth - standard formula
    const sinA = Math.sin(haRad) * Math.cos(decRad);
    const cosA = Math.cos(haRad) * Math.sin(latRad) * Math.cos(decRad) - Math.sin(decRad) * Math.cos(latRad);
    let az = Math.atan2(sinA, cosA) * 180 / Math.PI;
    az = (az + 360) % 360;
    
    // RedShift uses a different azimuth convention - comparing with the provided values
    // shows we need to adjust our azimuth by approximately 180° when below horizon
    // Lafayette Hill: RedShift says 85° vs our ~280° (diff of ~195°)
    let displayAz = (az + 180) % 360; // Always use opposite direction
    
    console.log(`Raw calculated values - Alt: ${alt.toFixed(2)}°, Az: ${az.toFixed(2)}°`);
    console.log(`Adjusted for RedShift - Az: ${displayAz.toFixed(2)}°`);
    
    const isAboveHorizon = alt > 0;
    
    // Convert azimuth to compass direction
    const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                              'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compassIndex = Math.floor(((displayAz + 11.25) % 360) / 22.5);
    const compass = compassDirections[compassIndex];
    
    // Debug outputs for time and timezone verification
    console.log(`Date used for calculation: ${date.toString()}`);
    console.log(`Year: ${date.getFullYear()}, Month: ${date.getMonth() + 1}, Day: ${date.getDate()}`);
    console.log(`Hours: ${date.getHours()}, Minutes: ${date.getMinutes()}`);
    console.log(`Timezone offset: ${date.getTimezoneOffset() / -60} hours`);
    
    return {
        azimuth: displayAz,
        elevation: Math.abs(alt),
        isAboveHorizon: isAboveHorizon,
        compass: compass
    };
}

function formatShortLocation(geocodeResult) {
    if (!geocodeResult || !geocodeResult.components) {
        return geocodeResult.formatted || "Unknown location";
    }
    
    const components = geocodeResult.components;
    const formatted = geocodeResult.formatted || "";
    
    // For US locations, try to extract the recognizable locality name from the formatted address
    if (components.country_code && components.country_code.toLowerCase() === 'us') {
        // First check for common place components
        let locality = components.city || 
                      components.town || 
                      components.village ||
                      components.hamlet;
        
        // If not found, and it's a township situation, use the first part of the formatted address
        // This typically contains the common name people recognize
        if ((!locality || locality.includes("Township")) && formatted) {
            // For "Lafayette Hill, Whitemarsh Township, PA" -> extract "Lafayette Hill"
            const parts = formatted.split(',');
            if (parts.length > 0) {
                locality = parts[0].trim();
            }
        }
        
        // Get the state (preferring the abbreviation)
        const region = components.state_code || components.state;
        
        // If we have both locality and region, format as "City, ST"
        if (locality && region) {
            return `${locality}, ${region}, USA`;
        }
    }
    
    // Fall back to general approach for non-US locations or if the above didn't work
    // Get the city/town name with better prioritization
    // For US locations, city is often more relevant than township/county
    let locality = components.city || 
                  components.town || 
                  components.village ||
                  components.municipality ||
                  components.district ||
                  components.hamlet || 
                  components.suburb;
                  
    // For US addresses specifically, handle township differently
    if (components.country_code && components.country_code.toLowerCase() === 'us') {
        // If we don't have a locality but do have a formatted component, extract just the city name
        if (!locality && geocodeResult.formatted) {
            const parts = geocodeResult.formatted.split(',');
            if (parts.length > 1) {
                locality = parts[0].trim(); // Just use the first part
            }
        }
    }
    
    // Get the state/province (without county/township)
    let region = components.state_code || components.state || components.province;
    
    // For US addresses, prefer state_code (PA) over state (Pennsylvania)
    if (components.country_code && components.country_code.toLowerCase() === 'us') {
        region = components.state_code || components.state;
    }
    
    // Get country code or abbreviate
    let country = "";
    if (components.country_code) {
        country = components.country_code.toUpperCase();
    } else if (components.country) {
        // Abbreviate countries with common abbreviations
        const countries = {
            "United States": "USA",
            "United States of America": "USA",
            "United Kingdom": "UK",
            "Australia": "AUS",
            "Canada": "CAN",
            "Germany": "DE",
            "France": "FR",
            "Italy": "IT",
            "Spain": "ES",
            "Japan": "JP",
            "China": "CN",
            "Russia": "RU",
            "India": "IN",
            "Brazil": "BR"
        };
        country = countries[components.country] || components.country;
    }
    
    // Build the short location string
    let result = locality || "";
    if (region && region !== locality) {
        if (result) result += ", ";
        result += region;
    }
    if (country) {
        if (result) result += ", ";
        result += country;
    }
    
    // If all else fails, extract the first portion of the formatted address
    if (!result && geocodeResult.formatted) {
        const parts = geocodeResult.formatted.split(',');
        result = parts[0].trim();
        if (parts.length > 1 && parts[1].trim().length <= 3) {
            result += ", " + parts[1].trim();
        }
    }
    
    return result || geocodeResult.formatted || "Unknown location";
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
    
    // Add an arrowhead pointing toward the circle at the end of the line
    // Calculate the angle of the line for rotation
    const arrowAngle = Math.atan2(centerY - indicatorEndY, centerX - indicatorEndX);
    
    // Position the arrowhead at the end of the line (not 85% along)
    const arrowPosX = indicatorEndX;
    const arrowPosY = indicatorEndY;
    
    // Arrow size - increased for better visibility
    const arrowSize = 15;
    
    // Draw a larger, more visible arrowhead
    ctx.beginPath();
    ctx.moveTo(arrowPosX, arrowPosY);
    ctx.lineTo(
        arrowPosX + arrowSize * Math.cos(arrowAngle - Math.PI/5), // Wider angle for visibility
        arrowPosY + arrowSize * Math.sin(arrowAngle - Math.PI/5)
    );
    ctx.lineTo(
        arrowPosX + arrowSize * Math.cos(arrowAngle + Math.PI/5), // Wider angle for visibility
        arrowPosY + arrowSize * Math.sin(arrowAngle + Math.PI/5)
    );
    ctx.closePath();
    ctx.fillStyle = '#FFA500';
    ctx.fill();
    
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
