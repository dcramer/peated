import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";
import { type Context } from "../context";

const SORT_OPTIONS = ["name", "created", "-created", "-name"] as const;

const InputSchema = z
  .object({
    query: z.string().default(""),
    sort: z.enum(SORT_OPTIONS).default("name"),
    cursor: z.number().gte(1).default(1),
    limit: z.number().gte(1).lte(100).default(25),
  })
  .default({
    query: "",
    cursor: 1,
    limit: 100,
  });

export async function userList({
  input: { query, cursor, limit, sort, ...input },
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  if (!ctx.user) {
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
    results: await serialize(UserSerializer, results.slice(0, limit), ctx.user),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
}

export default authedProcedure.input(InputSchema).query(userList);
