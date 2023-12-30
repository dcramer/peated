import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists reviews", async () => {
  await Fixtures.Review();
  await Fixtures.Review();

  const caller = appRouter.createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const { results } = await caller.reviewList();

  expect(results.length).toBe(2);
});

test("lists reviews without mod", async () => {
  await Fixtures.Review();
  await Fixtures.Review();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() => caller.reviewList()).rejects.toThrowError(/BAD_REQUEST/);
});

test("lists reviews by site", async () => {
  const astorwine = await Fixtures.ExternalSite({ type: "astorwines" });
  const totalwines = await Fixtures.ExternalSite({ type: "totalwines" });

  const review = await Fixtures.Review({ externalSiteId: astorwine.id });
  await Fixtures.Review({ externalSiteId: totalwines.id });

  const caller = appRouter.createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const { results } = await caller.reviewList({
    site: astorwine.type,
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(review.id);
});

test("lists reviews by site without mod", async () => {
  await Fixtures.Review();
  await Fixtures.Review();

  const site = await Fixtures.ExternalSite();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.reviewList({
      site: site.type,
    }),
  ).rejects.toThrowError(/BAD_REQUEST/);
});
