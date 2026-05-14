import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: '../.planning/screenshots',
  reporter: [['list'], ['html', { outputFolder: '../.planning/pw-report', open: 'never' }]],
  timeout: 30000,
});
