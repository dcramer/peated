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
        "id": 1,
        "imageUrl": null,
        "maxLevel": 1,
        "name": "Test",
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
    expect(awardList[0].level).toEqual(1);
    expect(awardList[0].xp).toEqual(1);
    expect(awardList[0].badgeId).toEqual(badge.id);
    expect(awardList[0].userId).toEqual(user1.id);

    const tastingAwardList = await db.select().from(tastingBadgeAwards);
    expect(tastingAwardList.length).toEqual(1);
    expect(tastingAwardList[0].tastingId).toEqual(tasting1.id);
    expect(tastingAwardList[0].awardId).toEqual(awardList[0].id);
    expect(tastingAwardList[0].level).toEqual(1);
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
    expect(awardList[0].level).toEqual(1);
    expect(awardList[0].xp).toEqual(1);
    expect(awardList[0].badgeId).toEqual(badge.id);

    const tastingAwardList = await db.select().from(tastingBadgeAwards);
    expect(tastingAwardList.length).toEqual(1);
    expect(tastingAwardList[0].tastingId).toEqual(tasting1.id);
    expect(tastingAwardList[0].awardId).toEqual(awardList[0].id);
    expect(tastingAwardList[0].level).toEqual(1);
  });
});
