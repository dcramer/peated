import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { findBottleId } from "../../../server/src/lib/bottleFinder";
import { normalizeBottle } from "../../../server/src/lib/normalize";

const subcommand = program.command("prices");

subcommand
  .command("normalize-names")
  .option("--dry-run")
  .action(async (options) => {
    const step = 1000;
    const baseQuery = db
      .select({
        id: storePrices.id,
        bottleId: storePrices.bottleId,
        name: storePrices.name,
      })
      .from(storePrices)
      .orderBy(asc(storePrices.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const { id, ...price } of query) {
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
            await db
              .update(storePrices)
              .set(values)
              .where(eq(storePrices.id, id));
          }
        }
        hasResults = true;
      }
      offset += step;
    }
  });
