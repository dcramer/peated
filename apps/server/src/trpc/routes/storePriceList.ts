import type { SQL } from "drizzle-orm";
import { and, asc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@peated/server/db";
import { externalSites, storePrices } from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { StorePriceSerializer } from "@peated/server/serializers/storePrice";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure } from "..";

export default adminProcedure
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
      query: z.string().default(""),
      cursor: z.number().gte(1).default(1),
      limit: z.number().gte(1).lte(100).default(100),
    }),
  )
  .query(async function ({ input: { cursor, query, limit, ...input }, ctx }) {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
    });

    if (!site) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    const offset = (cursor - 1) * limit;

    const where: SQL[] = [
      eq(storePrices.externalSiteId, site.id),
      sql`${storePrices.updatedAt} > NOW() - interval '1 week'`,
    ];
    if (query) {
      where.push(ilike(storePrices.name, `%${query}%`));
    }

    const results = await db
      .select()
      .from(storePrices)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(storePrices.name));

    return {
      results: await serialize(
        StorePriceSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
