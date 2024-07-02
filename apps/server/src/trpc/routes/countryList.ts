import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { and, asc, desc, ilike, type SQL } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

const DEFAULT_SORT = "name";

const SORT_OPTIONS = ["name", "bottles", "-name", "-bottles"] as const;

export default publicProcedure
  .input(
    z
      .object({
        query: z.string().default(""),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(100),
        sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
        sort: DEFAULT_SORT,
      }),
  )
  .query(async function ({ input: { cursor, query, limit, ...input }, ctx }) {
    ctx.maxAge = 86400;

    const where: (SQL<unknown> | undefined)[] = [];

    const offset = (cursor - 1) * limit;
    if (query) {
      where.push(ilike(countries.name, `%${query}%`));
    }

    let orderBy: SQL<unknown>;
    switch (input.sort) {
      case "name":
        orderBy = asc(countries.name);
        break;
      case "-name":
        orderBy = desc(countries.name);
        break;
      case "bottles":
        orderBy = asc(countries.totalBottles);
        break;
      case "-bottles":
        orderBy = desc(countries.totalBottles);
        break;
      default:
        throw new Error(`Invalid sort: ${input.sort}`);
    }

    const results = await db
      .select()
      .from(countries)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        CountrySerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
