import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  follows,
  tastings,
  users,
} from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { CursorSchema, TastingSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/tastings" })
  .input(
    z
      .object({
        bottle: z.coerce.number().optional(),
        entity: z.coerce.number().optional(),
        user: z
          .union([z.coerce.number(), z.literal("me"), z.string()])
          .optional(),
        filter: z.enum(["global", "friends", "local"]).default("global"),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(25),
      })
      .default({
        filter: "global",
        cursor: 1,
        limit: 25,
      }),
  )
  .output(
    z.object({
      results: z.array(TastingSchema),
      rel: CursorSchema,
    }),
  )
  .handler(async function ({
    input: { cursor, limit, ...input },
    context,
    errors,
  }) {
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
      const selectedUser = await getUserFromId(db, input.user, context.user);

      if (!selectedUser) {
        if (input.user === "me") {
          throw errors.UNAUTHORIZED();
        } else {
          throw errors.NOT_FOUND({
            message: "User not found.",
          });
        }
      }

      where.push(eq(tastings.createdById, selectedUser.id));
    }

    const limitPrivate = input.filter !== "friends";
    if (input.filter === "friends") {
      if (!context.user) {
        throw errors.UNAUTHORIZED();
      }
      where.push(
        sql`${tastings.createdById} IN (SELECT ${follows.toUserId} FROM ${follows} WHERE ${follows.fromUserId} = ${context.user.id} AND ${follows.status} = 'following')`,
      );
    }

    if (limitPrivate) {
      where.push(
        or(
          eq(users.private, false),
          ...(context.user
            ? [
                eq(tastings.createdById, context.user.id),
                sql`${tastings.createdById} IN (
                  SELECT ${follows.toUserId} FROM ${follows} WHERE ${follows.fromUserId} = ${context.user.id} AND ${follows.status} = 'following'
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
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
