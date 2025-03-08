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
            
            // Get current date/time in UTC
            const nowUTC = new Date();
            
            // Debug the date/time handling extensively
            console.log("Starting time calculations:");
            console.log("UTC time:", nowUTC.toUTCString());
            console.log("Local time:", nowUTC.toString());
            
            // Get location info
            let locationInfo = "";
            let localTime = nowUTC;
            
            if (data.results[0].annotations && data.results[0].annotations.timezone) {
                const tzInfo = data.results[0].annotations.timezone;
                locationInfo = `${data.results[0].formatted} (${tzInfo.name}, UTC${tzInfo.offset_string})`;
                
                // Extract the raw components
                const tzOffsetHours = tzInfo.offset_sec / 3600;
                
                // Log all timezone details for debugging
                console.log("Target timezone details:", {
                    name: tzInfo.name,
                    offset_string: tzInfo.offset_string,
                    offset_sec: tzInfo.offset_sec,
                    offset_hours: tzOffsetHours
                });
                
                // Create a new date using explicit year/month/day/hour from the target timezone
                // This avoids all timezone conversion issues by building the time from scratch
                const userLocalDate = new Date();
                
                // Current UTC hour
                const utcHour = userLocalDate.getUTCHours();
                const utcMinutes = userLocalDate.getUTCMinutes();
                
                // Calculate target location hour directly from UTC + offset
                let targetHour = (utcHour + tzOffsetHours) % 24;
                if (targetHour < 0) targetHour += 24;
                
                // Force create a Date object with the correct hour
                localTime = new Date(Date.UTC(
                    userLocalDate.getUTCFullYear(),
                    userLocalDate.getUTCMonth(),
                    userLocalDate.getUTCDate(),
                    targetHour,
                    utcMinutes,
                    0
                ));
                
                console.log("UTC components:", {
                    year: userLocalDate.getUTCFullYear(),
                    month: userLocalDate.getUTCMonth(),
                    date: userLocalDate.getUTCDate(),
                    hours: utcHour,
                    minutes: utcMinutes
                });
                
                console.log("Target location hour calculation:", {
                    utcHour: utcHour,
                    tzOffsetHours: tzOffsetHours,
                    calculatedHour: targetHour,
                });
                
                console.log("TARGET LOCATION TIME:", localTime.toUTCString());
                
                // Also log 12 hours forward/backward to see alternatives
                const plus12 = new Date(localTime.getTime() + 12*60*60*1000);
                const minus12 = new Date(localTime.getTime() - 12*60*60*1000);
                console.log("TARGET +12h:", plus12.toUTCString());
                console.log("TARGET -12h:", minus12.toUTCString());
            }
            
            // Calculate direction to Paradise using the timestamp
            const direction = calculateDirectionToParadise(coordinates.lat, coordinates.lng, localTime.getTime());
            
            // Format time using UTC methods to avoid browser timezone interference
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            
            let hours = localTime.getUTCHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            
            const timeString = `${days[localTime.getUTCDay()]}, ${months[localTime.getUTCMonth()]} ${localTime.getUTCDate()}, ${localTime.getUTCFullYear()}, ${hours}:${String(localTime.getUTCMinutes()).padStart(2, '0')} ${ampm}`;
            
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

function calculateDirectionToParadise(lat, lng, timestamp) {
    // Use timestamp instead of Date object to avoid timezone issues
    const date = new Date(timestamp);
    
    // Log date components for debugging
    console.log("Calculation inputs:", {
        lat: lat,
        lng: lng,
        timestamp: timestamp,
        dateObject: date.toUTCString(),
        dateComponents: {
            UTCFullYear: date.getUTCFullYear(),
            UTCMonth: date.getUTCMonth(),
            UTCDate: date.getUTCDate(),
            UTCHours: date.getUTCHours(),
            UTCMinutes: date.getUTCMinutes()
        }
    });
    
    // Normalize longitude to the range [-180, 180]
    if (lng > 180) {
        lng -= 360;
    } else if (lng < -180) {
        lng += 360;
    }
    // SgrA* coordinates (Galactic Center) – J2000
    const GC = {
        ra: 266.41683, // degrees (17h 45m 40.04s)
        dec: -29.00781 // degrees (-29° 0' 28.1")
    };
    
    // Calculate Julian Date
    const jd = (date.getTime() / 86400000.0) + 2440587.5;
    
    // Calculate GMST in degrees
    const jd0 = Math.floor(jd - 0.5) + 0.5;
    const t = (jd0 - 2451545.0) / 36525.0;
    const ut = ((jd + 0.5) % 1.0) * 24.0;
    let gmst = 280.46061837 + 360.98564736629 * (jd0 - 2451545.0) + 0.000387933*t*t - t*t*t/38710000.0;
    gmst = (gmst + ut*15.04107) % 360;
    if (gmst < 0) gmst += 360;
    
    // Local sidereal time in degrees
    const lst = (gmst + lng) % 360;
    
    // Hour angle (HA) of GC
    let ha = lst - GC.ra;
    if (ha < -180) ha += 360;
    if (ha > 180) ha -= 360;
    
    // Convert lat, GC declination & HA to radians
    const latRad = lat * Math.PI/180;
    const decRad = GC.dec * Math.PI/180;
    const haRad = ha * Math.PI/180;
    
    // Altitude (elevation): alt = arcsin( sin(dec)*sin(lat) + cos(dec)*cos(lat)*cos(HA) )
    const sinAlt = Math.sin(decRad)*Math.sin(latRad) + Math.cos(decRad)*Math.cos(latRad)*Math.cos(haRad);
    const alt = Math.asin(Math.max(-1, Math.min(1,sinAlt)))*180/Math.PI;
    
    // Azimuth: az = arctan2( sin(HA), cos(HA)*sin(lat) - tan(dec)*cos(lat) )
    let azRad = Math.atan2(Math.sin(haRad), Math.cos(haRad)*Math.sin(latRad) - Math.tan(decRad)*Math.cos(latRad));
    let az = (azRad*180/Math.PI + 360) % 360;
    
    // Flip azimuth by 180° if GC is below horizon so the “facing” direction reflects what RedShift reports.
    let displayAz = az;
    if (alt < 0) {
        displayAz = (az + 180) % 360;
    }
    
    console.log(`Location: ${lat.toFixed(2)}°, ${lng.toFixed(2)}°, HA: ${ha.toFixed(2)}°`);
    console.log(`Altitude: ${alt.toFixed(2)}°, Display Azimuth: ${displayAz.toFixed(2)}°`);
    
    const isAboveHorizon = alt > 0;
    
    const compassDirections = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compassIndex = Math.floor(((displayAz + 11.25) % 360) / 22.5);
    const compass = compassDirections[compassIndex];
    
    return {
        azimuth: displayAz,
        elevation: Math.abs(alt),
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
