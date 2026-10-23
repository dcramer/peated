import { db } from "@peated/server/db";
import { externalReviews } from "@peated/server/db/schema";
import { PersistedReferenceBottleCheckOutputSchema } from "@peated/server/lib/bottleChecks";
import { isSupportedBottleCheckSchemaVersion } from "@peated/server/lib/bottleCheckSchemaVersion";
import { getLatestReviewBottleCheck } from "@peated/server/lib/externalReviewResolution";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { ExternalReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalReviewSerializer } from "@peated/server/serializers/externalReview";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/external-reviews/{externalReview}/resolution",
    summary: "Get review matching evidence",
    description:
      "Read an imported review and its latest saved Bottle decision. Requires a moderator.",
    operationId: "getExternalReviewResolution",
  })
  .input(
    z.object({ externalReview: z.coerce.number().int().positive() }).strict(),
  )
  .output(
    z
      .object({
        review: ExternalReviewSchema,
        attemptedAt: z.string().datetime().nullable(),
        check: z
          .object({
            id: z.number(),
            output: PersistedReferenceBottleCheckOutputSchema.nullable(),
            artifacts: z.record(z.string(), z.unknown()).nullable(),
          })
          .strict()
          .nullable(),
      })
      .strict(),
  )
  .handler(async ({ input, context, errors }) => {
    const review = await db.query.externalReviews.findFirst({
      where: eq(externalReviews.id, input.externalReview),
    });
    if (!review || review.removedAt !== null)
      throw errors.NOT_FOUND({ message: "External review not found." });
    const check = await getLatestReviewBottleCheck(review.id);
    const output =
      check && isSupportedBottleCheckSchemaVersion(check)
        ? PersistedReferenceBottleCheckOutputSchema.safeParse(check.output)
        : null;
    return {
      review: await serialize(ExternalReviewSerializer, review, context.user),
      attemptedAt: review.bottleNoMatchAt?.toISOString() ?? null,
      check: check
        ? {
            id: check.id,
            output: output?.success ? output.data : null,
            artifacts: check.artifacts,
          }
        : null,
    };
  });
