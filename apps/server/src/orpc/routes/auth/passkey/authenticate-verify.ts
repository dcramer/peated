import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { passkeys, users } from "@peated/server/db/schema";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { createAccessToken, verifyChallenge } from "@peated/server/lib/auth";
import {
  ClientDataJSONSchema,
  expectedOrigin,
  rpID,
} from "@peated/server/lib/passkey";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { AuthSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(authRateLimit)
  .route({
    method: "POST",
    path: "/auth/passkey/authenticate/verify",
    summary: "Verify passkey authentication",
    description: "Verify WebAuthn passkey authentication response and log in",
    spec: (spec) => ({
      ...spec,
      operationId: "passkeyAuthenticateVerify",
    }),
  })
  .input(
    z.object({
      response: z
        .custom<AuthenticationResponseJSON>()
        .describe("WebAuthn authentication response"),
      signedChallenge: z.string().describe("Signed challenge from options"),
      tosAccepted: z
        .boolean()
        .optional()
        .describe("User accepted Terms of Service"),
    }),
  )
  .output(AuthSchema)
  .handler(async function ({ input, context, errors }) {
    const response = input.response;

    // Extract and validate challenge from client data JSON
    // Safe property access - the full validation happens in verifyAuthenticationResponse below
    const clientDataJSONBase64 = response?.response?.clientDataJSON;
    if (!clientDataJSONBase64) {
      throw errors.BAD_REQUEST({
        message: "Missing clientDataJSON in credential response",
      });
    }

    let clientDataJSON;
    try {
      const rawJSON = JSON.parse(
        Buffer.from(clientDataJSONBase64, "base64").toString(),
      );
      clientDataJSON = ClientDataJSONSchema.parse(rawJSON);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw errors.BAD_REQUEST({
          message: `Invalid client data: ${err.errors.map((e) => e.message).join(", ")}`,
        });
      }
      throw errors.BAD_REQUEST({
        message: "Invalid client data JSON format",
      });
    }

    const challenge = clientDataJSON.challenge;

    // Verify the signed challenge to prevent tampering and replay attacks
    try {
      await verifyChallenge(input.signedChallenge, challenge);
    } catch (err: any) {
      auditLog({
        event: AuditEvent.INVALID_CHALLENGE,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { type: "passkey_auth", error: err.message },
      });
      throw errors.UNAUTHORIZED({
        message: err.message || "Invalid challenge",
      });
    }

    // Get the passkey by credential ID
    // response.id is a base64url string from the browser
    const credentialId = response?.id;
    if (!credentialId) {
      throw errors.BAD_REQUEST({
        message: "Missing credential ID in response",
      });
    }

    const [passkey] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.credentialId, credentialId));

    if (!passkey) {
      throw new ORPCError("NOT_FOUND", {
        message:
          "No account found for this passkey. The passkey may have been registered with a different account, or the account may have been deleted.",
        data: { code: "PASSKEY_NOT_FOUND" },
      });
    }

    // Get the user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, passkey.userId));

    if (!user) {
      throw errors.UNAUTHORIZED({
        message: "Invalid credentials.",
      });
    }

    // Verify the authentication response
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: Buffer.from(passkey.publicKey, "base64url"),
          counter: Number(passkey.counter),
          transports: passkey.transports as any,
        },
      });
    } catch (error) {
      auditLog({
        event: AuditEvent.PASSKEY_AUTH_FAILED,
        userId: user.id,
        metadata: { reason: "verification_failed", passkeyId: passkey.id },
      });
      throw errors.UNAUTHORIZED({
        message: "Failed to verify passkey authentication",
      });
    }

    const { verified, authenticationInfo } = verification;

    if (!verified) {
      throw errors.UNAUTHORIZED({
        message: "Failed to verify passkey authentication",
      });
    }

    // Validate counter to prevent replay attacks
    // Some authenticators (especially platform/synced passkeys) don't support counters
    // and always return 0. We only validate when both counters are meaningful.
    const storedCounter = Number(passkey.counter);
    const newCounter = authenticationInfo.newCounter;

    // Skip counter validation if authenticator doesn't support counters (returns 0)
    // or if this is the first use of a passkey that was registered with counter 0
    const shouldValidateCounter = newCounter > 0 || storedCounter > 0;

    if (shouldValidateCounter && newCounter <= storedCounter) {
      auditLog({
        event: AuditEvent.REPLAY_ATTACK_DETECTED,
        userId: user.id,
        metadata: {
          passkeyId: passkey.id,
          oldCounter: storedCounter,
          newCounter: newCounter,
        },
      });
      throw errors.UNAUTHORIZED({
        message:
          "Passkey counter validation failed. Possible replay attack detected.",
      });
    }

    // Update the counter and last used time
    // For authenticators without counter support (counter=0), we still update lastUsedAt
    const updateCondition = shouldValidateCounter
      ? and(
          eq(passkeys.id, passkey.id),
          sql`${passkeys.counter} < ${newCounter}`,
        )
      : eq(passkeys.id, passkey.id);

    const [updated] = await db
      .update(passkeys)
      .set({
        counter: newCounter,
        lastUsedAt: sql`NOW()` as unknown as Date,
      })
      .where(updateCondition)
      .returning();

    if (!updated && shouldValidateCounter) {
      // Counter was updated by another request between our check and update
      auditLog({
        event: AuditEvent.REPLAY_ATTACK_DETECTED,
        userId: user.id,
        metadata: {
          passkeyId: passkey.id,
          reason: "concurrent_update",
        },
      });
      throw errors.UNAUTHORIZED({
        message:
          "Passkey counter validation failed. Possible replay attack detected.",
      });
    }

    // Check if user is active
    if (!user.active) {
      auditLog({
        event: AuditEvent.PASSKEY_AUTH_FAILED,
        userId: user.id,
        metadata: { reason: "inactive_account" },
      });
      throw errors.UNAUTHORIZED({
        message: "Invalid credentials.",
      });
    }

    auditLog({
      event: AuditEvent.PASSKEY_AUTH_SUCCESS,
      userId: user.id,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { passkeyId: passkey.id },
    });

    // Handle ToS acceptance
    if (!user.termsAcceptedAt) {
      if (input.tosAccepted) {
        const [updated] = await db
          .update(users)
          .set({ termsAcceptedAt: sql`NOW()` as unknown as Date })
          .where(
            and(eq(users.id, user.id), sql`${users.termsAcceptedAt} IS NULL`),
          )
          .returning();

        // If update didn't match (race condition - another request already accepted ToS),
        // fetch the updated user
        const updatedUser =
          updated ||
          (await db
            .select()
            .from(users)
            .where(eq(users.id, user.id))
            .then((rows) => rows[0]));

        return {
          user: await serialize(UserSerializer, updatedUser, updatedUser),
          accessToken: await createAccessToken(updatedUser),
        };
      }
      throw new ORPCError("FORBIDDEN", {
        message: "You must accept the Terms of Service.",
      });
    }

    return {
      user: await serialize(UserSerializer, user, user),
      accessToken: await createAccessToken(user),
    };
  });
