const http = require('http');

// Route coordinates through Kathmandu (from Maitighar towards Koteshwor)
const path = [
  { lat: 27.6938, lng: 85.3240, speed: 0, heading: 90 },
  { lat: 27.6939, lng: 85.3265, speed: 25, heading: 85 },
  { lat: 27.6941, lng: 85.3290, speed: 42, heading: 80 },
  { lat: 27.6943, lng: 85.3315, speed: 48, heading: 82 },
  { lat: 27.6935, lng: 85.3340, speed: 35, heading: 135 },
  { lat: 27.6912, lng: 85.3365, speed: 38, heading: 140 },
  { lat: 27.6888, lng: 85.3390, speed: 44, heading: 145 },
  { lat: 27.6854, lng: 85.3420, speed: 30, heading: 130 },
  { lat: 27.6820, lng: 85.3445, speed: 15, heading: 135 },
  { lat: 27.6785, lng: 85.3468, speed: 0, heading: 180 }
];

const plateNumber = "Ba96Pa 5542";
const intervalMs = 2500; // Send ping every 2.5 seconds
let index = 0;

function sendPing() {
  if (index >= path.length) {
    console.log("Simulation complete! Restarting path...");
    index = 0;
  }

  const point = path[index];
  const payload = JSON.stringify({
    plate_number: plateNumber,
    latitude: point.lat,
    longitude: point.lng,
    speed: point.speed,
    heading: point.heading
  });

  // Try sending to the frontend proxy (port 5173/3000) or directly to backend (port 8080)
  // We'll target port 8080 directly here for robustness, or 3000 if proxied.
  const targetPort = 8080;
  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: '/api/gps',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`[Ping ${index + 1}/${path.length}] Sent coordinate (${point.lat}, ${point.lng}) | Status: ${res.statusCode}`);
      if (res.statusCode !== 200) {
        console.log(`Response: ${data}`);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`[Error] Failed to connect to server on port ${targetPort}: ${e.message}`);
    console.log("Make sure your backend server is running (e.g., via 'pnpm run dev' or starting the backend server).");
  });

  req.write(payload);
  req.end();

  index++;
}

console.log(`Starting real-time GPS simulation for vehicle ${plateNumber}...`);
console.log(`Sending pings every ${intervalMs / 1000} seconds. Press Ctrl+C to stop.`);
setInterval(sendPing, intervalMs);
sendPing();
