import { db } from "@peated/server/db";
import { reviews } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PATCH /reviews/:review", () => {
  test("requires mod role", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });
    const review = await fixtures.Review();

    const err = await waitError(
      routerClient.reviews.update(
        { review: review.id, hidden: true },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates hidden status to true", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review({ hidden: false });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id, hidden: true },
      { context: { user } }
    );

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview.hidden).toBe(true);
  });

  test("updates hidden status to false", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review({ hidden: true });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id, hidden: false },
      { context: { user } }
    );

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview.hidden).toBe(false);
  });

  test("returns NOT_FOUND for non-existent review", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.reviews.update(
        { review: 999999, hidden: true },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Review not found.]`);
  });

  test("returns existing review if no data is sent", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review({ hidden: false });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id }, // no actual update data (hidden is optional)
      { context: { user } }
    );

    expect(newReviewData.id).toBe(review.id);
  });
});
