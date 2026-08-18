import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tebmanagement.student',
  appName: 'TEB Student',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
