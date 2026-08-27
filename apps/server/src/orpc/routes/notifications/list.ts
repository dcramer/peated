import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import notificationListContract from "@peated/server/orpc/contracts/notifications/list";
import { requireAuth } from "@peated/server/orpc/middleware";
import { serialize } from "@peated/server/serializers";
import { NotificationSerializer } from "@peated/server/serializers/notification";
import type { SQL } from "drizzle-orm";
import { and, desc, eq } from "drizzle-orm";

export default implement(notificationListContract)
  .use(requireAuth)
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
