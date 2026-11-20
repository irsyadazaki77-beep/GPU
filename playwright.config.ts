import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

const containerHeadlessShell =
  '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
const hasContainerChromium = fs.existsSync(containerHeadlessShell);

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(hasContainerChromium
        ? { executablePath: containerHeadlessShell }
        : {}),
      headless: true,
      chromiumSandbox: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  webServer: {
    command: 'NODE_ENV=production node dist-server/server.js',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
