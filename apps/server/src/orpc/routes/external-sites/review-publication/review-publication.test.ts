import { db } from "@peated/server/db";
import {
  bottleTombstones,
  externalReviewPublications,
  externalReviews,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { asc, eq } from "drizzle-orm";

describe("external review publication routes", () => {
  test("requires a moderator", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const user = await fixtures.User();

    const getError = await waitError(() =>
      routerClient.externalSites.reviewPublication.get(
        { site: site.type },
        { context: { user } },
      ),
    );
    const updateError = await waitError(() =>
      routerClient.externalSites.reviewPublication.update(
        { site: site.type, publication: { approved: true } },
        { context: { user } },
      ),
    );

    expect(getError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(updateError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns an unapproved default", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const moderator = await fixtures.User({ mod: true });

    const result = await routerClient.externalSites.reviewPublication.get(
      { site: site.type },
      { context: { user: moderator } },
    );

    expect(result).toMatchObject({
      externalSiteId: site.id,
      approved: false,
      approvedAt: null,
    });
  });

  test("does not expose publishing for retailer sources", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const moderator = await fixtures.User({ mod: true });

    const error = await waitError(() =>
      routerClient.externalSites.reviewPublication.get(
        { site: site.type },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Review source not found.]`);
  });

  test("approves and stops publishing", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const moderator = await fixtures.User({ mod: true });

    const approved = await routerClient.externalSites.reviewPublication.update(
      { site: site.type, publication: { approved: true } },
      { context: { user: moderator } },
    );
    expect(approved.approved).toBe(true);
    expect(approved.approvedAt).not.toBeNull();

    const approvedAgain =
      await routerClient.externalSites.reviewPublication.update(
        { site: site.type, publication: { approved: true } },
        { context: { user: moderator } },
      );
    expect(approvedAgain.approvedAt).toBe(approved.approvedAt);

    const stopped = await routerClient.externalSites.reviewPublication.update(
      { site: site.type, publication: { approved: false } },
      { context: { user: moderator } },
    );
    expect(stopped).toMatchObject({ approved: false, approvedAt: null });

    const persisted = await db.query.externalReviewPublications.findFirst({
      where: eq(externalReviewPublications.externalSiteId, site.id),
    });
    expect(persisted?.approvedAt).toBeNull();
  });

  test("publishes staged reviews with active resolved Bottles", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const activeBottle = await fixtures.Bottle({ name: "Active Bottle" });
    const retiredBottle = await fixtures.Bottle({ name: "Retired Bottle" });
    const replacementBottle = await fixtures.Bottle({
      name: "Replacement Bottle",
    });
    await fixtures.ExternalReview({
      externalSiteId: site.id,
      sourceKey: "active",
      name: "Active review",
      bottleId: activeBottle.id,
      hidden: true,
    });
    await fixtures.ExternalReview({
      externalSiteId: site.id,
      sourceKey: "unresolved",
      name: "Unresolved review",
      bottleId: null,
      hidden: true,
    });
    await fixtures.ExternalReview({
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

    const result = await routerClient.externalSites.reviewPublication.update(
      { site: site.type, publication: { approved: true } },
      { context: { user: moderator } },
    );

    expect(result.approved).toBe(true);
    expect(
      await db
        .select({ name: externalReviews.name, hidden: externalReviews.hidden })
        .from(externalReviews)
        .orderBy(asc(externalReviews.name)),
    ).toEqual([
      { name: "Active review", hidden: false },
      { name: "Retired review", hidden: true },
      { name: "Unresolved review", hidden: true },
    ]);
  });
});
