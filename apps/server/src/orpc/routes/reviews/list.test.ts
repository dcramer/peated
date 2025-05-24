import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /reviews", () => {
  test("lists reviews", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSite();
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
    const astorwine = await fixtures.ExternalSite({ type: "astorwines" });
    const totalwine = await fixtures.ExternalSite({ type: "totalwine" });

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

  test("errors on site without mod", async ({ fixtures }) => {
    const user = await fixtures.User();
    const site = await fixtures.ExternalSite();

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
