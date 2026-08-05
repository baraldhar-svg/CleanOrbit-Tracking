const sharp = require('sharp');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../apps/frontend/public');

const svgCode = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="100" fill="#000000"/>
  <text x="256" y="350" font-family="Arial, sans-serif" font-size="280" font-weight="900" text-anchor="middle">
    <tspan fill="#FFFFFF">O</tspan><tspan fill="#f59e0b">T</tspan>
  </text>
</svg>
`;

async function generate() {
  const svgBuffer = Buffer.from(svgCode);

  await sharp(svgBuffer)
    .resize(192, 192)
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('icon-192.png created');

  await sharp(svgBuffer)
    .resize(512, 512)
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('icon-512.png created');
  
  await sharp(svgBuffer)
    .resize(180, 180)
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('apple-touch-icon.png created');

  await QRCode.toFile(path.join(publicDir, 'download-qr.png'), 'https://orbitbustrack.com', {
    width: 512,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
  console.log('download-qr.png created');
}

generate().catch(console.error);
