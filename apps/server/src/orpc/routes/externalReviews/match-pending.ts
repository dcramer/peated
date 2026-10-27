import { db } from "@peated/server/db";
import { externalReviews } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushJob } from "@peated/server/worker/client";
import { and, asc, gt, isNull } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/external-reviews/match-pending",
    summary: "Match pending reviews",
    description:
      "Check a page of reviews by ID and queue Bottle matching for each one that has no Bottle and no completed match attempt, such as reviews left behind by a failed matching job. Continue with `nextAfterId` until it is null. Requires a moderator.",
    operationId: "matchPendingExternalReviews",
  })
  .input(
    z
      .object({
        afterId: z
          .number()
          .int()
          .nonnegative()
          .default(0)
          .describe("Check reviews with IDs greater than this value"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(100)
          .describe("Number of pending reviews to queue"),
      })
      .strict(),
  )
  .output(
    z
      .object({
        queued: z.array(z.number()),
        nextAfterId: z.number().nullable(),
      })
      .strict(),
  )
  .handler(async ({ input }) => {
    // Review matching owns pending state: this is the same filter
    // CreateMissingBottles uses, and the job checks it again before matching.
    const rows = await db
      .select({ id: externalReviews.id })
      .from(externalReviews)
      .where(
        and(
          gt(externalReviews.id, input.afterId),
          isNull(externalReviews.bottleId),
          isNull(externalReviews.bottleNoMatchAt),
          isNull(externalReviews.removedAt),
        ),
      )
      .orderBy(asc(externalReviews.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);

    for (const { id } of page) {
      await pushJob("CreateMissingBottles", { reviewId: id });
    }
    return {
      queued: page.map(({ id }) => id),
      nextAfterId: rows.length > input.limit ? page.at(-1)!.id : null,
    };
  });
