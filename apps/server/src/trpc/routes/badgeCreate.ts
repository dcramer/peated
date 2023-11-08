import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { checkBadgeConfig } from "@peated/server/lib/badges";
import { logError } from "@peated/server/lib/log";
import { BadgeInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import { TRPCError } from "@trpc/server";
import { adminProcedure } from "..";

export default adminProcedure.input(BadgeInputSchema).mutation(async function ({
  input,
  ctx,
}) {
  let config: Record<string, any>;
  try {
    config = await checkBadgeConfig(input.type, input.config);
  } catch (err) {
    logError(err);
    throw new TRPCError({
      message: "Failed to validate badge config.",
      code: "BAD_REQUEST",
    });
  }

  const badge = await db.transaction(async (tx) => {
    const [badge] = await tx
      .insert(badges)
      .values({ ...input, config })
      .returning();

    return badge;
  });

  if (!badge) {
    throw new TRPCError({
      message: "Failed to create badge.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return await serialize(BadgeSerializer, badge, ctx.user);
});
