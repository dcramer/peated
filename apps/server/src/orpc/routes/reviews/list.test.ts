import { db } from "@peated/server/db";
import { actors } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq, sql } from "drizzle-orm";

describe("GET /reviews", () => {
  test("lists reviews", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.Review({ externalSiteId: site.id });
    await fixtures.Review({ externalSiteId: site.id });

    const { results } = await routerClient.reviews.list(
      {},
      { context: { user } },
    );

    expect(results.length).toBe(2);
    const result = results.find(({ id }) => id === review.id)!;
    expect(result.bottle?.id).toBe(review.bottleId);
    expect(result).not.toHaveProperty("target");
    expect(result).not.toHaveProperty("release");
  });

  test("authenticated serialization does not mutate the user's Actor", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    await fixtures.Review({ externalSiteId: site.id });
    const currentUser = await fixtures.User({ mod: true });
    const sentinel = {
      active: false,
      displayName: "review read sentinel",
    } as const;
    await db
      .update(actors)
      .set(sentinel)
      .where(eq(actors.userId, currentUser.id));
    const [{ count: before }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(actors);

    await routerClient.reviews.list({}, { context: { user: currentUser } });

    const [{ count: after }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(actors);
    const actor = await db.query.actors.findFirst({
      where: eq(actors.userId, currentUser.id),
      columns: { active: true, displayName: true },
    });
    expect(after).toBe(before);
    expect(actor).toEqual(sentinel);
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

  test("lists reviews by direct Bottle identity", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting();
    const firstDirect = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: bottle.id,
      issue: "First direct review",
    });
    const secondDirect = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: bottle.id,
      issue: "Second direct review",
    });
    const otherReview = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: otherBottle.id,
      issue: "Other Bottle review",
    });

    const { results } = await routerClient.reviews.list({ bottle: bottle.id });

    expect(results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([firstDirect.id, secondDirect.id]),
    );
    expect(results.map(({ id }) => id)).not.toContain(otherReview.id);
    expect(
      results.every(
        ({ bottle: resultBottle }) => resultBottle?.id === bottle.id,
      ),
    ).toBe(true);
    expect(results.every((review) => !("target" in review))).toBe(true);
  });

  test("rejects removed target and release filters", async () => {
    await expect(
      waitError(() => routerClient.reviews.list({ target: 1 } as never)),
    ).resolves.toMatchObject({ message: "Input validation failed" });
    await expect(
      waitError(() => routerClient.reviews.list({ release: 1 } as never)),
    ).resolves.toMatchObject({ message: "Input validation failed" });
  });

  test("paginates reviews by direct Bottle identity", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting();
    const firstReview = await fixtures.Review({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: "A direct Bottle review",
    });
    const secondReview = await fixtures.Review({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: "B direct Bottle review",
    });
    const otherReview = await fixtures.Review({
      bottleId: otherBottle.id,
      externalSiteId: site.id,
      name: "C other Bottle review",
    });

    const firstPage = await routerClient.reviews.list({
      bottle: bottle.id,
      limit: 1,
    });
    const secondPage = await routerClient.reviews.list({
      bottle: bottle.id,
      cursor: 2,
      limit: 1,
    });
    const thirdPage = await routerClient.reviews.list({
      bottle: bottle.id,
      cursor: 3,
      limit: 1,
    });
    const results = [...firstPage.results, ...secondPage.results];

    expect(results.map(({ id }) => id)).toEqual([
      firstReview.id,
      secondReview.id,
    ]);
    expect(results.map(({ id }) => id)).not.toContain(otherReview.id);
    expect(firstPage.rel.nextCursor).toBe(2);
    expect(secondPage.rel.nextCursor).toBeNull();
    expect(thirdPage.results).toEqual([]);
  });

  test("preserves empty Bottle-filter misses", async () => {
    await expect(
      routerClient.reviews.list({ bottle: 999_999 }),
    ).resolves.toMatchObject({ results: [] });
  });

  test("uses direct Bottle identity for unresolved filtering", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting();
    const unresolved = await fixtures.Review({
      bottleId: null,
      externalSiteId: site.id,
    });
    const retainedBottle = await fixtures.Bottle();
    const firstAssigned = await fixtures.Review({
      bottleId: retainedBottle.id,
      externalSiteId: site.id,
      issue: "First assigned review",
    });
    const secondAssigned = await fixtures.Review({
      bottleId: retainedBottle.id,
      externalSiteId: site.id,
      issue: "Second assigned review",
    });

    const unknownResults = await routerClient.reviews.list(
      { onlyUnknown: true },
      { context: { user } },
    );
    const allResults = await routerClient.reviews.list(
      {},
      { context: { user } },
    );

    expect(unknownResults.results.map(({ id }) => id)).toContain(unresolved.id);
    expect(unknownResults.results.map(({ id }) => id)).not.toContain(
      firstAssigned.id,
    );
    expect(unknownResults.results.map(({ id }) => id)).not.toContain(
      secondAssigned.id,
    );
    expect(allResults.results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        unresolved.id,
        firstAssigned.id,
        secondAssigned.id,
      ]),
    );
    expect(unknownResults.results.every(({ bottle }) => bottle === null)).toBe(
      true,
    );
  });

  test("requires a moderator for unknown reviews even with a Bottle filter", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    const err = await waitError(
      routerClient.reviews.list({
        bottle: bottle.id,
        onlyUnknown: true,
      }),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Must be a moderator to list all reviews.]`,
    );
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
