const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'apps/frontend/vite.config.ts');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import VitePWA
if (!content.includes('vite-plugin-pwa')) {
  content = content.replace(
    /import runtimeErrorOverlay from "@replit\/vite-plugin-runtime-error-modal";/,
    'import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";\nimport { VitePWA } from "vite-plugin-pwa";'
  );
}

// 2. Add VitePWA to plugins
if (!content.includes('VitePWA(')) {
  const pwaConfig = `
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'CleanOrbit Tracking',
        short_name: 'CleanOrbit',
        description: 'School Bus Tracking System',
        theme_color: '#f59e0b',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    }),`;
    
  content = content.replace(
    /plugins: \[/,
    'plugins: [' + pwaConfig
  );
}

fs.writeFileSync(file, content);
console.log('vite.config.ts updated for PWA!');
