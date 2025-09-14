import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { NotificationSchema, listResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { NotificationSerializer } from "@peated/server/serializers/notification";
import type { SQL } from "drizzle-orm";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/notifications",
    summary: "List notifications",
    description:
      "Retrieve user notifications with filtering by read status and pagination support",
    operationId: "listNotifications",
  })
  .input(
    z
      .object({
        filter: z.enum(["unread", "all"]).optional(),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({
        cursor: 1,
        limit: 100,
      }),
  )
  // TODO(response-envelope): use helper to enable later switch to { data, meta }
  .output(listResponse(NotificationSchema))
  .handler(async function ({ input: { cursor, limit, ...input }, context }) {
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [
      eq(notifications.userId, context.user.id),
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
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
