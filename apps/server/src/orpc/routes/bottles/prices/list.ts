import { db } from "@peated/server/db";
import { bottles, externalSites, storePrices } from "@peated/server/db/schema";
import { currentStorePriceCondition } from "@peated/server/lib/storePriceValidity";
import { implement } from "@peated/server/orpc";
import bottlePriceListContract from "@peated/server/orpc/contracts/bottles/prices/list";
import { serialize } from "@peated/server/serializers";
import { StorePriceWithSiteSerializer } from "@peated/server/serializers/storePrice";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  type SQL,
  sql,
} from "drizzle-orm";

export default implement(bottlePriceListContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, input.bottle));

  if (!bottle) {
    throw errors.NOT_FOUND({
      message: "Bottle not found.",
    });
  }

  const baseWhere: (SQL<unknown> | undefined)[] = [
    eq(storePrices.hidden, false),
    eq(storePrices.bottleId, bottle.id),
  ];

  if (input.onlyValid) {
    baseWhere.push(currentStorePriceCondition());
  }

  const results = await db
    .select({
      ...getTableColumns(storePrices),
      externalSite: externalSites,
    })
    .from(storePrices)
    .innerJoin(externalSites, eq(storePrices.externalSiteId, externalSites.id))
    .where(and(...baseWhere))
    .orderBy(desc(currentStorePriceCondition()), asc(storePrices.name));

  return {
    results: await serialize(
      StorePriceWithSiteSerializer,
      results,
      context.user,
    ),
  };
});
