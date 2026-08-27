import { db } from "@peated/server/db";
import { storePriceHistories, storePrices } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import priceChangeListContract from "@peated/server/orpc/contracts/prices/change-list";
import { serialize } from "@peated/server/serializers";
import { PriceChangeSerializer } from "@peated/server/serializers/storePrice";
import type { SQL } from "drizzle-orm";
import { and, eq, ilike, isNotNull, sql } from "drizzle-orm";
export default implement(priceChangeListContract).handler(async function ({
  input: { query, cursor, limit },
  context,
}) {
  const offset = (cursor - 1) * limit;

  const minChange = 500; // $5

  const baseWhere: SQL[] = [
    sql`${storePrices.updatedAt} > NOW() - interval '1 week'`,
    sql`${storePriceHistories.date} < DATE(${storePrices.updatedAt})`,
    sql`${storePriceHistories.date} > NOW() - interval '4 week'`,
  ];
  if (query) {
    baseWhere.push(ilike(storePrices.name, `%${query}%`));
  }

  const results = await db
    .select({
      id: sql<string>`${storePrices.bottleId}`,
      price: sql<string>`AVG(${storePrices.price})`,
      previousPrice: sql<string>`AVG(${storePriceHistories.price})`,
      // assume this never changes
      currency: storePrices.currency,
    })
    .from(storePrices)
    .innerJoin(
      storePriceHistories,
      eq(storePriceHistories.priceId, storePrices.id),
    )
    // Unresolved listings cannot be presented as Bottle price changes.
    .where(and(...baseWhere, isNotNull(storePrices.bottleId)))
    .groupBy(storePrices.bottleId, storePrices.currency)
    .having(
      sql`ABS(AVG(${storePriceHistories.price}) - AVG(${storePrices.price})) > ${minChange}`,
    )
    .orderBy(
      sql`ABS(AVG(${storePriceHistories.price}) - AVG(${storePrices.price})) DESC`,
    )
    .limit(limit + 1)
    .offset(offset);

  const pageResults = results.slice(0, limit);

  return {
    results: await serialize(PriceChangeSerializer, pageResults, context.user),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
});
