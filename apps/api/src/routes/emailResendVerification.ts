import { sendVerificationEmail } from "@peated/server/lib/email";
import { TRPCError } from "@trpc/server";
import { authedProcedure } from "../trpc";

export default authedProcedure.mutation(async function ({ ctx: { user } }) {
  if (user.verified) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Account already verified",
    });
  }

  await sendVerificationEmail({ user });

  return {};
});
