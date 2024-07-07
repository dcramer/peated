import { db } from "../../db";

import { checkBadges } from ".";

describe("checkBadges", () => {
  test("returns matching region badge from brand", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    const badge = await fixtures.Badge({
      type: "region",
      config: { regions: [{ countryId: country.id, regionId: region.id }] },
    });

    const brand = await fixtures.Entity({
      countryId: country.id,
      regionId: region.id,
    });

    const bottle = await fixtures.Bottle({
      brandId: brand.id,
    });

    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
    });

    const bottleWithRelations = await db.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, bottle.id),
      with: {
        brand: true,
        bottler: true,
        bottlesToDistillers: {
          with: { distiller: true },
        },
      },
    });

    if (!bottleWithRelations) throw new Error();

    const results = await checkBadges(db, {
      ...tasting,
      bottle: bottleWithRelations,
    });
    expect(results.length).toBe(1);
    expect(results[0].id === badge.id);
  });
});
