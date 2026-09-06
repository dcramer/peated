import { db } from "@peated/server/db";
import {
  bottleTombstones,
  externalReviewArticles,
} from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /external-reviews/active-critics", () => {
  test("returns one latest public review per active site", async ({
    fixtures,
  }) => {
    const firstSite = await fixtures.ExternalSite({
      name: "First critic",
      type: "first-critic",
    });
    const secondSite = await fixtures.ExternalSite({
      name: "Second critic",
      type: "second-critic",
    });
    const hiddenSite = await fixtures.ExternalSite({
      name: "Hidden critic",
      type: "hidden-critic",
    });
    const unapprovedSite = await fixtures.ExternalSite({
      name: "Unapproved critic",
      type: "unapproved-critic",
    });
    const unresolvedSite = await fixtures.ExternalSite({
      name: "Unresolved critic",
      type: "unresolved-critic",
    });
    const missingDateSite = await fixtures.ExternalSite({
      name: "Undated critic",
      type: "undated-critic",
    });
    const deletedBottleSite = await fixtures.ExternalSite({
      name: "Retired Bottle critic",
      type: "retired-bottle-critic",
    });
    await Promise.all(
      [
        firstSite,
        secondSite,
        hiddenSite,
        unresolvedSite,
        missingDateSite,
        deletedBottleSite,
      ].map((site) =>
        fixtures.ApprovedExternalReviewPublication({ externalSiteId: site.id }),
      ),
    );

    const olderFirst = await fixtures.ExternalReview({
      externalSiteId: firstSite.id,
      url: "https://example.com/first-older",
    });
    const latestFirst = await fixtures.ExternalReview({
      externalSiteId: firstSite.id,
      url: "https://example.com/first-latest",
    });
    const second = await fixtures.ExternalReview({
      externalSiteId: secondSite.id,
      url: "https://example.com/second",
    });
    const hidden = await fixtures.ExternalReview({
      externalSiteId: hiddenSite.id,
      hidden: true,
    });
    const unapproved = await fixtures.ExternalReview({
      externalSiteId: unapprovedSite.id,
    });
    const unresolved = await fixtures.ExternalReview({
      bottleId: null,
      externalSiteId: unresolvedSite.id,
    });
    const missingDate = await fixtures.ExternalReview({
      externalSiteId: missingDateSite.id,
    });
    const retiredBottle = await fixtures.Bottle();
    const deletedBottle = await fixtures.ExternalReview({
      bottleId: retiredBottle.id,
      externalSiteId: deletedBottleSite.id,
    });
    await db.insert(bottleTombstones).values({ bottleId: retiredBottle.id });
    const dates = new Map([
      [olderFirst.articleId!, "2026-08-10T00:00:00.000Z"],
      [latestFirst.articleId!, "2026-08-30T00:00:00.000Z"],
      [second.articleId!, "2026-08-20T00:00:00.000Z"],
      [hidden.articleId!, "2026-09-01T00:00:00.000Z"],
      [unapproved.articleId!, "2026-09-02T00:00:00.000Z"],
      [unresolved.articleId!, "2026-09-03T00:00:00.000Z"],
      [deletedBottle.articleId!, "2026-09-04T00:00:00.000Z"],
      [missingDate.articleId!, null],
    ]);
    await Promise.all(
      [...dates].map(([articleId, publishedAt]) =>
        db
          .update(externalReviewArticles)
          .set({
            contentHash: `content-${articleId}`,
            publishedAt: publishedAt ? new Date(publishedAt) : null,
          })
          .where(eq(externalReviewArticles.id, articleId)),
      ),
    );

    const results = await routerClient.externalReviews.activeCritics({
      limit: 2,
    });

    expect(results).toEqual([
      {
        site: {
          type: firstSite.type,
          name: firstSite.name,
          imageUrl: null,
        },
        latestReview: {
          bottleName: latestFirst.name,
          publishedAt: "2026-08-30T00:00:00.000Z",
          url: "https://example.com/first-latest",
        },
      },
      {
        site: {
          type: secondSite.type,
          name: secondSite.name,
          imageUrl: null,
        },
        latestReview: {
          bottleName: second.name,
          publishedAt: "2026-08-20T00:00:00.000Z",
          url: "https://example.com/second",
        },
      },
    ]);
  });

  test("rejects a limit outside the public range", async () => {
    await expect(
      routerClient.externalReviews.activeCritics({ limit: 0 }),
    ).rejects.toThrow();
  });
});
