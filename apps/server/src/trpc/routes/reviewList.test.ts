import { createCaller } from "../router";

test("lists reviews", async ({ fixtures }) => {
  await fixtures.Review();
  await fixtures.Review();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const { results } = await caller.reviewList();

  expect(results.length).toBe(2);
});

test("lists reviews without mod", async ({ defaults, fixtures }) => {
  await fixtures.Review();
  await fixtures.Review();

  const caller = createCaller({ user: defaults.user });
  expect(() => caller.reviewList()).rejects.toThrowError(/BAD_REQUEST/);
});

test("lists reviews by site", async ({ fixtures }) => {
  const astorwine = await fixtures.ExternalSite({ type: "astorwines" });
  const totalwine = await fixtures.ExternalSite({ type: "totalwine" });

  const review = await fixtures.Review({ externalSiteId: astorwine.id });
  await fixtures.Review({ externalSiteId: totalwine.id });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const { results } = await caller.reviewList({
    site: astorwine.type,
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(review.id);
});

test("lists reviews by site without mod", async ({ defaults, fixtures }) => {
  await fixtures.Review();
  await fixtures.Review();

  const site = await fixtures.ExternalSite();

  const caller = createCaller({ user: defaults.user });
  expect(() =>
    caller.reviewList({
      site: site.type,
    }),
  ).rejects.toThrowError(/BAD_REQUEST/);
});
