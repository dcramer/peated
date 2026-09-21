import { ORPCError } from "@orpc/server";
import config from "@peated/server/config";
import { db, type AnyDatabase } from "@peated/server/db";
import { identities, users, type User } from "@peated/server/db/schema";
import {
  AppleIdentityTokenError,
  verifyAppleIdentityToken,
} from "@peated/server/lib/apple";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { createAccessToken, createUser } from "@peated/server/lib/auth";
import { logError } from "@peated/server/lib/log";
import { implement } from "@peated/server/orpc";
import loginContract from "@peated/server/orpc/contracts/auth/login";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import slugify from "@sindresorhus/slugify";
import { compareSync } from "bcrypt";
import { and, eq, sql } from "drizzle-orm";
import { OAuth2Client, type TokenPayload } from "google-auth-library";

export type LoginServices = {
  verifyAppleIdentityToken: typeof verifyAppleIdentityToken;
};

const defaultServices: LoginServices = {
  verifyAppleIdentityToken,
};

export function createLoginProcedure(
  services: LoginServices = defaultServices,
) {
  return implement(loginContract)
    .use(authRateLimit)
    .handler(async function ({ input, errors }) {
      try {
        const user =
          "code" in input
            ? await authGoogle(input.code, input.tosAccepted)
            : "idToken" in input
              ? await authGoogleIdToken(input.idToken, input.tosAccepted)
              : "appleIdentityToken" in input
                ? await authApple(services, input)
                : await authBasic(input.email, input.password);

        if (!user.active) {
          auditLog({
            event: AuditEvent.LOGIN_FAILED,
            userId: user.id,
            metadata: { reason: "inactive_account" },
          });
          throw errors.UNAUTHORIZED({
            message: "Invalid credentials.",
          });
        }

        auditLog({
          event: AuditEvent.LOGIN_SUCCESS,
          userId: user.id,
        });

        return {
          user: await serialize(UserSerializer, user, user),
          accessToken: await createAccessToken(user),
        };
      } catch (error) {
        // Re-throw ORPC errors as-is (they're already properly formatted)
        if (error instanceof ORPCError) {
          throw error;
        }

        // Log unexpected errors with minimal context
        logError(error, {
          extra: {
            name: "auth/login",
          },
        });

        throw errors.INTERNAL_SERVER_ERROR({
          message: "An error occurred during authentication",
        });
      }
    });
}

export default createLoginProcedure();

async function authBasic(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()));
  if (!user) {
    auditLog({
      event: AuditEvent.LOGIN_FAILED,
      metadata: { email, reason: "user_not_found" },
    });
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid credentials.",
    });
  }

  if (!user.passwordHash) {
    auditLog({
      event: AuditEvent.LOGIN_FAILED,
      userId: user.id,
      metadata: { reason: "no_password" },
    });
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid credentials.",
    });
  }

  if (!compareSync(password, user.passwordHash)) {
    auditLog({
      event: AuditEvent.LOGIN_FAILED,
      userId: user.id,
      metadata: { reason: "invalid_password" },
    });
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid credentials.",
    });
  }

  return user;
}

async function authGoogle(code: string, tosAccepted?: boolean) {
  // https://stackoverflow.com/questions/74132586/authentication-using-node-js-oauthclient-auth-code-flow
  const client = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    "postmessage",
  );

  const { tokens } = await client.getToken(code);

  if (!tokens.id_token) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Unable to validate credentials.",
    });
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.GOOGLE_CLIENT_ID,
  });

  return authExternalIdentity(googleIdentity(ticket.getPayload()), tosAccepted);
}

async function authGoogleIdToken(idToken: string, tosAccepted?: boolean) {
  // Build array of valid client IDs
  const validClientIds = [
    config.GOOGLE_CLIENT_ID,
    ...config.GOOGLE_CLIENT_IDS,
  ].filter((id): id is string => Boolean(id));

  if (validClientIds.length === 0) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "No Google client IDs configured.",
    });
  }

  const client = new OAuth2Client();

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: validClientIds, // Can be string or array
    });
  } catch (error) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid ID token.",
    });
  }

  const payload = ticket?.getPayload();

  // Validate issued-at time to prevent old token replay
  if (!payload?.iat) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Token missing issued-at claim.",
    });
  }

  const currentTime = Math.floor(Date.now() / 1000);

  // Reject tokens older than 5 minutes (300 seconds) to limit replay window
  const maxTokenAge = 300;
  if (currentTime - payload.iat > maxTokenAge) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Token is too old.",
    });
  }

  // Reject tokens issued in the future (allow 30 second clock skew)
  const clockSkewTolerance = 30;
  if (payload.iat > currentTime + clockSkewTolerance) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Token issued in the future.",
    });
  }

  return authExternalIdentity(googleIdentity(payload), tosAccepted);
}

function googleIdentity(payload: TokenPayload | undefined): ExternalIdentity {
  if (!payload || !payload.email) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Unable to validate credentials.",
    });
  }
  return {
    provider: "google",
    externalId: payload.sub,
    email: payload.email,
    // Emails are verified when coming from Google.
    emailVerified: true,
    username: usernameFromEmail(payload.email),
  };
}

async function authApple(
  services: LoginServices,
  input: {
    appleIdentityToken: string;
    fullName?: string;
    tosAccepted?: boolean;
  },
) {
  let identity;
  try {
    identity = await services.verifyAppleIdentityToken(
      input.appleIdentityToken,
    );
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Invalid identity token.",
      });
    }
    throw error;
  }

  if (!identity.email) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Unable to validate credentials.",
    });
  }

  // Apple sends the name only on the first sign-in, and users who hide their
  // email get a random relay address. The name makes a better username seed.
  const username =
    usernameFromName(input.fullName) ?? usernameFromEmail(identity.email);

  return authExternalIdentity(
    {
      provider: "apple",
      externalId: identity.sub,
      email: identity.email,
      emailVerified: identity.emailVerified,
      username,
    },
    input.tosAccepted,
  );
}

function usernameFromEmail(email: string) {
  return email.split("@", 1)[0].toLowerCase();
}

function usernameFromName(name: string | undefined) {
  if (!name) return undefined;
  const username = slugify(name);
  return username.length > 0 ? username : undefined;
}

type ExternalIdentity = {
  provider: "google" | "apple";
  /** The provider's stable user ID. */
  externalId: string;
  email: string;
  emailVerified: boolean;
  /** Username for a new account. `createUser` resolves conflicts. */
  username: string;
};

/**
 * Find the user linked to this identity. Otherwise link it to the verified
 * account with the same email, or create a new account.
 */
async function authExternalIdentity(
  identity: ExternalIdentity,
  tosAccepted?: boolean,
): Promise<User> {
  const [result] = await db
    .select({
      user: users,
    })
    .from(users)
    .innerJoin(identities, eq(users.id, identities.userId))
    .where(
      and(
        eq(identities.provider, identity.provider),
        eq(identities.externalId, identity.externalId),
      ),
    );
  if (result) {
    return acceptTerms(result.user, tosAccepted);
  }

  const [foundUser] = await db
    .select()
    .from(users)
    .where(eq(sql`LOWER(${users.email})`, identity.email.toLowerCase()));
  if (foundUser) {
    // Only link verified emails on both sides so nobody can claim an account
    // by signing up elsewhere with someone else's address.
    if (!foundUser.verified || !identity.emailVerified) {
      throw new ORPCError("UNAUTHORIZED", {
        message:
          "Cannot link to unverified account. Please verify your email first.",
      });
    }
    try {
      await db.insert(identities).values({
        provider: identity.provider,
        externalId: identity.externalId,
        userId: foundUser.id,
      });
    } catch (err: any) {
      // Another request already linked this identity.
      if (err?.code !== "23505" || err?.constraint !== "identity_unq") {
        throw err;
      }
    }
    return acceptTerms(foundUser, tosAccepted);
  }

  return db.transaction(async (tx) => {
    const newUser = await createUser(tx, {
      username: identity.username,
      email: identity.email,
      verified: identity.emailVerified,
    });

    await tx.insert(identities).values({
      provider: identity.provider,
      externalId: identity.externalId,
      userId: newUser.id,
    });

    return acceptTerms(newUser, tosAccepted, tx);
  });
}

async function acceptTerms(
  user: User,
  tosAccepted: boolean | undefined,
  tx: AnyDatabase = db,
): Promise<User> {
  if (user.termsAcceptedAt || !tosAccepted) return user;

  const [updated] = await tx
    .update(users)
    .set({ termsAcceptedAt: sql<Date>`NOW()` })
    .where(and(eq(users.id, user.id), sql`${users.termsAcceptedAt} IS NULL`))
    .returning();
  // Another request may have accepted the terms first.
  return updated || user;
}
