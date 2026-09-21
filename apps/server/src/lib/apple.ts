import config from "@peated/server/config";
import {
  createRemoteJWKSet,
  importPKCS8,
  errors as joseErrors,
  jwtVerify,
  SignJWT,
  type JWTVerifyGetKey,
} from "jose";
import { z } from "zod";

// Sign in with Apple identity tokens are RS256 JWTs signed with these keys.
// https://developer.apple.com/documentation/signinwithapple/verifying-a-user
export const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = new URL("https://appleid.apple.com/auth/keys");
// Token exchange and revocation.
// https://developer.apple.com/documentation/signinwithapple/revoke-tokens
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

let remoteKeys: JWTVerifyGetKey | undefined;

function appleKeys(): JWTVerifyGetKey {
  remoteKeys ??= createRemoteJWKSet(APPLE_KEYS_URL);
  return remoteKeys;
}

// The claims this app reads from Apple's identity token.
const AppleClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  // Apple sends this claim as a boolean or the string "true".
  email_verified: z.union([z.boolean(), z.string()]).optional(),
});

export type AppleIdentity = {
  /** Apple's stable user ID. It does not change across sign-ins. */
  sub: string;
  /** The user's email or a private relay address. */
  email: string | null;
  emailVerified: boolean;
};

/** The token is not a valid, current Apple identity token for this app. */
export class AppleIdentityTokenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AppleIdentityTokenError";
  }
}

export type VerifyAppleIdentityTokenOptions = {
  /** Accepted audiences. Defaults to `APPLE_CLIENT_IDS`. */
  clientIds?: string[];
  /** Key lookup. Defaults to Apple's published keys. */
  getKey?: JWTVerifyGetKey;
};

export async function verifyAppleIdentityToken(
  identityToken: string,
  {
    clientIds = config.APPLE_CLIENT_IDS,
    getKey = appleKeys(),
  }: VerifyAppleIdentityTokenOptions = {},
): Promise<AppleIdentity> {
  if (clientIds.length === 0) {
    throw new Error("No Apple client IDs configured.");
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(identityToken, getKey, {
      issuer: APPLE_ISSUER,
      audience: clientIds,
      algorithms: ["RS256"],
      // Limit replay of a leaked token. Apple issues tokens for 10 minutes.
      maxTokenAge: "5 minutes",
      clockTolerance: 30,
    }));
  } catch (err) {
    if (err instanceof joseErrors.JOSEError) {
      throw new AppleIdentityTokenError("Invalid Apple identity token.", {
        cause: err,
      });
    }
    throw err;
  }

  const claims = AppleClaimsSchema.safeParse(payload);
  if (!claims.success) {
    throw new AppleIdentityTokenError("Apple identity token has bad claims.", {
      cause: claims.error,
    });
  }

  return {
    sub: claims.data.sub,
    email: claims.data.email ?? null,
    emailVerified:
      claims.data.email_verified === true ||
      claims.data.email_verified === "true",
  };
}

export type AppleRevocationConfig = {
  /** The client ID the app signed in with, normally the iOS bundle ID. */
  clientId: string;
  teamId: string;
  keyId: string;
  /** PKCS8 PEM contents of the Sign in with Apple `.p8` key. */
  privateKey: string;
};

/**
 * Reads the Sign in with Apple server credentials. Returns null when any
 * value is missing, so revocation is unavailable rather than half configured.
 */
export function getAppleRevocationConfig(): AppleRevocationConfig | null {
  const clientId = config.APPLE_CLIENT_IDS[0];
  if (
    !clientId ||
    !config.APPLE_TEAM_ID ||
    !config.APPLE_KEY_ID ||
    !config.APPLE_PRIVATE_KEY
  ) {
    return null;
  }
  return {
    clientId,
    teamId: config.APPLE_TEAM_ID,
    keyId: config.APPLE_KEY_ID,
    privateKey: config.APPLE_PRIVATE_KEY,
  };
}

/**
 * Signs the client secret Apple's token endpoints require: an ES256 JWT from
 * the team, signed with the app's Sign in with Apple key.
 * https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
 */
export async function createAppleClientSecret(
  { clientId, teamId, keyId, privateKey }: AppleRevocationConfig,
  now = new Date(),
): Promise<string> {
  const key = await importPKCS8(privateKey, "ES256");
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 5 * 60)
    .setAudience(APPLE_ISSUER)
    .setSubject(clientId)
    .sign(key);
}

/** Apple did not complete the token exchange or revocation. */
export class AppleRevocationError extends Error {
  /** True when Apple or the network failed and the same code may work later. */
  retryable: boolean;

  constructor(
    message: string,
    options: { retryable: boolean; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "AppleRevocationError";
    this.retryable = options.retryable;
  }
}

const AppleTokenResponseSchema = z.object({
  access_token: z.string().min(1).optional(),
  refresh_token: z.string().min(1).optional(),
});

const AppleErrorResponseSchema = z.object({ error: z.string() });

// Apple's revoke endpoint returns an empty body.
const AppleEmptyResponseSchema = z.json();

const JsonSchema = z.json();

export type RevokeAppleAuthorizationOptions = {
  /** Server credentials. Defaults to the configured values. */
  config?: AppleRevocationConfig | null;
  /** HTTP client. Defaults to global `fetch`. */
  fetch?: typeof fetch;
};

/**
 * Exchanges a Sign in with Apple authorization code for the member's tokens
 * and revokes them. Apple requires this when an account that used Sign in
 * with Apple is deleted. The code is single-use and expires five minutes after
 * the app receives it, so the client obtains a fresh one right before calling.
 */
export async function revokeAppleAuthorization(
  authorizationCode: string,
  {
    config: revocationConfig = getAppleRevocationConfig(),
    fetch: fetchImpl = fetch,
  }: RevokeAppleAuthorizationOptions = {},
): Promise<void> {
  if (!revocationConfig) {
    throw new Error(
      "Sign in with Apple server credentials are not configured.",
    );
  }

  const clientSecret = await createAppleClientSecret(revocationConfig);

  const tokens = await postAppleForm(
    fetchImpl,
    APPLE_TOKEN_URL,
    {
      client_id: revocationConfig.clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: "authorization_code",
    },
    AppleTokenResponseSchema,
  );
  const token = tokens.refresh_token ?? tokens.access_token;
  if (!token) {
    throw new AppleRevocationError("Apple returned no token to revoke.", {
      retryable: false,
    });
  }

  await postAppleForm(
    fetchImpl,
    APPLE_REVOKE_URL,
    {
      client_id: revocationConfig.clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
    },
    AppleEmptyResponseSchema,
  );
}

/** The JSON body of an Apple response, or null when it is empty or malformed. */
function parseJsonBody(text: string): z.infer<typeof JsonSchema> | null {
  if (!text) return null;
  try {
    return JsonSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

async function postAppleForm<T>(
  fetchImpl: typeof fetch,
  url: string,
  fields: Record<string, string>,
  responseSchema: z.ZodType<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    });
  } catch (cause) {
    throw new AppleRevocationError("Apple could not be reached.", {
      retryable: true,
      cause,
    });
  }

  const body = parseJsonBody(await response.text());

  if (!response.ok) {
    // Apple reports a bad or reused code as a 400 with an `error` field.
    const error = AppleErrorResponseSchema.safeParse(body);
    const reason = error.success ? error.data.error : `HTTP ${response.status}`;
    throw new AppleRevocationError(`Apple rejected the request: ${reason}.`, {
      retryable: response.status >= 500,
    });
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppleRevocationError("Apple returned an unexpected response.", {
      retryable: false,
      cause: parsed.error,
    });
  }
  return parsed.data;
}
