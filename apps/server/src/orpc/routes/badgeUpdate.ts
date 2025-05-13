import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { checkBadgeConfig } from "@peated/server/lib/badges";
import { logError } from "@peated/server/lib/log";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { BadgeInputSchema, BadgeSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import type { Badge, BadgeCheck } from "@peated/server/types";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

export default procedure
  .use(requireAdmin)
  .route({ method: "PATCH", path: "/badges/:id" })
  .input(
    BadgeInputSchema.partial().extend({
      id: z.number(),
    }),
  )
  .output(BadgeSchema)
  .handler(async function ({ input: { id, ...input }, context }) {
    const [badge] = await db.select().from(badges).where(eq(badges.id, id));
    if (!badge) {
      throw new ORPCError("NOT_FOUND");
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
        let config;
        try {
          config = await checkBadgeConfig(check.type as any, check.config);
        } catch (err) {
          logError(err);
          throw new ORPCError("BAD_REQUEST", {
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
