import { expect, onTestFinished, vi } from "vitest";

/**
 * Runs the rest of the current test with the Node process in `timeZone`.
 *
 * Production and CI run on UTC, so this is how a test catches dates that are
 * sent to PostgreSQL in local time.
 */
export function setTestTimeZone(timeZone: string) {
  vi.stubEnv("TZ", timeZone);
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  expect(new Date().getTimezoneOffset()).not.toBe(0);
}
