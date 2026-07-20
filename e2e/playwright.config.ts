import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});