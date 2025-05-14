import { ORPCError } from "@orpc/server";
import { sendVerificationEmail } from "@peated/server/lib/email";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({ method: "POST", path: "/email/resend-verification" })
  .input(z.void())
  .output(z.object({}))
  .handler(async function ({ context: { user } }) {
    if (user.verified) {
      throw new ORPCError("CONFLICT", {
        message: "Account already verified",
      });
    }

    await sendVerificationEmail({ user });

    return {};
  });
