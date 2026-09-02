import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /countries/{country}/regions/{region}/flavor-profile", () => {
  test("uses producing distilleries and deduplicates bottles with multiple distillers", async ({
    fixtures,
    defaults,
  }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const first = await fixtures.Entity({
      kind: "distillery",
      countryId: country.id,
      regionId: region.id,
    });
    const second = await fixtures.Entity({
      kind: "distillery",
      countryId: country.id,
      regionId: region.id,
    });
    const brand = await fixtures.Entity({
      kind: "brand",
      countryId: country.id,
      regionId: region.id,
    });
    const produced = await fixtures.Bottle({
      distillerIds: [first.id, second.id],
    });
    const branded = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [],
    });
    await fixtures.Tag({ name: "apple", tagCategory: "fruit" });
    await db.insert(tastings).values(
      [produced, branded].map((bottle) => ({
        bottleId: bottle.id,
        createdById: defaults.user.id,
        tags: ["apple"],
      })),
    );

    const input = {
      country: country.slug.toUpperCase(),
      region: region.slug.toUpperCase(),
    };
    const result = await routerClient.regions.flavorProfile(input);
    expect(result.totalBottles).toBe(1);
    expect(result.notedBottles).toBe(1);
    expect(result.categories.find((item) => item.category === "fruit")).toEqual(
      {
        category: "fruit",
        bottleCount: 1,
        notes: [{ name: "apple", bottleCount: 1 }],
      },
    );
    expect(
      await routerClient.regions.flavorProfile({
        country: String(country.id),
        region: String(region.id),
      }),
    ).toEqual(result);
  });

  test("keeps the region scoped to its country", async ({ fixtures }) => {
    const region = await fixtures.Region();
    const otherCountry = await fixtures.Country();
    await expect(
      routerClient.regions.flavorProfile({
        country: String(otherCountry.id),
        region: String(region.id),
      }),
    ).rejects.toThrow("Region not found.");
    await expect(
      routerClient.regions.flavorProfile({
        country: "missing-country",
        region: region.slug,
      }),
    ).rejects.toThrow("Country not found.");
  });
});
