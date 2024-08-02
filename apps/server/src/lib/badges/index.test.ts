import { db } from "../../db";

import { badgeAwards, tastingBadgeAwards } from "@peated/server/db/schema";
import { awardAllBadgeXp, rescanBadge } from ".";
import { createTastingForBadge } from "./testHelpers";

describe("awardAllBadgeXp", () => {
  test("returns everyTasting badge from brand", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    await fixtures.Badge({
      name: "Test",
      checks: [
        {
          type: "everyTasting",
          config: {},
        },
      ],
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
    expect(results[0].level).toEqual(0);
    expect(results[0].prevLevel).toEqual(0);
    expect(results[0].badge).toMatchInlineSnapshot(`
      {
        "checks": [
          {
            "config": {},
            "type": "everyTasting",
          },
        ],
        "formula": "default",
        "id": 1,
        "imageUrl": null,
        "maxLevel": 1,
        "name": "Test",
        "tracker": "bottle",
      }
    `);
  });
});

describe("rescanBadge", () => {
  test("rescans age with new tastings", async ({ fixtures }) => {
    const badge = await fixtures.Badge({
      checks: [
        {
          type: "age",
          config: {
            minAge: 5,
            maxAge: 5,
          },
        },
      ],
    });

    const user1 = await fixtures.User();
    const tasting1 = await fixtures.Tasting({
      bottleId: (
        await fixtures.Bottle({
          name: "A",
          statedAge: 5,
        })
      ).id,
      createdById: user1.id,
    });

    const user2 = await fixtures.User();
    const tasting2 = await fixtures.Tasting({
      bottleId: (
        await fixtures.Bottle({
          name: "B",
          statedAge: 12,
        })
      ).id,
      createdById: user2.id,
    });

    await rescanBadge(badge);

    const awardList = await db.select().from(badgeAwards);
    expect(awardList.length).toEqual(1);
    expect(awardList[0].level).toEqual(0);
    expect(awardList[0].xp).toEqual(1);
    expect(awardList[0].badgeId).toEqual(badge.id);
    expect(awardList[0].userId).toEqual(user1.id);

    const tastingAwardList = await db.select().from(tastingBadgeAwards);
    expect(tastingAwardList.length).toEqual(0);
    // expect(tastingAwardList[0].tastingId).toEqual(tasting1.id);
    // expect(tastingAwardList[0].awardId).toEqual(awardList[0].id);
    // expect(tastingAwardList[0].level).toEqual(0);
  });

  test("rescans age with existing tastings", async ({ fixtures }) => {
    const badge = await fixtures.Badge({
      checks: [
        {
          type: "age",
          config: {
            minAge: 5,
            maxAge: 5,
          },
        },
      ],
    });

    const tasting1 = await createTastingForBadge(fixtures, {
      name: "A",
      statedAge: 5,
    });

    const initial = await awardAllBadgeXp(db, tasting1);
    expect(initial.length).toEqual(1);

    await rescanBadge(badge);

    const awardList = await db.select().from(badgeAwards);
    expect(awardList.length).toEqual(1);
    expect(awardList[0].level).toEqual(0);
    expect(awardList[0].xp).toEqual(1);
    expect(awardList[0].badgeId).toEqual(badge.id);

    const tastingAwardList = await db.select().from(tastingBadgeAwards);
    expect(tastingAwardList.length).toEqual(0);
    // expect(tastingAwardList[0].tastingId).toEqual(tasting1.id);
    // expect(tastingAwardList[0].awardId).toEqual(awardList[0].id);
    // expect(tastingAwardList[0].level).toEqual(0);
  });
});

import { defaultCalculateLevel } from ".";

describe("defaultCalculateLevel", () => {
  test("basic tests", () => {
    expect(defaultCalculateLevel(1, 50)).toMatchInlineSnapshot(`0`);
    expect(defaultCalculateLevel(5, 50)).toMatchInlineSnapshot(`1`);
    expect(defaultCalculateLevel(10, 50)).toMatchInlineSnapshot(`2`);
    expect(defaultCalculateLevel(15, 50)).toMatchInlineSnapshot(`2`);
    expect(defaultCalculateLevel(20, 50)).toMatchInlineSnapshot(`3`);
    expect(defaultCalculateLevel(25, 50)).toMatchInlineSnapshot(`4`);
    expect(defaultCalculateLevel(30, 50)).toMatchInlineSnapshot(`5`);
    expect(defaultCalculateLevel(35, 50)).toMatchInlineSnapshot(`5`);
    expect(defaultCalculateLevel(40, 50)).toMatchInlineSnapshot(`6`);
    expect(defaultCalculateLevel(45, 50)).toMatchInlineSnapshot(`7`);
    expect(defaultCalculateLevel(50, 50)).toMatchInlineSnapshot(`7`);
    expect(defaultCalculateLevel(75, 50)).toMatchInlineSnapshot(`9`);
    expect(defaultCalculateLevel(100, 50)).toMatchInlineSnapshot(`12`);
    expect(defaultCalculateLevel(150, 50)).toMatchInlineSnapshot(`15`);
    expect(defaultCalculateLevel(250, 50)).toMatchInlineSnapshot(`20`);
    expect(defaultCalculateLevel(500, 50)).toMatchInlineSnapshot(`28`);
    expect(defaultCalculateLevel(1000, 50)).toMatchInlineSnapshot(`39`);
  });
});

import { linearCalculateLevel } from ".";

describe("linearCalculateLevel", () => {
  test("basic tests", () => {
    expect(linearCalculateLevel(1, 50)).toMatchInlineSnapshot(`0`);
    expect(linearCalculateLevel(5, 50)).toMatchInlineSnapshot(`1`);
    expect(linearCalculateLevel(10, 50)).toMatchInlineSnapshot(`2`);
    expect(linearCalculateLevel(15, 50)).toMatchInlineSnapshot(`3`);
    expect(linearCalculateLevel(20, 50)).toMatchInlineSnapshot(`4`);
    expect(linearCalculateLevel(25, 50)).toMatchInlineSnapshot(`5`);
    expect(linearCalculateLevel(30, 50)).toMatchInlineSnapshot(`6`);
    expect(linearCalculateLevel(35, 50)).toMatchInlineSnapshot(`7`);
    expect(linearCalculateLevel(40, 50)).toMatchInlineSnapshot(`8`);
    expect(linearCalculateLevel(45, 50)).toMatchInlineSnapshot(`9`);
    expect(linearCalculateLevel(50, 50)).toMatchInlineSnapshot(`10`);
    expect(linearCalculateLevel(75, 50)).toMatchInlineSnapshot(`15`);
    expect(linearCalculateLevel(100, 50)).toMatchInlineSnapshot(`20`);
    expect(linearCalculateLevel(150, 50)).toMatchInlineSnapshot(`30`);
    expect(linearCalculateLevel(250, 50)).toMatchInlineSnapshot(`50`);
    expect(linearCalculateLevel(500, 50)).toMatchInlineSnapshot(`50`);
    expect(linearCalculateLevel(1000, 50)).toMatchInlineSnapshot(`50`);
  });
});
