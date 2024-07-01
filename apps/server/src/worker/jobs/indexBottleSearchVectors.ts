import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { buildBottleSearchVector } from "@peated/server/lib/search";
import { eq, getTableColumns } from "drizzle-orm";

export default async ({ bottleId }: { bottleId: number }) => {
  const bottle = await db.query.bottles.findFirst({
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
  });
  if (!bottle) {
    throw new Error(`Unknown bottle: ${bottleId}`);
  }

  const aliasList = await db
    .select()
    .from(bottleAliases)
    .where(eq(bottleAliases.bottleId, bottle.id));

  const distillerList = await db
    .select({
      ...getTableColumns(entities),
    })
    .from(entities)
    .innerJoin(
      bottlesToDistillers,
      eq(bottlesToDistillers.distillerId, entities.id),
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, bottle.brandId));

  const [bottler] = bottle.bottlerId
    ? await db.select().from(entities).where(eq(entities.id, bottle.bottlerId))
    : [];

  const searchVector =
    buildBottleSearchVector(bottle, brand, aliasList, bottler, distillerList) ||
    null;

  console.log(`Updating index for Bottle ${bottle.id}: ${searchVector}`);

  await db
    .update(bottles)
    .set({
      searchVector,
    })
    .where(eq(bottles.id, bottle.id));
};
