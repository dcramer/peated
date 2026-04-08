import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  reviews,
  type BottleRelease,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { ReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  review: z.number(),
  bottle: z.number().nullable().optional(),
  release: z.number().nullable().optional(),
  hidden: z.boolean().optional(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/reviews/{review}",
    summary: "Update review",
    description:
      "Update review properties such as visibility. Requires moderator privileges",
    operationId: "updateReview",
  })
  .input(
    InputSchema.partial().extend({
      review: z.coerce.number(),
    }),
  )
  .output(ReviewSchema)
  .handler(async function ({ input, context, errors }) {
    const {
      review: reviewId,
      bottle: nextBottleInput,
      release: nextReleaseInput,
      ...data
    } = input;

    const [targetReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!targetReview) {
      throw errors.NOT_FOUND({
        message: "Review not found.",
      });
    }

    let resolvedBottleId =
      nextBottleInput !== undefined ? nextBottleInput : targetReview.bottleId;
    let resolvedReleaseId =
      nextReleaseInput !== undefined
        ? nextReleaseInput
        : targetReview.releaseId;

    if (
      nextBottleInput !== undefined &&
      nextReleaseInput === undefined &&
      nextBottleInput !== targetReview.bottleId
    ) {
      resolvedReleaseId = null;
    }

    let targetRelease: BottleRelease | null = null;
    if (nextReleaseInput !== undefined && nextReleaseInput !== null) {
      targetRelease =
        (await db.query.bottleReleases.findFirst({
          where: eq(bottleReleases.id, nextReleaseInput),
        })) ?? null;

      if (!targetRelease) {
        throw errors.NOT_FOUND({
          message: "Release not found.",
        });
      }

      if (
        nextBottleInput !== undefined &&
        nextBottleInput !== null &&
        nextBottleInput !== targetRelease.bottleId
      ) {
        throw errors.BAD_REQUEST({
          message: "Release does not belong to the selected bottle.",
        });
      }

      resolvedBottleId = targetRelease.bottleId;
      resolvedReleaseId = targetRelease.id;
    }

    if (resolvedBottleId !== null) {
      const targetBottle = await db.query.bottles.findFirst({
        where: eq(bottles.id, resolvedBottleId),
      });

      if (!targetBottle) {
        throw errors.NOT_FOUND({
          message: "Bottle not found.",
        });
      }
    }

    if (
      Object.values(data).length === 0 &&
      nextBottleInput === undefined &&
      nextReleaseInput === undefined
    ) {
      return await serialize(ReviewSerializer, targetReview, context.user);
    }

    const [newReview] = await db
      .update(reviews)
      .set({
        ...data,
        bottleId: resolvedBottleId,
        releaseId: resolvedReleaseId,
      })
      .where(eq(reviews.id, reviewId))
      .returning();

    if (!newReview) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update review.",
      });
    }

    return await serialize(ReviewSerializer, newReview, context.user);
  });
