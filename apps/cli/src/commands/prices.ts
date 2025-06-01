import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  storePriceHistories,
  storePrices,
} from "@peated/server/db/schema";
import { findBottleId } from "@peated/server/lib/bottleFinder";
import { upsertBottleAlias } from "@peated/server/lib/db";
import { normalizeBottle } from "@peated/server/lib/normalize";
import { and, asc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";

const subcommand = program.command("prices");

subcommand
  .command("normalize-names")
  .option("--dry-run")
  .action(async (options) => {
    const step = 1000;
    const baseQuery = db
      .select()
      .from(storePrices)
      .orderBy(asc(storePrices.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const price of query) {
        const { name } = normalizeBottle({
          name: price.name,
          isFullName: true,
        });
        if (price.name !== name) {
          const values: Record<string, any> = {};
          if (price.name !== name) values.name = name;

          if (!price.bottleId) {
            const bottleId = await findBottleId(price.name);
            if (bottleId) price.bottleId = bottleId;
          }

          console.log(`M: ${price.name} -> ${JSON.stringify(values)}`);
          if (!options.dryRun) {
            // TODO: move this code
            try {
              await db.transaction(async (tx) => {
                return await tx
                  .update(storePrices)
                  .set(values)
                  .where(eq(storePrices.id, price.id));
              });
            } catch (err: any) {
              if (
                err?.code === "23505" &&
                err?.constraint === "store_price_unq_name"
              ) {
                await db.transaction(async (tx) => {
                  const [match] = await db
                    .select({
                      id: storePrices.id,
                    })
                    .from(storePrices)
                    .where(
                      and(
                        eq(
                          sql`LOWER(${storePrices.name})`,
                          values.name.toLowerCase()
                        ),
                        eq(storePrices.externalSiteId, price.externalSiteId),
                        eq(storePrices.volume, price.volume),
                        ne(storePrices.id, price.id)
                      )
                    )
                    .limit(1);
                  const histories = await tx
                    .select()
                    .from(storePriceHistories)
                    .where(eq(storePriceHistories.priceId, price.id));
                  for (const history of histories) {
                    await tx
                      .insert(storePriceHistories)
                      .values({
                        ...history,
                        priceId: match.id,
                      })
                      .onConflictDoNothing();
                  }
                  await tx
                    .delete(storePriceHistories)
                    .where(eq(storePriceHistories.priceId, price.id));
                  await tx
                    .delete(storePrices)
                    .where(eq(storePrices.id, price.id));
                });
              }
            }
          }
        }
        hasResults = true;
      }
      offset += step;
    }
  });

subcommand.command("backfill-aliases").action(async (options) => {
  const step = 1000;
  const baseQuery = db.select().from(storePrices).orderBy(asc(storePrices.id));

  let hasResults = true;
  let offset = 0;
  while (hasResults) {
    hasResults = false;
    const query = await baseQuery.offset(offset).limit(step);
    for (const price of query) {
      if (price.bottleId) {
        await upsertBottleAlias(db, price.name, price.bottleId);
      } else {
        await db
          .insert(bottleAliases)
          .values({
            name: price.name,
            ignored: price.hidden,
          })
          .onConflictDoNothing();
      }
      hasResults = true;
    }
    offset += step;
  }
});

subcommand.command("backfill-images").action(async (options) => {
  await db
    .update(bottles)
    .set({
      imageUrl: sql`(SELECT ${storePrices.imageUrl} FROM ${storePrices} WHERE ${storePrices.bottleId} = ${bottles.id} AND ${storePrices.imageUrl} IS NOT NULL LIMIT 1)`,
    })
    .where(isNull(bottles.imageUrl));
});
