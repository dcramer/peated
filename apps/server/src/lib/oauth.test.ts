import {
  createS256CodeChallenge,
  isRegisteredRedirectUri,
  isValidPkceVerifier,
  isValidS256CodeChallenge,
  parseRegisteredRedirectUri,
  verifyS256CodeChallenge,
} from "@peated/server/lib/oauth";
import { describe, expect, test } from "vitest";

const verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

describe("OAuth PKCE helpers", () => {
  test("validates and verifies S256 PKCE values", () => {
    const challenge = createS256CodeChallenge(verifier);

    expect(isValidPkceVerifier(verifier)).toBe(true);
    expect(isValidS256CodeChallenge(challenge)).toBe(true);
    expect(verifyS256CodeChallenge(verifier, challenge)).toBe(true);
    expect(verifyS256CodeChallenge(`${verifier}x`, challenge)).toBe(false);
    expect(isValidPkceVerifier("short")).toBe(false);
  });

  test("matches exact HTTPS and loopback redirects", () => {
    expect(
      isRegisteredRedirectUri("https://tools.peated.com/oauth/callback", [
        "https://tools.peated.com/oauth/callback",
      ]),
    ).toBe(true);
    expect(
      isRegisteredRedirectUri("http://127.0.0.1:49152/callback?source=cli", [
        "http://127.0.0.1/callback?source=cli",
      ]),
    ).toBe(true);
    expect(
      isRegisteredRedirectUri("http://[::1]:49152/callback", [
        "http://[::1]/callback",
      ]),
    ).toBe(true);
  });

  test("rejects redirect changes outside the loopback port exception", () => {
    expect(
      isRegisteredRedirectUri("https://evil.example/oauth/callback", [
        "https://tools.peated.com/oauth/callback",
      ]),
    ).toBe(false);
    expect(
      isRegisteredRedirectUri("http://127.0.0.1:49152/other", [
        "http://127.0.0.1/callback",
      ]),
    ).toBe(false);
    expect(
      isRegisteredRedirectUri("http://localhost:49152/callback", [
        "http://127.0.0.1/callback",
      ]),
    ).toBe(false);
    expect(
      parseRegisteredRedirectUri("https://example.com/callback#fragment"),
    ).toBeNull();
    expect(
      parseRegisteredRedirectUri("https://example.com/callback#"),
    ).toBeNull();
    expect(
      parseRegisteredRedirectUri("https://@example.com/callback"),
    ).toBeNull();
    expect(parseRegisteredRedirectUri("http://2130706433/callback")).toBeNull();
    expect(
      isRegisteredRedirectUri("http://127.1:49152/callback", [
        "http://127.0.0.1/callback",
      ]),
    ).toBe(false);
    expect(
      isRegisteredRedirectUri("http://127.0.0.1:49152/a/../callback", [
        "http://127.0.0.1/callback",
      ]),
    ).toBe(false);
  });
});
