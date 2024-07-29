import { sendVerificationEmail } from "@peated/server/lib/email";
import { TRPCError } from "@trpc/server";
import { authedProcedure } from "..";

export default authedProcedure.mutation(async function ({ ctx: { user } }) {
  if (user.verified) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Account already verified",
    });
  }

  await sendVerificationEmail({ user });

  return {};
});
