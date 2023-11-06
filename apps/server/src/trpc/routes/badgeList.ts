import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import type { SQL } from "drizzle-orm";
import { and, asc, ilike } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z
      .object({
        query: z.string().default(""),
        page: z.number().default(1),
        sort: z.enum(["name"]).default("name"),
      })
      .default({
        page: 1,
        query: "",
        sort: "name",
      }),
  )
  .query(async function ({ input, ctx }) {
    const page = input.page;
    const query = input.query;

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: SQL<unknown>[] = [];
    if (query) {
      where.push(ilike(badges.name, `%${query}%`));
    }

    let orderBy: SQL<unknown>;
    switch (input.sort) {
      default:
        orderBy = asc(badges.name);
        break;
    }

    const results = await db
      .select()
      .from(badges)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        BadgeSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  });
