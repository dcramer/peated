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
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates hidden status to true", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review({ hidden: false });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id, hidden: true },
      { context: { user } },
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
      { context: { user } },
    );

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview.hidden).toBe(false);
  });

  test("assigns a release and infers the parent bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      fullName: `${bottle.fullName} - Batch 4`,
      name: `${bottle.name} - Batch 4`,
      edition: "Batch 4",
    });
    const review = await fixtures.Review({ bottleId: null, releaseId: null });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id, release: release.id },
      { context: { user } },
    );

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview.bottleId).toBe(bottle.id);
    expect(updatedReview.releaseId).toBe(release.id);
    expect(newReviewData.bottle?.id).toBe(bottle.id);
    expect(newReviewData.release?.id).toBe(release.id);
  });

  test("clears release when changing the bottle without an explicit release", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      fullName: `${bottle.fullName} - Batch 4`,
      name: `${bottle.name} - Batch 4`,
      edition: "Batch 4",
    });
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
    });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id, bottle: otherBottle.id },
      { context: { user } },
    );

    const [updatedReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(updatedReview.bottleId).toBe(otherBottle.id);
    expect(updatedReview.releaseId).toBeNull();
    expect(newReviewData.bottle?.id).toBe(otherBottle.id);
    expect(newReviewData.release).toBeNull();
  });

  test("rejects mismatched bottle and release updates", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const review = await fixtures.Review({ bottleId: null, releaseId: null });

    const err = await waitError(
      routerClient.reviews.update(
        {
          review: review.id,
          bottle: otherBottle.id,
          release: release.id,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Release does not belong to the selected bottle.]`,
    );
  });

  test("returns NOT_FOUND for non-existent review", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.reviews.update(
        { review: 999999, hidden: true },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Review not found.]`);
  });

  test("returns existing review if no data is sent", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const review = await fixtures.Review({ hidden: false });

    const newReviewData = await routerClient.reviews.update(
      { review: review.id }, // no actual update data (hidden is optional)
      { context: { user } },
    );

    expect(newReviewData.id).toBe(review.id);
  });
});
