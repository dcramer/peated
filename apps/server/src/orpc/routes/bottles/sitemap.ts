import { db } from "@peated/server/db";
import { bottles, bottleTombstones } from "@peated/server/db/schema";
import {
  bottleDisplayNameColumns,
  toBottleDisplayNameSource,
} from "@peated/server/lib/bottleDisplayNameColumns";
import { implement } from "@peated/server/orpc";
import bottleSitemapContract from "@peated/server/orpc/contracts/bottles/sitemap";
import { and, asc, isNotNull, sql } from "drizzle-orm";

const PAGE_LIMIT = 1000;

export default implement(bottleSitemapContract).handler(async ({ input }) => {
  const results = await db
    .select({
      id: bottles.id,
      updatedAt: bottles.updatedAt,
      bottle: bottleDisplayNameColumns,
    })
    .from(bottles)
    .where(
      and(
        isNotNull(bottles.groupId),
        sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
      ),
    )
    .orderBy(asc(bottles.id))
    .limit(PAGE_LIMIT)
    .offset((input.page - 1) * PAGE_LIMIT);

  return {
    results: results.map(({ id, updatedAt, bottle }) => ({
      id,
      ...toBottleDisplayNameSource(bottle),
      updatedAt: updatedAt.toISOString(),
    })),
  };
});
