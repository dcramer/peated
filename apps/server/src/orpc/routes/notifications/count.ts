import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import notificationCountContract from "@peated/server/orpc/contracts/notifications/count";
import { requireAuth } from "@peated/server/orpc/middleware";
import type { SQL } from "drizzle-orm";
import { and, eq, sql } from "drizzle-orm";

export default implement(notificationCountContract)
  .use(requireAuth)
  .handler(async function ({ input, context }) {
    const where: (SQL<unknown> | undefined)[] = [
      eq(notifications.userId, context.user.id),
    ];
    if (input.filter === "unread") {
      where.push(eq(notifications.read, false));
    }

    const [{ count }] = await db
      .select({ count: sql<string>`count(*)` })
      .from(notifications)
      .where(where ? and(...where) : undefined);

    return { count: Number(count) };
  });
