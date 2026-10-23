import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { users, type User } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { TOKEN_LIFETIME_SECONDS, verifyToken } from "@peated/server/lib/auth";
import { PasswordResetSchema } from "@peated/server/schemas";
import { createHash, timingSafeEqual } from "crypto";
import { and, eq, sql } from "drizzle-orm";

type RecoveryRequest = {
  flow: "password_reset" | "passkey";
  ip?: string;
  userAgent?: string;
};

/** Audits a rejected recovery attempt. Never pass the token itself. */
export function auditRecoveryFailure(
  request: RecoveryRequest,
  reason: string,
  userId?: number,
) {
  auditLog({
    event: AuditEvent.RECOVERY_FAILED,
    userId,
    ip: request.ip,
    userAgent: request.userAgent,
    metadata: { flow: request.flow, reason },
  });
}

/**
 * Returns the user a recovery email token belongs to. Rejects bad, expired,
 * and already-used tokens with BAD_REQUEST and audits each rejection.
 */
export async function findRecoveryTokenUser(
  rawToken: string,
  request: RecoveryRequest,
  verify: typeof verifyToken = verifyToken,
): Promise<User> {
  function reject(message: string, reason: string, userId?: number): never {
    auditRecoveryFailure(request, reason, userId);
    throw new ORPCError("BAD_REQUEST", { message });
  }

  let payload;
  try {
    payload = await verify(rawToken, "recovery");
  } catch {
    reject("Invalid verification token.", "invalid_token");
  }

  const token = PasswordResetSchema.parse(payload);
  if (
    new Date(token.createdAt).getTime() <
    Date.now() - TOKEN_LIFETIME_SECONDS["recovery"] * 1000
  ) {
    reject("Token has expired.", "expired_token", token.id);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, token.id),
        eq(sql`LOWER(${users.email})`, token.email.toLowerCase()),
      ),
    );
  if (!user) {
    reject("Invalid verification token.", "user_not_found", token.id);
  }

  // Recovery tokens are single-use: the digest covers the current password
  // hash, and both recovery flows replace that hash on success.
  const expectedDigest = createHash("sha256")
    .update(user.passwordHash || "")
    .digest();
  const providedDigest = Buffer.from(token.digest, "hex");
  if (
    expectedDigest.length !== providedDigest.length ||
    !timingSafeEqual(expectedDigest, providedDigest)
  ) {
    reject("Invalid verification token.", "stale_token", user.id);
  }

  return user;
}
