import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import type { SQL } from "drizzle-orm";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { requireAuth } from "../middleware";

export default procedure
  .use(requireAuth)
  .route({ method: "GET", path: "/notifications/count" })
  .input(
    z
      .object({
        filter: z.enum(["unread", "all"]).nullish(),
      })
      .default({}),
  )
  .output(z.object({ count: z.number() }))
  .handler(async function ({ input, context }) {
    const where: (SQL<unknown> | undefined)[] = [
      eq(notifications.userId, context.user.id),
    ];
    if (input.filter === "unread") {
      where.push(eq(notifications.read, false));
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(where ? and(...where) : undefined);

    return { count: count };
  });
