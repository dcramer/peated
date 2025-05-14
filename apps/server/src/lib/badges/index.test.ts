import { db } from "@peated/server/db";
import { badgeAwards, tastingBadgeAwards } from "@peated/server/db/schema";
import { awardAllBadgeXp, rescanBadge } from ".";
import { createTastingForBadge } from "./testHelpers";

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
