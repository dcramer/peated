import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { BadgeInputSchema, BadgeSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/badges",
    summary: "Create badge",
    description:
      "Create a new achievement badge with validation checks and configuration. Requires admin privileges",
    operationId: "createBadge",
  })
  .input(BadgeInputSchema)
  .output(BadgeSchema)
  .handler(async function ({ input, context, errors }) {
    const badge = await db.transaction(async (tx) => {
      const [badge] = await tx.insert(badges).values(input).returning();

      return badge;
    });

    if (!badge) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create badge.",
      });
    }

    return await serialize(BadgeSerializer, badge, context.user);
  });
