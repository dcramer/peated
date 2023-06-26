import { db } from "../../db";
import * as Fixtures from "../../lib/test/fixtures";

import { checkBadges } from ".";

describe("checkBadges", () => {
  test("returns matching region badge from brand", async () => {
    const badge = await Fixtures.Badge({
      type: "region",
      config: { regions: [{ country: "Scotland", region: "Islay" }] },
    });

    const brand = await Fixtures.Entity({
      country: "Scotland",
      region: "Islay",
    });

    const bottle = await Fixtures.Bottle({
      brandId: brand.id,
    });

    const tasting = await Fixtures.Tasting({
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
