import { db } from "@peated/server/db";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("POST /reviews", () => {
  test("requires admin", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.reviews.create(
        {
          site: site.type,
          name: "Bottle Name",
          issue: "Default",
          rating: 89,
          url: "https://example.com",
          category: "single_malt",
        },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });

  test("new review with new bottle no entity", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite();
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: "Bottle Name",
        issue: "Default",
        rating: 89,
        url: "https://example.com",
        category: "single_malt",
      },
      { context: { user: adminUser } }
    );

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
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: `${brand.name} Bottle Name`,
        issue: "Default",
        rating: 89,
        url: "https://example.com",
        category: "single_malt",
      },
      { context: { user: adminUser } }
    );

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
    const bottle = await fixtures.Bottle({
      name: "Delicious",
      vintageYear: null,
      releaseYear: null,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: bottle.fullName,
        issue: "Default",
        rating: 89,
        url: "https://example.com",
        category: bottle.category,
      },
      { context: { user: adminUser } }
    );

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

  test("returns error for non-existent site", async ({ fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.reviews.create(
        {
          site: "non-existent-site" as any, // force invalid type here
          name: "Bottle Name",
          issue: "Default",
          rating: 89,
          url: "https://example.com",
          category: "single_malt",
        },
        { context: { user: adminUser } }
      )
    );
    expect(err).toMatchInlineSnapshot("[Error: Input validation failed]");
  });
});
