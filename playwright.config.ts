import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests', // Hier suchen wir nach Testdateien
  fullyParallel: true,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:4200', // Deine Angular-App-Adresse
    trace: 'on-first-retry',
  },

  /* 🎯 Nur Chrome wird registriert */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }, 
    },
  ],
});