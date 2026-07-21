import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  catalogTargets,
  entities,
} from "@peated/server/db/schema";
import { logInfo } from "@peated/server/lib/log";
import { buildBottleSearchVector } from "@peated/server/lib/search";
import { and, eq, getTableColumns, sql } from "drizzle-orm";

export default async ({ bottleId }: { bottleId: number }) => {
  const bottle = await db.query.bottles.findFirst({
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
  });
  if (!bottle) {
    throw new Error(`Unknown bottle: ${bottleId}`);
  }

  const aliasList = await db
    .select({
      name: bottleAliases.name,
    })
    .from(bottleAliases)
    .innerJoin(catalogTargets, eq(catalogTargets.id, bottleAliases.targetId))
    .where(
      and(
        eq(catalogTargets.bottleId, bottle.id),
        sql`${bottleAliases.ignored} IS NOT TRUE`,
      ),
    );

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
    buildBottleSearchVector(
      bottle,
      brand!,
      aliasList,
      bottler,
      distillerList,
    ) || null;

  logInfo("Updating search vector for bottle {bottleId}", {
    extra: {
      bottleId: bottle.id,
    },
  });

  await db
    .update(bottles)
    .set({
      searchVector,
    })
    .where(eq(bottles.id, bottle.id));
};
