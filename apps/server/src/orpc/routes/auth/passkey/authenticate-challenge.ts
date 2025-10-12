import { signChallenge } from "@peated/server/lib/auth";
import { rpID } from "@peated/server/lib/passkey";
import { procedure } from "@peated/server/orpc";
import { authRateLimit } from "@peated/server/orpc/middleware";
import {
  generateAuthenticationOptions,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { z } from "zod";

export default procedure
  .use(authRateLimit)
  .route({
    method: "POST",
    path: "/auth/passkey/authenticate/challenge",
    summary: "Generate passkey authentication challenge",
    description: "Generate challenge for WebAuthn passkey authentication",
    spec: (spec) => ({
      ...spec,
      operationId: "passkeyAuthenticateChallenge",
    }),
  })
  .input(
    z.object({
      userId: z.number().optional(),
    }),
  )
  .output(
    z.object({
      options: z.custom<PublicKeyCredentialRequestOptionsJSON>(),
      signedChallenge: z.string(),
    }),
  )
  .handler(async function ({ input }) {
    // Note: We don't return user-specific credentials to prevent user enumeration
    // The browser will present all available passkeys, and we validate on verify
    // If userId is provided, we ignore it for security reasons

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      // Don't specify allowCredentials to prevent enumeration
      // The authenticator will present all available passkeys
    });

    // Sign the challenge to prevent tampering and replay attacks
    const signedChallenge = await signChallenge(options.challenge);

    return { options, signedChallenge };
  });
