import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { checkBadgeConfig } from "@peated/server/lib/badges";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { BadgeInputSchema, BadgeSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import type { Badge, BadgeCheck } from "@peated/server/types";
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
  })
  .input(
    BadgeInputSchema.partial().extend({
      badge: z.coerce.number(),
    })
  )
  .output(BadgeSchema)
  .handler(async ({ input, context, errors }) => {
    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, input.badge));
    if (!badge) {
      throw errors.NOT_FOUND({
        message: "Badge not found.",
      });
    }

    const data: { [name: string]: any } = {};
    Object.entries(input).map(([k, v]) => {
      if (v !== undefined && v !== badge[k as keyof Badge]) {
        data[k] = v;
      }
    });

    if (data.checks) {
      const checks: BadgeCheck[] = [];
      for (const check of data.checks) {
        let config: any;
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
      data.checks = checks;
    }

    if (Object.values(data).length === 0) {
      return await serialize(BadgeSerializer, badge, context.user);
    }

    const [newBadge] = await db
      .update(badges)
      .set(data)
      .where(eq(badges.id, badge.id))
      .returning();

    return await serialize(BadgeSerializer, newBadge, context.user);
  });
