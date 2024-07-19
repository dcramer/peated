import type { SQL } from "drizzle-orm";
import { and, asc, eq, ilike, isNull } from "drizzle-orm";

import { db } from "@peated/server/db";
import { externalSites, reviews } from "@peated/server/db/schema";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z
      .object({
        site: ExternalSiteTypeEnum.optional(),
        bottle: z.number().optional(),
        query: z.string().default(""),
        onlyUnknown: z.boolean().optional(),
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
    const where: (SQL<unknown> | undefined)[] = [eq(reviews.hidden, false)];

    if (input.site) {
      const site = await db.query.externalSites.findFirst({
        where: eq(externalSites.type, input.site),
      });

      if (!site) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Site not found",
        });
      }
      where.push(eq(reviews.externalSiteId, site.id));
    }

    if (input.onlyUnknown) {
      where.push(isNull(reviews.bottleId));
    }

    if (input.bottle) {
      where.push(eq(reviews.bottleId, input.bottle));
    } else if (!ctx.user?.admin && !ctx.user?.mod) {
      console.error(`User requested reviewList without mod: ${ctx.user?.id}`);
      throw new TRPCError({
        code: "BAD_REQUEST",
      });
    }

    const offset = (cursor - 1) * limit;
    if (query) {
      where.push(ilike(reviews.name, `%${query}%`));
    }

    const results = await db
      .select()
      .from(reviews)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(reviews.name));

    return {
      results: await serialize(
        ReviewSerializer,
        results.slice(0, limit),
        ctx.user,
        [...(input.site ? ["site"] : []), ...(input.bottle ? ["bottle"] : [])],
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
