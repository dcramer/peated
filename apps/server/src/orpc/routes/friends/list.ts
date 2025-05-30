import { db } from "@peated/server/db";
import { follows, users } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { CursorSchema, FriendSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FriendSerializer } from "@peated/server/serializers/friend";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  ilike,
  not,
  or,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/friends",
    summary: "List friends",
    description:
      "Retrieve user's friend relationships with filtering by status (pending/active) and search support",
  })
  .input(
    z
      .object({
        query: z.string().default(""),
        filter: z.enum(["pending", "active"]).optional(),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      }),
  )
  .output(
    z.object({
      results: z.array(FriendSchema),
      rel: CursorSchema,
    }),
  )
  .handler(async function ({
    input: { query, cursor, limit, ...input },
    context,
    errors,
  }) {
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [
      eq(follows.fromUserId, context.user.id),
      not(eq(follows.status, "none")),
    ];
    if (input.filter === "pending") {
      where.push(eq(follows.status, "pending"));
    } else if (input.filter === "active") {
      where.push(eq(follows.status, "following"));
    }

    if (query) {
      where.push(
        or(ilike(users.username, `%${query}%`), ilike(users.email, query)),
      );
    }

    const results = await db
      .select({
        ...getTableColumns(follows),
        toUser: getTableColumns(users),
      })
      .from(follows)
      .where(and(...where))
      .innerJoin(users, eq(users.id, follows.toUserId))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(follows.status), asc(follows.createdAt));

    return {
      results: await serialize(
        FriendSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
