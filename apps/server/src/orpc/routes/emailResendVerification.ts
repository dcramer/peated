import { ORPCError } from "@orpc/server";
import { sendVerificationEmail } from "@peated/server/lib/email";
import { z } from "zod";
import { procedure } from "..";
import { requireAuth } from "../middleware";

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
