import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import type { SQL } from "drizzle-orm";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure
  .input(
    z
      .object({
        filter: z.enum(["unread", "all"]).nullish(),
      })
      .default({}),
  )
  .query(async function ({ input, ctx }) {
    const where: (SQL<unknown> | undefined)[] = [
      eq(notifications.userId, ctx.user.id),
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
