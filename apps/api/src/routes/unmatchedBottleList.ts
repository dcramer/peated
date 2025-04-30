import { db } from "@peated/server/db";
import { bottleAliases, storePrices } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { StorePriceWithSiteSerializer } from "@peated/server/serializers/storePrice";
import {
  and,
  asc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "../trpc";

export default modProcedure
  .input(
    z
      .object({
        bottle: z.number().optional(),
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
    const where: (SQL<unknown> | undefined)[] = [
      eq(bottleAliases.ignored, false),
      isNull(bottleAliases.bottleId),
    ];

    if (query) {
      where.push(ilike(bottleAliases.name, `%${query}%`));
    }

    const offset = (cursor - 1) * limit;

    const { embedding, ...columns } = getTableColumns(bottleAliases);
    const results = await db
      .select(columns)
      .from(bottleAliases)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(bottleAliases.name));

    const hasNextPage = results.length > limit;

    const exampleListings = await db.query.storePrices.findMany({
      where: inArray(
        storePrices.name,
        results.map((a) => a.name),
      ),
      with: {
        externalSite: true,
      },
    });

    const examplesByName = Object.fromEntries(
      (
        await serialize(StorePriceWithSiteSerializer, exampleListings, ctx.user)
      ).map((data, index) => [exampleListings[index].name, data]),
    );

    return {
      results: results.slice(0, limit).map((a) => ({
        name: a.name,
        createdAt: a.createdAt.toISOString(),
        bottleId: a.bottleId,
        bestMatch: null,
        exampleListing: examplesByName[a.name] || null,
      })),
      rel: {
        nextCursor: hasNextPage ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
