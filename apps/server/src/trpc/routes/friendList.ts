import { db } from "@peated/server/db";
import { follows } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { FriendSerializer } from "@peated/server/serializers/friend";
import { and, asc, desc, eq, not } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure
  .input(
    z
      .object({
        filter: z.enum(["pending", "active"]).optional(),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(100),
      })
      .default({
        cursor: 1,
        limit: 100,
      }),
  )
  .query(async function ({ input: { cursor, limit, ...input }, ctx }) {
    const offset = (cursor - 1) * limit;

    const where = [
      eq(follows.fromUserId, ctx.user.id),
      not(eq(follows.status, "none")),
    ];
    if (input.filter === "pending") {
      where.push(eq(follows.status, "pending"));
    } else if (input.filter === "active") {
      where.push(eq(follows.status, "following"));
    }

    const results = await db
      .select()
      .from(follows)
      .where(and(...where))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(follows.status), asc(follows.createdAt));

    return {
      results: await serialize(
        FriendSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
