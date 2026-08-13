import { describe, expect, test } from "vitest";
import {
  DEFAULT_OAUTH_CLIENT_ID,
  normalizeServerUrl,
  resolveOAuthClientId,
} from "./config";

describe("resolveOAuthClientId", () => {
  test("uses the flag, environment override, then checked-in public client", () => {
    expect(
      resolveOAuthClientId("flag-client", {
        PEATED_OAUTH_CLIENT_ID: "env-client",
      }),
    ).toBe("flag-client");
    expect(
      resolveOAuthClientId(undefined, {
        PEATED_OAUTH_CLIENT_ID: "env-client",
      }),
    ).toBe("env-client");
    expect(resolveOAuthClientId(undefined, {})).toBe(DEFAULT_OAUTH_CLIENT_ID);
  });
});

describe("normalizeServerUrl", () => {
  test.each([
    ["https://api.peated.com/", "https://api.peated.com"],
    ["http://localhost:3200/", "http://localhost:3200"],
    ["http://127.0.0.1:3200", "http://127.0.0.1:3200"],
  ])("normalizes an allowed server URL", (input, expected) => {
    expect(normalizeServerUrl(input)).toBe(expected);
  });

  test.each([
    "http://api.peated.com",
    "https://user@example.com",
    "https://api.peated.com/base",
    "https://api.peated.com?token=secret",
  ])("rejects an unsafe server URL", (input) => {
    expect(() => normalizeServerUrl(input)).toThrow();
  });
});
