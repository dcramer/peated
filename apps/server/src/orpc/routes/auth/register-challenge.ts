import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { generatePasskeyChallenge } from "@peated/server/lib/passkey";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import { createHash } from "crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(authRateLimit)
  .route({
    method: "POST",
    path: "/auth/register/challenge",
    summary: "Generate registration challenge for new user",
    description:
      "Generate WebAuthn challenge for passkey registration when creating a new account",
    spec: (spec) => ({
      ...spec,
      operationId: "registerChallenge",
    }),
  })
  .input(
    z.object({
      username: z
        .string()
        .toLowerCase()
        .describe("Username for the new account"),
      email: z
        .string()
        .email()
        .toLowerCase()
        .describe("Email for the new account"),
    }),
  )
  .output(
    z.object({
      options: z.custom<PublicKeyCredentialCreationOptionsJSON>(),
      signedChallenge: z.string(),
    }),
  )
  .handler(async function ({ input, errors }) {
    // Avoid creating a device credential that cannot be attached to a new
    // account. The registration transaction still owns the race-safe check.
    const [emailOwner, usernameOwner] = await Promise.all([
      db.query.users.findFirst({
        columns: { id: true },
        where: eq(sql`LOWER(${users.email})`, input.email),
      }),
      db.query.users.findFirst({
        columns: { id: true },
        where: eq(sql`LOWER(${users.username})`, input.username),
      }),
    ]);

    if (emailOwner) {
      throw errors.CONFLICT({
        message: "An account with this email already exists.",
        data: { field: "email" },
      });
    }

    if (usernameOwner) {
      throw errors.CONFLICT({
        message: "An account with this username already exists.",
        data: { field: "username" },
      });
    }

    // Generate a random userID for WebAuthn
    // We use a hash of username+email to ensure consistency if they retry
    const userIdString = `${input.username}:${input.email}`;
    const userID = new Uint8Array(
      createHash("sha256").update(userIdString).digest(),
    );

    return await generatePasskeyChallenge({
      username: input.username,
      userID,
    });
  });
