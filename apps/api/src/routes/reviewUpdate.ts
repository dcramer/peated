import { db } from "@peated/server/db";
import { reviews } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "../trpc";
import { type Context } from "../trpc/context";

const InputSchema = z.object({
  review: z.number(),
  hidden: z.boolean().optional(),
});

export async function reviewUpdate({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const { review: reviewId, ...data } = input;

  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId));

  if (!review) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  if (Object.values(data).length === 0) {
    return await serialize(ReviewSerializer, review, ctx.user);
  }

  const [newReview] = await db
    .update(reviews)
    .set(data)
    .where(eq(reviews.id, reviewId))
    .returning();

  if (!newReview) {
    throw new TRPCError({
      message: "Failed to update review.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return await serialize(ReviewSerializer, newReview, ctx.user);
}

export default modProcedure.input(InputSchema).mutation(reviewUpdate);
