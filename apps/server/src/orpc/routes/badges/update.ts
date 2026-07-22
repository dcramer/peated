import { db } from "@peated/server/db";
import { badges, type NewBadge } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { BadgeInputSchema, BadgeSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "PATCH",
    path: "/badges/{badge}",
    summary: "Update badge",
    description:
      "Update badge information including name, description, and validation checks. Requires admin privileges",
    operationId: "updateBadge",
  })
  .input(
    BadgeInputSchema.partial().extend({
      badge: z.coerce.number(),
    }),
  )
  .output(BadgeSchema)
  .handler(async function ({ input, context, errors }) {
    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, input.badge));
    if (!badge) {
      throw errors.NOT_FOUND({
        message: "Badge not found.",
      });
    }

    const data: Partial<NewBadge> = {};
    if (input.name !== undefined && input.name !== badge.name) {
      data.name = input.name;
    }
    if (input.maxLevel !== undefined && input.maxLevel !== badge.maxLevel) {
      data.maxLevel = input.maxLevel;
    }
    if (input.tracker !== undefined && input.tracker !== badge.tracker) {
      data.tracker = input.tracker;
    }
    if (input.formula !== undefined && input.formula !== badge.formula) {
      data.formula = input.formula;
    }
    if (input.checks !== undefined) {
      data.checks = input.checks;
    }

    if (Object.keys(data).length === 0) {
      return await serialize(BadgeSerializer, badge, context.user);
    }

    const [newBadge] = await db
      .update(badges)
      .set(data)
      .where(eq(badges.id, badge.id))
      .returning();

    return await serialize(BadgeSerializer, newBadge, context.user);
  });
