import { sendVerificationEmail } from "@peated/server/lib/email";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/email/resend-verification",
    summary: "Resend verification email",
    spec: {
      operationId: "resendVerificationEmail",
    },
    description:
      "Resend email verification to the authenticated user's email address",
  })
  .input(z.void())
  .output(z.object({}))
  .handler(async function ({ context: { user }, errors }) {
    if (user.verified) {
      throw errors.CONFLICT({
        message: "Account already verified.",
      });
    }

    await sendVerificationEmail({ user });

    return {};
  });
