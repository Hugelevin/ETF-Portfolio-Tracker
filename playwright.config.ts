import { defineConfig, devices } from "@playwright/test";

const localExecutablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    ...(localExecutablePath ? { launchOptions: { executablePath: localExecutablePath } } : {}),
  },
  webServer: { command: `node node_modules/vite/bin/vite.js preview --configLoader runner --host 127.0.0.1 --port ${port}`, port, reuseExistingServer: !process.env.CI },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    {
      name: "ios-webkit",
      fullyParallel: false,
      grep: /does not draw black chart boxes|does not overflow on the narrowest supported phone|keeps the purchase date aligned on tablet|uses consistent full-screen mobile modals/,
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
});
