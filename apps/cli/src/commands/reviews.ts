import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { bottleAliases, reviews } from "@peated/server/db/schema";
import { findBottleId } from "@peated/server/lib/bottleFinder";
import { upsertBottleAlias } from "@peated/server/lib/db";
import { normalizeBottle } from "@peated/server/lib/normalize";
import { asc, eq } from "drizzle-orm";

const subcommand = program.command("reviews");

subcommand
  .command("normalize-names")
  .option("--dry-run")
  .action(async (options) => {
    const step = 1000;
    const baseQuery = db.select().from(reviews).orderBy(asc(reviews.id));

    let hasResults = true;
    let offset = 0;
    while (hasResults) {
      hasResults = false;
      const query = await baseQuery.offset(offset).limit(step);
      for (const review of query) {
        const { name } = normalizeBottle({
          name: review.name,
          isFullName: true,
        });
        if (review.name !== name) {
          const values: Record<string, any> = {};
          if (review.name !== name) values.name = name;

          if (!review.bottleId) {
            const bottleId = await findBottleId(review.name);
            if (bottleId) review.bottleId = bottleId;
          }

          console.log(`M: ${review.name} -> ${JSON.stringify(values)}`);
          if (!options.dryRun) {
            // TODO: move this code
            try {
              await db.transaction(async (tx) => {
                return await tx
                  .update(reviews)
                  .set(values)
                  .where(eq(reviews.id, review.id));
              });
            } catch (err: any) {
              if (
                err?.code === "23505" &&
                err?.constraint === "review_unq_name"
              ) {
                await db.delete(reviews).where(eq(reviews.id, review.id));
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
  const baseQuery = db.select().from(reviews).orderBy(asc(reviews.id));

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
          })
          .onConflictDoNothing();
      }
      hasResults = true;
    }
    offset += step;
  }
});
