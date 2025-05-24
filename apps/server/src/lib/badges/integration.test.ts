import { db } from "@peated/server/db";

import { faker } from "@faker-js/faker";
import {
  badgeAwards,
  badgeAwardTrackedObjects,
} from "@peated/server/db/schema";
import { asc } from "drizzle-orm";
import { awardAllBadgeXp } from ".";
import { createTastingForBadge } from "./testHelpers";

describe("badge integration test", () => {
  test("test first tasting example", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    await fixtures.Badge({
      name: "Test",
      tracker: "bottle",
      checks: [
        {
          type: "everyTasting",
          config: {},
        },
      ],
      formula: "fibonacci",
      maxLevel: 1,
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

    const results = await awardAllBadgeXp(db, {
      ...tasting,
      bottle: bottleWithRelations,
    });
    expect(results.length).toBe(1);
    expect(results[0].xp).toEqual(1);
    expect(results[0].level).toEqual(1);
    expect(results[0].prevLevel).toEqual(0);
    expect(results[0].badge).toMatchInlineSnapshot(`
      {
        "checks": [
          {
            "config": {},
            "type": "everyTasting",
          },
        ],
        "formula": "fibonacci",
        "id": 1,
        "imageUrl": null,
        "maxLevel": 1,
        "name": "Test",
        "tracker": "bottle",
      }
    `);
  });

  test("test 50 states example", async ({ fixtures }) => {
    const user = await fixtures.User();

    const countrySc = await fixtures.Country({ name: "Scotland" });
    const regionHi = await fixtures.Region({
      countryId: countrySc.id,
      name: "Highland",
    });
    const countryUs = await fixtures.Country({ name: "United States" });
    const regionKy = await fixtures.Region({
      countryId: countryUs.id,
      name: "Kentucky",
    });
    const regionTn = await fixtures.Region({
      countryId: countryUs.id,
      name: "Tennessee",
    });
    const regionTx = await fixtures.Region({
      countryId: countryUs.id,
      name: "Texas",
    });

    const badge = await fixtures.Badge({
      name: "Test",
      formula: "linear",
      tracker: "region",
      checks: [
        {
          type: "region",
          config: {
            country: countryUs.id,
            region: null,
          },
        },
      ],
      maxLevel: 10,
    });

    for (const region of [regionKy, regionTn, regionTx, regionHi]) {
      const brand = await fixtures.Entity({
        name: region.name,
        regionId: region.id,
        countryId: region.countryId,
      });
      const tasting = await createTastingForBadge(
        fixtures,
        {
          name: faker.word.noun(),
          brand,
        },
        user.id,
      );

      await awardAllBadgeXp(db, tasting);
    }

    // now record one with a country without region, to make sure
    // somehow 'null' isnt bubbling up...
    const brand = await fixtures.Entity({
      name: "Brand",
      regionId: null,
      countryId: countryUs.id,
    });
    // protect ourselves from ourselves
    expect(brand.regionId).toBeNull();
    const tasting = await createTastingForBadge(
      fixtures,
      {
        name: faker.word.noun(),
        brand,
      },
      user.id,
    );

    await awardAllBadgeXp(db, tasting);

    const awardList = await db.select().from(badgeAwards);
    expect(awardList.length).toEqual(1);
    expect(awardList[0].badgeId).toEqual(badge.id);

    // test our tracked objects so its easier to debug failures
    const trackedList = await db
      .select()
      .from(badgeAwardTrackedObjects)
      .orderBy(asc(badgeAwardTrackedObjects.id));
    expect(trackedList.length).toEqual(3);
    expect(trackedList[0].objectType === "region");
    expect(trackedList[0].objectId === regionKy.id);
    expect(trackedList[1].objectType === "region");
    expect(trackedList[1].objectId === regionTn.id);
    expect(trackedList[2].objectType === "region");
    expect(trackedList[2].objectId === regionTx.id);

    expect(awardList[0].xp).toEqual(3);
    expect(awardList[0].level).toEqual(0);
  });
});
