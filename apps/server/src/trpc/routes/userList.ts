import type { SQL } from "drizzle-orm";
import { and, asc, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { authedProcedure } from "..";

export default authedProcedure
  .input(
    z
      .object({
        query: z.string().default(""),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(25),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      }),
  )
  .query(async function ({ input: { query, cursor, limit, ...input }, ctx }) {
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];
    if (query) {
      where.push(
        or(ilike(users.displayName, `%${query}%`), ilike(users.email, query)),
      );
    } else if (!ctx.user.admin) {
      return {
        results: [],
        rel: {
          nextCursor: null,
          prevCursor: null,
        },
      };
    }

    const results = await db
      .select()
      .from(users)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(users.displayName));

    return {
      results: await serialize(
        UserSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
