import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware/auth";
import { CursorSchema, UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

const SORT_OPTIONS = ["name", "created", "-created", "-name"] as const;

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/users",
    operationId: "listUsers",
    summary: "List users",
    description:
      "Search and list users with pagination support. Requires authentication",
  })
  .input(
    z
      .object({
        query: z.string().default(""),
        sort: z.enum(SORT_OPTIONS).default("name"),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(25),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      }),
  )
  .output(
    z.object({
      results: z.array(UserSchema),
      rel: CursorSchema,
    }),
  )
  .handler(async function ({
    input: { query, cursor, limit, sort, ...input },
    context,
  }) {
    if (!context.user) {
      return {
        results: [],
        rel: {
          nextCursor: null,
          prevCursor: null,
        },
      };
    }

    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];
    if (query) {
      where.push(
        or(
          ilike(users.username, `%${query}%`),
          eq(sql`LOWER(${users.email})`, query.toLowerCase()),
        ),
      );
    } else if (!context.user.admin) {
      return {
        results: [],
        rel: {
          nextCursor: null,
          prevCursor: null,
        },
      };
    }

    let orderBy: SQL<unknown>;
    switch (sort) {
      case "-name":
        orderBy = desc(users.username);
        break;
      case "created":
        orderBy = asc(users.createdAt);
        break;
      case "-created":
        orderBy = desc(users.createdAt);
        break;
      default:
        orderBy = asc(users.username);
        break;
    }

    const results = await db
      .select()
      .from(users)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        UserSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
