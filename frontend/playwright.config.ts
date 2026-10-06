import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config({ path: '../backend/.env', quiet: true });
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:41735', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w backend',
      cwd: '..',
      url: 'http://127.0.0.1:41731/api/health',
      reuseExistingServer: false,
      env: {
        DATABASE_URL: process.env.TEST_DATABASE_URL || '',
        FRONTEND_URL: 'http://127.0.0.1:41735',
        PORT: '41731',
        JWT_SECRET: process.env.JWT_SECRET || '',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 41735 --strictPort',
      url: 'http://127.0.0.1:41735',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:41731' },
      reuseExistingServer: false,
    },
  ],
});
