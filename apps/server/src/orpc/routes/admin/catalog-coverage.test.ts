import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /admin/catalog/coverage", () => {
  test("reports active catalog and visible source-item coverage", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const coveredBottle = await fixtures.Bottle({
      description: "A useful description",
      imageUrl: "https://example.com/covered.jpg",
    });
    await fixtures.Bottle({
      description: "   ",
      imageUrl: "",
    });
    const hiddenOnlyBottle = await fixtures.Bottle();
    await fixtures.LegacyBottle({
      description: "Legacy description",
      imageUrl: "https://example.com/legacy.jpg",
    });
    const retiredBottle = await fixtures.Bottle({
      description: "Retired description",
      imageUrl: "https://example.com/retired.jpg",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: coveredBottle.id,
    });

    await fixtures.ExternalReview({
      bottleId: coveredBottle.id,
      name: "Covered review one",
    });
    await fixtures.ExternalReview({
      bottleId: coveredBottle.id,
      name: "Covered review two",
    });
    await fixtures.ExternalReview({
      bottleId: retiredBottle.id,
      name: "Retired bottle review",
    });
    await fixtures.ExternalReview({
      bottleId: null,
      name: "Unmatched review",
    });
    await fixtures.ExternalReview({
      bottleId: hiddenOnlyBottle.id,
      name: "Hidden review",
      hidden: true,
    });

    await fixtures.StorePrice({
      bottleId: coveredBottle.id,
      name: "Covered listing one",
    });
    await fixtures.StorePrice({
      bottleId: coveredBottle.id,
      name: "Covered listing two",
    });
    await fixtures.StorePrice({
      bottleId: retiredBottle.id,
      name: "Retired bottle listing",
    });
    await fixtures.StorePrice({
      bottleId: null,
      name: "Unmatched listing",
    });
    await fixtures.StorePrice({
      bottleId: hiddenOnlyBottle.id,
      name: "Hidden listing",
      hidden: true,
    });

    const result = await routerClient.admin.catalogCoverage(undefined, {
      context: { user: admin },
    });

    expect(result).toEqual({
      bottles: {
        total: 3,
        withDescription: 1,
        withImage: 1,
        withReviews: 1,
        withPriceListings: 1,
      },
      externalReviews: {
        total: 4,
        matched: 3,
        unmatched: 1,
      },
      priceListings: {
        total: 4,
        matched: 3,
        unmatched: 1,
      },
    });
  });

  test("requires an administrator", async ({ defaults }) => {
    const anonymousError = await waitError(
      routerClient.admin.catalogCoverage(),
    );
    const userError = await waitError(
      routerClient.admin.catalogCoverage(undefined, {
        context: { user: defaults.user },
      }),
    );

    expect(anonymousError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(userError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
