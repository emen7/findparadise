// ...existing code...
document.getElementById("paradiseForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  
  const locationInput = document.getElementById("location").value;
  const datetimeInput = document.getElementById("datetime").value;
  const resultEl = document.getElementById("result");

  // Call OpenCage Geocoding API
  const apiKey = "d7f7332e901b4d3cbb08a68d27c2c15e"; // Replace with your OpenCage API key
  const apiUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(locationInput)}&key=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry;
      // Dummy function to compute direction.
      const message = getDirection(lat, lng, new Date(datetimeInput));
      resultEl.textContent = message;
    } else {
      resultEl.textContent = "Location not found.";
    }
  } catch (err) {
    console.error(err);
    resultEl.textContent = "An error occurred.";
  }
});

// Updated direction calculation using improved GMST and LST computations.
function getDirection(userLat, userLng, currentTime) {
    // SgrA* fixed equatorial coordinates:
    const RA_deg = 266.41683;  // (17h45m40.04s converted to degrees)
    const Dec_deg = -29.00781; // in degrees

    const deg2rad = Math.PI / 180;
    const rad2deg = 180 / Math.PI;
    const latRad = userLat * deg2rad;
    const decRad = Dec_deg * deg2rad;

    // Use the provided time directly (removing the extra subtraction of the timezone offset)
    const currentUTC = currentTime; // change made here

    // Calculate Julian Date (JD)
    const JD = currentUTC.getTime() / 86400000 + 2440587.5;
    const D = JD - 2451545.0; // Days since J2000.0

    // Compute Greenwich Mean Sidereal Time (GMST) in degrees using a more accurate formula:
    let GMST_deg = 280.46061837 + 360.98564736629 * D;
    GMST_deg = ((GMST_deg % 360) + 360) % 360;

    // Local Sidereal Time in degrees:
    const LST_deg = ((GMST_deg + userLng) % 360 + 360) % 360;

    // Hour Angle (HA) in degrees:
    let HA = LST_deg - RA_deg;
    HA = ((HA + 540) % 360) - 180;
    const HA_rad = HA * deg2rad;

    // Altitude (alt) computation:
    const altRad = Math.asin(Math.sin(decRad)*Math.sin(latRad) + Math.cos(decRad)*Math.cos(latRad)*Math.cos(HA_rad));
    const altDeg = altRad * rad2deg;

    // Clamp display angle (0 to 45°) using the absolute value:
    const absAlt = Math.abs(altDeg);
    const displayAngle = absAlt > 45 ? 45 : absAlt.toFixed(1);

    // Compute Azimuth using horizontal coordinate transformation:
    let azRad = Math.acos((Math.sin(decRad) - Math.sin(altRad)*Math.sin(latRad)) / (Math.cos(altRad)*Math.cos(latRad)));
    let azDeg = azRad * rad2deg;
    if (Math.sin(HA_rad) > 0) {
        azDeg = 360 - azDeg;
    }

    // Determine cardinal direction from azimuth (8 sectors)
    const directions = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
    const index = Math.floor(((azDeg + 22.5) % 360) / 45);
    const cardinal = directions[index];

    const lookDir = altDeg >= 0 ? "up" : "down";

    return `Face ${cardinal} and look ${lookDir} ${displayAngle}° from the horizon.`;
}
// ...existing code...
