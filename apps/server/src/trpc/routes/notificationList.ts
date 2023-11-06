import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { NotificationSerializer } from "@peated/server/serializers/notification";
import type { SQL } from "drizzle-orm";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure
  .input(
    z
      .object({
        filter: z.enum(["unread", "all"]).optional(),
        page: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(100),
      })
      .default({
        page: 1,
        limit: 100,
      }),
  )
  .query(async function ({ input: { page, limit, ...input }, ctx }) {
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [
      eq(notifications.userId, ctx.user.id),
    ];
    if (input.filter === "unread") {
      where.push(eq(notifications.read, false));
    }

    const results = await db
      .select()
      .from(notifications)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(notifications.createdAt));

    return {
      results: await serialize(
        NotificationSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  });
