import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_PORT ?? 3200);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${webPort}`;
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 4999);
const apiServer =
  process.env.PLAYWRIGHT_API_SERVER ?? `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: ".playwright/test-results",
  timeout: 60_000,
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: ".playwright/report" }],
  ],
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "node e2e/mock-rpc-server.mjs",
          env: {
            PLAYWRIGHT_API_PORT: String(apiPort),
          },
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
          url: `${apiServer}/health`,
        },
        {
          command: `pnpm exec next dev -p ${webPort}`,
          env: {
            API_SERVER: apiServer,
            SESSION_SECRET:
              process.env.SESSION_SECRET ??
              "peated-playwright-session-secret-for-local-browser-tests",
            URL_PREFIX: baseURL,
          },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: `${baseURL}/browser-not-supported`,
        },
      ],
});
