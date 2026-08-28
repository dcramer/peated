import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { externalReviews, type ExternalReview } from "@peated/server/db/schema";
import { findBottleId } from "@peated/server/lib/bottleFinder";
import { asc, eq } from "drizzle-orm";
import { DatabaseError } from "pg";

type ExternalReviewNameUpdate = Pick<ExternalReview, "name"> &
  Partial<Pick<ExternalReview, "bottleId">>;

export function buildExternalReviewNameUpdate(
  name: string,
  bottleId: number | null,
): ExternalReviewNameUpdate {
  const update: ExternalReviewNameUpdate = { name };
  if (bottleId !== null) update.bottleId = bottleId;
  return update;
}

const subcommand = program.command("external-reviews");

subcommand
  .command("normalize-names")
  .option("--dry-run")
  .action(async (options) => {
    const step = 1000;
    const baseQuery = db
      .select()
      .from(externalReviews)
      .orderBy(asc(externalReviews.id));

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
          const values = buildExternalReviewNameUpdate(
            name,
            discoveredBottleId,
          );

          console.log(`M: ${review.name} -> ${JSON.stringify(values)}`);
          if (!options.dryRun) {
            // TODO(ratings): Move this maintenance command behind a server-owned boundary.
            try {
              await db.transaction(async (tx) => {
                return await tx
                  .update(externalReviews)
                  .set(values)
                  .where(eq(externalReviews.id, review.id));
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
                await db
                  .delete(externalReviews)
                  .where(eq(externalReviews.id, review.id));
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
