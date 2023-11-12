import type { SQL } from "drizzle-orm";
import { and, asc, desc, ilike } from "drizzle-orm";
import { z } from "zod";

import { db } from "@peated/server/db";
import { stores } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { StoreSerializer } from "@peated/server/serializers/store";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z
      .object({
        query: z.string().default(""),
        sort: z.enum(["name", "-name"]).default("name"),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        sort: "name",
        cursor: 1,
        limit: 100,
      }),
  )
  .query(async function ({ input: { cursor, sort, limit, query }, ctx }) {
    const offset = (cursor - 1) * limit;

    const where: SQL<unknown>[] = [];
    if (query) {
      where.push(ilike(stores.name, `%${query}%`));
    }

    let orderBy: SQL<unknown>;
    switch (sort) {
      case "-name":
        orderBy = desc(stores.name);
        break;
      default:
        orderBy = asc(stores.name);
        break;
    }

    const results = await db
      .select()
      .from(stores)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        StoreSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
