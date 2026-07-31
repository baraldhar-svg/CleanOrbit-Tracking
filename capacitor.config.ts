import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orbitbustracking',
  appName: 'Orbit Bus Tracking',
  webDir: 'out',
  server: {
    url: 'https://www.orbitbustrark.com',
    cleartext: true
  }
};

export default config;