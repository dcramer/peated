import { ORPCError } from "@orpc/server";
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
  .route({ method: "PATCH", path: "/reviews/:review" })
  .input(InputSchema)
  .output(ReviewSchema)
  .handler(async ({ input, context }) => {
    const { review: reviewId, ...data } = input;

    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId));

    if (!review) {
      throw new ORPCError("NOT_FOUND");
    }

    if (Object.values(data).length === 0) {
      return await serialize(ReviewSerializer, review, context.user);
    }

    const [newReview] = await db
      .update(reviews)
      .set(data)
      .where(eq(reviews.id, reviewId))
      .returning();

    if (!newReview) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to update review.",
      });
    }

    return await serialize(ReviewSerializer, newReview, context.user);
  });
