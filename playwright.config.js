import { defineConfig } from '@playwright/test';
const port = Number(process.env.QUIZ_TEST_PORT || 24763);
export default defineConfig({ testDir: './e2e', workers: 1, retries: 0, timeout: 30000, expect: { timeout: 7000 }, use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', trace: 'retain-on-failure' }, webServer: { command: 'node server.js', url: `http://127.0.0.1:${port}`, env: { PORT: String(port) }, reuseExistingServer: false, timeout: 30000 } });
