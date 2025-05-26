import { db } from "@peated/server/db";
import { reviews } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { ReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  review: z.number(),
  hidden: z.boolean().optional(),
});

export default procedure
  .use(requireMod)
  .route({ method: "PATCH", path: "/reviews/{review}" })
  .input(
    InputSchema.partial().extend({
      review: z.coerce.number(),
    }),
  )
  .output(ReviewSchema)
  .handler(async function ({ input, context, errors }) {
    const { review: reviewId, ...data } = input;

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

    if (Object.values(data).length === 0) {
      return await serialize(ReviewSerializer, targetReview, context.user);
    }

    const [newReview] = await db
      .update(reviews)
      .set(data)
      .where(eq(reviews.id, reviewId))
      .returning();

    if (!newReview) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update review.",
      });
    }

    return await serialize(ReviewSerializer, newReview, context.user);
  });
