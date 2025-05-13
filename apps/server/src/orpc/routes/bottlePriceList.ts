import { db } from "@peated/server/db";
import { bottles, externalSites, storePrices } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { StorePriceWithSiteSerializer } from "@peated/server/serializers/storePrice";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      bottle: z.number(),
      onlyValid: z.boolean().optional(),
    }),
  )
  .query(async function ({ input, ctx }) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw new TRPCError({
        message: "Bottle not found.",
        code: "NOT_FOUND",
      });
    }

    const where: (SQL<unknown> | undefined)[] = [
      eq(storePrices.bottleId, bottle.id),
      eq(storePrices.hidden, false),
    ];

    if (input.onlyValid) {
      where.push(sql`${storePrices.updatedAt} > NOW() - interval '1 week'`);
    }

    const results = await db
      .select({
        ...getTableColumns(storePrices),
        externalSite: externalSites,
      })
      .from(storePrices)
      .innerJoin(
        externalSites,
        eq(storePrices.externalSiteId, externalSites.id),
      )
      .where(and(...where))
      .orderBy(
        desc(sql`${storePrices.updatedAt} > NOW() - interval '1 week'`),
        asc(storePrices.name),
      );

    return {
      results: await serialize(StorePriceWithSiteSerializer, results, ctx.user),
    };
  });
