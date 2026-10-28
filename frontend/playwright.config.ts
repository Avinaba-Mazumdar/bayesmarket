import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env['CI'];

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:4200',
        trace: 'on-first-retry'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: {
        command: 'pnpm start --port 4200',
        url: 'http://localhost:4200',
        reuseExistingServer: !isCI,
        timeout: 180_000
    }
});
