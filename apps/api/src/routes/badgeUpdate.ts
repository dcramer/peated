import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { checkBadgeConfig } from "@peated/server/lib/badges";
import { logError } from "@peated/server/lib/log";
import { BadgeInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import type { Badge, BadgeCheck } from "@peated/server/types";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../trpc";

export default adminProcedure
  .input(
    BadgeInputSchema.partial().extend({
      id: z.number(),
    }),
  )
  .mutation(async function ({ input: { id, ...input }, ctx }) {
    const [badge] = await db.select().from(badges).where(eq(badges.id, id));
    if (!badge) {
      throw new TRPCError({
        code: "NOT_FOUND",
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
        let config;
        try {
          config = await checkBadgeConfig(check.type as any, check.config);
        } catch (err) {
          logError(err);
          throw new TRPCError({
            message: "Failed to validate badge config.",
            code: "BAD_REQUEST",
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
      return await serialize(BadgeSerializer, badge, ctx.user);
    }

    const [newBadge] = await db
      .update(badges)
      .set(data)
      .where(eq(badges.id, badge.id))
      .returning();

    return await serialize(BadgeSerializer, newBadge, ctx.user);
  });
