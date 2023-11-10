import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  follows,
  tastings,
  users,
} from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { TRPCError } from "@trpc/server";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z
      .object({
        bottle: z.number().optional(),
        entity: z.number().optional(),
        user: z.union([z.number(), z.literal("me")]).optional(),
        filter: z.enum(["global", "friends", "local"]).default("global"),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(25),
      })
      .default({
        filter: "global",
        cursor: 1,
        limit: 25,
      }),
  )
  .query(async function ({ input: { cursor, limit, ...input }, ctx }) {
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];
    if (input.bottle) {
      where.push(eq(tastings.bottleId, input.bottle));
    }

    if (input.entity) {
      where.push(
        sql`EXISTS(
          SELECT FROM ${bottles}
          WHERE (${bottles.brandId} = ${input.entity}
             OR ${bottles.bottlerId} = ${input.entity}
             OR EXISTS(
              SELECT FROM ${bottlesToDistillers}
              WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
                AND ${bottlesToDistillers.distillerId} = ${input.entity}
             )) AND ${bottles.id} = ${tastings.bottleId}
          )`,
      );
    }

    if (input.user) {
      if (input.user === "me") {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
          });
        }

        where.push(eq(tastings.createdById, ctx.user.id));
      } else {
        where.push(eq(tastings.createdById, input.user));
      }
    }

    const limitPrivate = input.filter !== "friends";
    if (input.filter === "friends") {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }
      where.push(
        sql`${tastings.createdById} IN (SELECT ${follows.toUserId} FROM ${follows} WHERE ${follows.fromUserId} = ${ctx.user.id} AND ${follows.status} = 'following')`,
      );
    }

    if (limitPrivate) {
      where.push(
        or(
          eq(users.private, false),
          ...(ctx.user
            ? [
                eq(tastings.createdById, ctx.user.id),
                sql`${tastings.createdById} IN (
                  SELECT ${follows.toUserId} FROM ${follows} WHERE ${follows.fromUserId} = ${ctx.user.id} AND ${follows.status} = 'following'
                )`,
              ]
            : []),
        ),
      );
    }

    const results = await db
      .select({ tastings })
      .from(tastings)
      .innerJoin(users, eq(users.id, tastings.createdById))
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(tastings.createdAt));

    return {
      results: await serialize(
        TastingSerializer,
        results.map((t) => t.tastings).slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
