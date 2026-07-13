import { defineConfig, devices } from "@playwright/test";

const localExecutablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    ...(localExecutablePath ? { launchOptions: { executablePath: localExecutablePath } } : {}),
  },
  webServer: { command: "node node_modules/vite/bin/vite.js preview --configLoader runner --host 127.0.0.1 --port 4173", port: 4173, reuseExistingServer: !process.env.CI },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
