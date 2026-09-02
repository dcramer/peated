import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.STORYBOOK_URL ?? "http://127.0.0.1:6007";

export default defineConfig({
  testDir: "./visual",
  testMatch: "storybook.playwright.ts",
  outputDir: ".playwright/storybook-results",
  timeout: 10 * 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  expect: {
    timeout: 60_000,
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    colorScheme: "light",
    contextOptions: { reducedMotion: "reduce" },
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "America/Los_Angeles",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: process.env.STORYBOOK_URL
    ? undefined
    : {
        command: "pnpm storybook:preview",
        reuseExistingServer: false,
        timeout: 30_000,
        url: `${baseURL}/index.json`,
      },
});
