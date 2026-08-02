import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PKCE_VALUE_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const LOOPBACK_REDIRECT_PATTERN =
  /^http:\/\/(127\.0\.0\.1|\[::1\])(?::[0-9]+)?(?=\/|\?|$)/;
const URI_USERINFO_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*@/;

function hasDisallowedRedirectSyntax(value: string, url: URL): boolean {
  return (
    value.includes("#") ||
    URI_USERINFO_PATTERN.test(value) ||
    url.hostname.includes("*")
  );
}

function loopbackRedirectComparisonValue(value: string): string | null {
  const match = LOOPBACK_REDIRECT_PATTERN.exec(value);
  if (!match) return null;

  return `http://${match[1]}${value.slice(match[0].length)}`;
}

export function generateOAuthClientId(): string {
  return randomBytes(18).toString("base64url");
}

export function generateAuthorizationCode(): string {
  return randomBytes(32).toString("base64url");
}

export function digestAuthorizationCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function createS256CodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function isValidPkceVerifier(verifier: string): boolean {
  return PKCE_VALUE_PATTERN.test(verifier);
}

export function isValidS256CodeChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

export function verifyS256CodeChallenge(
  verifier: string,
  expectedChallenge: string,
): boolean {
  if (!isValidPkceVerifier(verifier)) return false;

  const actual = Buffer.from(createS256CodeChallenge(verifier));
  const expected = Buffer.from(expectedChallenge);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseRegisteredRedirectUri(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (hasDisallowedRedirectSyntax(value, url)) {
    return null;
  }

  const isLoopback = loopbackRedirectComparisonValue(value) !== null;
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    return null;
  }

  return url;
}

export function isRegisteredRedirectUri(
  requestedValue: string,
  registeredValues: string[],
): boolean {
  let requested: URL;
  try {
    requested = new URL(requestedValue);
  } catch {
    return false;
  }

  if (hasDisallowedRedirectSyntax(requestedValue, requested)) return false;

  return registeredValues.some((registeredValue) => {
    const registered = parseRegisteredRedirectUri(registeredValue);
    if (!registered) return false;
    if (requestedValue === registeredValue) return true;

    const registeredComparison =
      loopbackRedirectComparisonValue(registeredValue);
    const requestedComparison = loopbackRedirectComparisonValue(requestedValue);
    // Compare raw URI text so URL normalization cannot widen this exception.
    return (
      registeredComparison !== null &&
      requestedComparison !== null &&
      requestedComparison === registeredComparison
    );
  });
}
