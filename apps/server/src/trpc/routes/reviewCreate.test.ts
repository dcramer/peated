import { db } from "@peated/server/db";
import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires admin", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const err = await waitError(
    caller.reviewCreate({
      site: site.type,
      name: "Bottle Name",
      issue: "Default",
      rating: 89,
      url: "https://example.com",
      category: "single_malt",
    }),
  );
  expect(err).toMatchInlineSnapshot();
});

test("new review with new bottle no entity", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });

  const data = await caller.reviewCreate({
    site: site.type,
    name: "Bottle Name",
    issue: "Default",
    rating: 89,
    url: "https://example.com",
    category: "single_malt",
  });

  const review = await db.query.reviews.findFirst({
    where: (table, { eq }) => eq(table.id, data.id),
  });
  expect(review).toBeDefined();
  expect(review?.bottleId).toBeNull();
  expect(review?.name).toEqual("Bottle Name");
  expect(review?.issue).toEqual("Default");
  expect(review?.rating).toEqual(89);
  expect(review?.url).toEqual("https://example.com");
});

test("new review with new bottle matching entity", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();
  const brand = await fixtures.Entity();

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });

  const data = await caller.reviewCreate({
    site: site.type,
    name: `${brand.name} Bottle Name`,
    issue: "Default",
    rating: 89,
    url: "https://example.com",
    category: "single_malt",
  });

  const review = await db.query.reviews.findFirst({
    where: (table, { eq }) => eq(table.id, data.id),
  });
  expect(review).toBeDefined();
  expect(review?.bottleId).toBeTruthy();
  expect(review?.name).toEqual(`${brand.name} Bottle Name`);
  expect(review?.issue).toEqual("Default");
  expect(review?.rating).toEqual(89);
  expect(review?.url).toEqual("https://example.com");

  const bottle = await db.query.bottles.findFirst({
    where: (table, { eq }) => eq(table.id, review!.bottleId as number),
  });
  expect(bottle).toBeDefined();
  expect(bottle?.fullName).toEqual(`${brand.name} Bottle Name`);
  expect(bottle?.name).toEqual("Bottle Name");
  expect(bottle?.category).toEqual("single_malt");
  expect(bottle?.brandId).toEqual(brand.id);
});

test("new review with existing bottle", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite();
  const bottle = await fixtures.Bottle();

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });

  const data = await caller.reviewCreate({
    site: site.type,
    name: bottle.fullName,
    issue: "Default",
    rating: 89,
    url: "https://example.com",
    category: bottle.category,
  });

  const review = await db.query.reviews.findFirst({
    where: (table, { eq }) => eq(table.id, data.id),
  });
  expect(review).toBeDefined();
  expect(review?.bottleId).toEqual(bottle.id);
  expect(review?.name).toEqual(bottle.fullName);
  expect(review?.issue).toEqual("Default");
  expect(review?.rating).toEqual(89);
  expect(review?.url).toEqual("https://example.com");
});
