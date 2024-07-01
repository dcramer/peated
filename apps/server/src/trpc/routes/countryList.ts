import { db } from "@peated/server/db";
import type { SerializedPoint } from "@peated/server/db/columns/geography";
import { countries } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { and, asc, getTableColumns, ilike, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z
      .object({
        query: z.string().default(""),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      }),
  )
  .query(async function ({ input: { cursor, query, limit, ...input }, ctx }) {
    const where: (SQL<unknown> | undefined)[] = [];

    const offset = (cursor - 1) * limit;
    if (query) {
      where.push(ilike(countries.name, `%${query}%`));
    }

    const results = await db
      .select({
        ...getTableColumns(countries),
        location: sql<SerializedPoint>`ST_AsGeoJSON(${countries.location}) as location`,
      })
      .from(countries)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(countries.name));

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
