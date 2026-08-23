import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.EXTRA_CREDIT_E2E_BASE_URL;

if (baseURL === undefined || baseURL.length === 0) {
  throw new Error(
    "EXTRA_CREDIT_E2E_BASE_URL must be supplied by tests/e2e/server-harness.mjs.",
  );
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: "test-results",
  reporter: process.env.CI === "true" ? "github" : "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
