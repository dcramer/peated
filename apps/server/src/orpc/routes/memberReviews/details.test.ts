import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /member-reviews/:review", () => {
  test("returns the review with its bottle", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const review = await routerClient.memberReviews.save(
      { bottle: bottle.id, notes: "Bright fruit.", score: 91 },
      { context: { user: defaults.user } },
    );

    await expect(
      routerClient.memberReviews.details({ review: review.id }),
    ).resolves.toMatchObject({
      id: review.id,
      bottle: { id: bottle.id },
      notes: "Bright fruit.",
      score: 91,
    });
  });

  test("hides a private member's review from strangers", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const member = await fixtures.User({ private: true });
    const review = await routerClient.memberReviews.save(
      { bottle: bottle.id, notes: null, score: 88 },
      { context: { user: member } },
    );

    const error = await waitError(
      routerClient.memberReviews.details({ review: review.id }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Member review not found.]`);
  });
});
