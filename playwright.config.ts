import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  // Keep browser load deterministic on Windows, and let Playwright own the
  // API and Vite processes separately so it can stop each server cleanly.
  workers: 1,
  fullyParallel: true,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3001",
    channel: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node dist/server.js",
      cwd: "apps/api",
      url: "http://127.0.0.1:3002/api/status",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3001",
      cwd: "apps/web",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
