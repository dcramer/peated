import { db } from "@peated/server/db";
import {
  bottleTombstones,
  externalReviewSourcePolicies,
  reviews,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { asc, eq } from "drizzle-orm";

const reviewOnlyPolicy = {
  publicationMode: "review_only" as const,
  allowLlmProcessing: true,
  allowScoreDisplay: true,
  allowSummaryDisplay: true,
};

describe("external review source policy routes", () => {
  test("requires a moderator", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const user = await fixtures.User();

    const getError = await waitError(() =>
      routerClient.externalSites.reviewPolicy.get(
        { site: site.type },
        { context: { user } },
      ),
    );
    const setError = await waitError(() =>
      routerClient.externalSites.reviewPolicy.set(
        { site: site.type, policy: reviewOnlyPolicy },
        { context: { user } },
      ),
    );

    expect(getError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(setError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns disabled defaults before a policy is enabled", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const moderator = await fixtures.User({ mod: true });

    const result = await routerClient.externalSites.reviewPolicy.get(
      { site: site.type },
      { context: { user: moderator } },
    );

    expect(result).toMatchObject({
      externalSiteId: site.id,
      publicationMode: "disabled",
      allowLlmProcessing: false,
      allowScoreDisplay: false,
      allowSummaryDisplay: false,
    });
  });

  test("enables source capabilities", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const moderator = await fixtures.User({ mod: true });

    const result = await routerClient.externalSites.reviewPolicy.set(
      { site: site.type, policy: reviewOnlyPolicy },
      { context: { user: moderator } },
    );

    expect(result).toMatchObject({
      externalSiteId: site.id,
      ...reviewOnlyPolicy,
    });
  });

  test("disabling a source clears its capabilities", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: site.id,
    });
    const moderator = await fixtures.User({ mod: true });

    const result = await routerClient.externalSites.reviewPolicy.set(
      {
        site: site.type,
        policy: { publicationMode: "disabled" },
      },
      { context: { user: moderator } },
    );

    expect(result).toMatchObject({
      publicationMode: "disabled",
      allowLlmProcessing: false,
      allowScoreDisplay: false,
      allowSummaryDisplay: false,
    });

    const persisted = await db.query.externalReviewSourcePolicies.findFirst({
      where: eq(externalReviewSourcePolicies.externalSiteId, site.id),
    });
    expect(persisted).toMatchObject({
      publicationMode: "disabled",
      allowLlmProcessing: false,
      allowScoreDisplay: false,
      allowSummaryDisplay: false,
    });
  });

  test("rejects summary display without the LLM processing capability", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const moderator = await fixtures.User({ mod: true });

    const error = await waitError(() =>
      routerClient.externalSites.reviewPolicy.set(
        {
          site: site.type,
          policy: {
            ...reviewOnlyPolicy,
            allowLlmProcessing: false,
          },
        },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("does not expose policy controls for retailer sources", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const moderator = await fixtures.User({ mod: true });

    const error = await waitError(() =>
      routerClient.externalSites.reviewPolicy.get(
        { site: site.type },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Review source not found.]`);
  });

  test("publishes staged reviews with active resolved Bottles", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: site.id,
    });
    const activeBottle = await fixtures.Bottle({ name: "Active Bottle" });
    const retiredBottle = await fixtures.Bottle({ name: "Retired Bottle" });
    const replacementBottle = await fixtures.Bottle({
      name: "Replacement Bottle",
    });
    await fixtures.Review({
      externalSiteId: site.id,
      sourceKey: "active",
      name: "Active review",
      bottleId: activeBottle.id,
      hidden: true,
    });
    await fixtures.Review({
      externalSiteId: site.id,
      sourceKey: "unresolved",
      name: "Unresolved review",
      bottleId: null,
      hidden: true,
    });
    await fixtures.Review({
      externalSiteId: site.id,
      sourceKey: "retired",
      name: "Retired review",
      bottleId: retiredBottle.id,
      hidden: true,
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: replacementBottle.id,
    });
    const moderator = await fixtures.User({ mod: true });

    const result = await routerClient.externalSites.reviewPolicy.set(
      {
        site: site.type,
        policy: {
          ...reviewOnlyPolicy,
          publicationMode: "automatic",
        },
      },
      { context: { user: moderator } },
    );

    expect(result.publicationMode).toBe("automatic");
    expect(
      await db
        .select({ name: reviews.name, hidden: reviews.hidden })
        .from(reviews)
        .orderBy(asc(reviews.name)),
    ).toEqual([
      { name: "Active review", hidden: false },
      { name: "Retired review", hidden: true },
      { name: "Unresolved review", hidden: true },
    ]);
  });
});
