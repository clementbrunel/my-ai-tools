import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  snapshotDir: './tests/visual/__snapshots__',
  updateSnapshots: 'none',
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    // Disable animations for stable screenshots
    launchOptions: {
      args: ['--disable-web-animations'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
