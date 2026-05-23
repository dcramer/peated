import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /reviews", () => {
  test("lists reviews", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting();
    await fixtures.Review({ externalSiteId: site.id });
    await fixtures.Review({ externalSiteId: site.id });

    const { results } = await routerClient.reviews.list(
      {},
      { context: { user } },
    );

    expect(results.length).toBe(2);
  });

  test("errors without mod", async ({ fixtures }) => {
    const user = await fixtures.User();

    const err = await waitError(
      routerClient.reviews.list({}, { context: { user } }),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Must be a moderator to list all reviews.]`,
    );
  });

  test("lists reviews by site", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const astorwine = await fixtures.ExternalSiteOrExisting({
      type: "astorwines",
    });
    const totalwine = await fixtures.ExternalSiteOrExisting({
      type: "totalwine",
    });

    const review = await fixtures.Review({ externalSiteId: astorwine.id });
    await fixtures.Review({ externalSiteId: totalwine.id });

    const { results } = await routerClient.reviews.list(
      {
        site: astorwine.type,
      },
      { context: { user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(review.id);
  });

  test("lists reviews by release", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
      externalSiteId: site.id,
    });
    await fixtures.Review({
      bottleId: bottle.id,
      externalSiteId: site.id,
      issue: "Other",
    });

    const { results } = await routerClient.reviews.list({
      release: release.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(review.id);
  });

  test("errors on site without mod", async ({ fixtures }) => {
    const user = await fixtures.User();
    const site = await fixtures.ExternalSiteOrExisting();

    const err = await waitError(
      routerClient.reviews.list(
        {
          site: site.type,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Must be a moderator to list all reviews.]`,
    );
  });
});
