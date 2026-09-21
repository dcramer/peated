import config from "@peated/server/config";
import {
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { z } from "zod";

// Sign in with Apple identity tokens are RS256 JWTs signed with these keys.
// https://developer.apple.com/documentation/signinwithapple/verifying-a-user
export const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = new URL("https://appleid.apple.com/auth/keys");

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
