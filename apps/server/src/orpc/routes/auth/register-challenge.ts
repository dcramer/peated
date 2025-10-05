import { generatePasskeyChallenge } from "@peated/server/lib/passkey";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import { createHash } from "crypto";
import { z } from "zod";

export default procedure
  .use(authRateLimit)
  .route({
    method: "POST",
    path: "/auth/register-challenge",
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
      username: z.string().describe("Username for the new account"),
      email: z
        .string()
        .email()
        .toLowerCase()
        .describe("Email for the new account"),
    }),
  )
  .output(
    z.object({
      options: z.any(),
      signedChallenge: z.string(),
    }),
  )
  .handler(async function ({ input }) {
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
