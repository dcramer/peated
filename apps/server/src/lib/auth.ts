import { hashSync } from "bcrypt";
import { eq } from "drizzle-orm";
import jsonwebtoken from "jsonwebtoken";
import { z } from "zod";
import config from "../config";
import type { AnyDatabase } from "../db";
import { db } from "../db";
import type { NewUser, User } from "../db/schema";
import { users } from "../db/schema";
import { random } from "../lib/rand";
import { serialize } from "../serializers";
import { UserSerializer } from "../serializers/user";
import { sendVerificationEmail } from "./email";
import { logWarn } from "./log";
import { absoluteUrl } from "./urls";

const TokenDataSchema = z.record(z.string(), z.json());
const UserTokenSchema = z.object({ id: z.number().int().positive() });
const ChallengeTokenSchema = z.object({
  challenge: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;

export const TOKEN_LIFETIME_SECONDS = {
  access: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  "magic-link": 10 * 60,
  recovery: 10 * 60,
  "email-verification": 7 * 24 * 60 * 60,
  "webauthn-challenge": 10 * 60,
  "photo-identification-create": 7 * 24 * 60 * 60,
} as const;

type TokenPurpose = keyof typeof TOKEN_LIFETIME_SECONDS;

/** Creates a signed token with the lifetime assigned to its purpose. */
export async function signToken(
  payload: z.infer<typeof TokenDataSchema>,
  purpose: TokenPurpose,
): Promise<string> {
  return jsonwebtoken.sign(payload, config.JWT_SECRET, {
    audience: purpose,
    expiresIn: TOKEN_LIFETIME_SECONDS[purpose],
  });
}

/** Checks the signature, expiration, and purpose before returning the token's data. */
export async function verifyToken(token: string, purpose: TokenPurpose) {
  // Account access rule: a token may only be used for its signed purpose (`aud`).
  const payload = jsonwebtoken.verify(token, config.JWT_SECRET, {
    audience: purpose,
  });
  return TokenDataSchema.parse(payload);
}

export async function getUserFromHeader(
  authorizationHeader: string | undefined,
): Promise<User | null> {
  const token = authorizationHeader?.replace(/^Bearer /i, "");
  if (!token) return null;

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token, "access");
  } catch {
    logWarn("Invalid Bearer token", {});
    return null;
  }

  const parsedPayload = UserTokenSchema.safeParse(payload);
  if (!parsedPayload.success) {
    logWarn("Invalid Bearer token", {});
    return null;
  }
  const { id } = parsedPayload.data;
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) {
    logWarn("Token user not found", {
      extra: {
        userId: id,
      },
    });
    return null;
  }

  if (!user.active) {
    logWarn("Inactive user found for token", {
      extra: {
        userId: id,
      },
    });
    return null;
  }

  return user;
}

export async function createAccessToken(user: User): Promise<string> {
  const payload = await serialize(UserSerializer, user, user);
  return await signToken(payload, "access");
}

// OWASP recommends 10+ rounds for bcrypt
const BCRYPT_ROUNDS = 10;

export function generatePasswordHash(password: string) {
  return hashSync(password, BCRYPT_ROUNDS);
}

export async function createUser(
  db: AnyDatabase,
  data: NewUser,
): Promise<User> {
  let user: User | undefined;
  let attempt = 0;
  const baseUsername = data.username.toLowerCase();
  let currentUsername = baseUsername;
  if (currentUsername === "me")
    currentUsername = `${baseUsername}-${random(10000, 99999)}`;
  const maxAttempts = 5;
  while (!user && attempt < maxAttempts) {
    attempt += 1;

    try {
      user = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            verified: !!config.SKIP_EMAIL_VERIFICATION,
            ...data,
            username: currentUsername,
          })
          .returning();
        return user;
      });
    } catch (err: any) {
      if (err?.code === "23505" && err?.constraint === "user_username_unq") {
        currentUsername = `${baseUsername}-${random(10000, 99999)}`;
      } else {
        throw err;
      }
    }
  }

  if (!user) throw new Error("Unable to create user");

  if (!user.verified) {
    await sendVerificationEmail({ user });
  } else {
    logWarn("Skipping email verification for {email}", {
      extra: {
        email: user.email,
      },
    });
  }

  return user;
}

export async function generateMagicLink(user: User, redirectTo = "/") {
  const token = {
    id: user.id,
    email: user.email,
    createdAt: new Date().toISOString(),
  };

  const signedToken = await signToken(token, "magic-link");
  const url = absoluteUrl(
    config.URL_PREFIX,
    `/auth/magic-link?token=${signedToken}&redirectTo=${encodeURIComponent(redirectTo)}`,
  );

  return {
    token: signedToken,
    url,
  };
}

/** Signs a passkey challenge that expires in ten minutes. */
export async function signChallenge(challenge: string): Promise<string> {
  const payload = {
    challenge,
    createdAt: new Date().toISOString(),
  };
  return await signToken(payload, "webauthn-challenge");
}

/** Rejects expired, modified, or mismatched passkey challenges. */
export async function verifyChallenge(
  signedChallenge: string,
  expectedChallenge: string,
): Promise<void> {
  let payload: z.infer<typeof ChallengeTokenSchema>;
  try {
    payload = ChallengeTokenSchema.parse(
      await verifyToken(signedChallenge, "webauthn-challenge"),
    );
  } catch (err) {
    throw new Error("Challenge signature is invalid or has expired", {
      cause: err,
    });
  }

  if (payload.challenge !== expectedChallenge) {
    throw new Error("Challenge does not match");
  }

  const createdAt = new Date(payload.createdAt).getTime();
  if (
    Date.now() - createdAt >
    TOKEN_LIFETIME_SECONDS["webauthn-challenge"] * 1000
  ) {
    throw new Error("Challenge expired");
  }
}
