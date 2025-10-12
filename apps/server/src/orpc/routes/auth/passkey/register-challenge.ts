import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import { generatePasskeyChallenge } from "@peated/server/lib/passkey";
import { procedure } from "@peated/server/orpc";
import { authRateLimit, requireAuth } from "@peated/server/orpc/middleware";
import type {
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(authRateLimit)
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/auth/passkey/register/challenge",
    summary: "Generate passkey registration challenge",
    description: "Generate challenge for WebAuthn passkey registration",
    spec: (spec) => ({
      ...spec,
      operationId: "passkeyRegisterChallenge",
    }),
  })
  .input(z.object({}))
  .output(
    z.object({
      options: z.custom<PublicKeyCredentialCreationOptionsJSON>(),
      signedChallenge: z.string(),
    }),
  )
  .handler(async function ({ context }) {
    const user = context.user;

    // Get existing passkeys for this user to exclude them
    const existingPasskeys = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.userId, user.id));

    return await generatePasskeyChallenge({
      username: user.username,
      userDisplayName: user.username,
      userID: user.id,
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as AuthenticatorTransportFuture[] | null,
      })),
    });
  });
