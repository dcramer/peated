import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { reviews } from "@peated/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { findBottleId } from "../../../server/src/lib/bottleFinder";
import { normalizeBottle } from "../../../server/src/lib/normalize";

const subcommand = program.command("reviews");

subcommand
  .command("normalize-names")
  .option("--dry-run")
  .action(async (options) => {
    const step = 1000;
    const baseQuery = db
      .select({
        id: reviews.id,
        bottleId: reviews.bottleId,
        name: reviews.name,
      })
      .from(reviews)
      .orderBy(asc(reviews.id));

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
            await db.update(reviews).set(values).where(eq(reviews.id, id));
          }
        }
        hasResults = true;
      }
      offset += step;
    }
  });
