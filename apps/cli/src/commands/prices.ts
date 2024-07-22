import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { storePriceHistories, storePrices } from "@peated/server/db/schema";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { findBottleId } from "../../../server/src/lib/bottleFinder";
import { normalizeBottle } from "../../../server/src/lib/normalize";

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
                await tx.transaction(async (tx) => {
                  const [match] = await db
                    .select({
                      id: storePrices.id,
                    })
                    .from(storePrices)
                    .where(
                      and(
                        eq(
                          sql`LOWER(${storePrices.name})`,
                          values.name.toLowerCase(),
                        ),
                        eq(storePrices.externalSiteId, price.externalSiteId),
                        eq(storePrices.volume, price.volume),
                        ne(storePrices.id, price.id),
                      ),
                    )
                    .limit(1);
                  await tx
                    .update(storePriceHistories)
                    .set({
                      priceId: match.id,
                    })
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
