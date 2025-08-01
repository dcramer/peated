import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { checkBadgeConfig } from "@peated/server/lib/badges";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { BadgeInputSchema, BadgeSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import type { BadgeCheck } from "@peated/server/types";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/badges",
    operationId: "createBadge",
    summary: "Create badge",
    description:
      "Create a new achievement badge with validation checks and configuration. Requires admin privileges",
  })
  .input(BadgeInputSchema)
  .output(BadgeSchema)
  .handler(async function ({ input, context, errors }) {
    const checks: BadgeCheck[] = [];
    for (const check of input.checks) {
      let config;
      try {
        config = await checkBadgeConfig(check.type as any, check.config);
      } catch (err) {
        logError(err);
        throw errors.BAD_REQUEST({
          message: "Failed to validate badge config.",
        });
      }
      checks.push({
        ...check,
        config,
      });
    }

    const badge = await db.transaction(async (tx) => {
      const [badge] = await tx
        .insert(badges)
        .values({ ...input, checks })
        .returning();

      return badge;
    });

    if (!badge) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create badge.",
      });
    }

    return await serialize(BadgeSerializer, badge, context.user);
  });
