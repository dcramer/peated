import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { reviews, type Review } from "@peated/server/db/schema";
import { findBottleId } from "@peated/server/lib/bottleFinder";
import { asc, eq } from "drizzle-orm";
import { DatabaseError } from "pg";

type ReviewNormalizationUpdate = Pick<Review, "name"> &
  Partial<Pick<Review, "bottleId">>;

export function buildReviewNormalizationUpdate(
  name: string,
  bottleId: number | null,
): ReviewNormalizationUpdate {
  const update: ReviewNormalizationUpdate = { name };
  if (bottleId !== null) update.bottleId = bottleId;
  return update;
}

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
          const discoveredBottleId =
            review.bottleId === null ? await findBottleId(review.name) : null;
          const values = buildReviewNormalizationUpdate(
            name,
            discoveredBottleId,
          );

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
            } catch (error) {
              const databaseError =
                error instanceof DatabaseError
                  ? error
                  : error instanceof Error &&
                      error.cause instanceof DatabaseError
                    ? error.cause
                    : null;
              if (
                databaseError?.code === "23505" &&
                databaseError.constraint === "review_unq_name"
              ) {
                await db.delete(reviews).where(eq(reviews.id, review.id));
              } else {
                throw error;
              }
            }
          }
        }
        hasResults = true;
      }
      offset += step;
    }
  });
