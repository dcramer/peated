import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottles,
  catalogTargets,
} from "@peated/server/db/schema";
import { pushJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import updateBottleGroupStats from "./updateBottleGroupStats";

test("recomputes the target group and schedules only the retained member Bottle entities", async ({
  fixtures,
}) => {
  const representativeBrand = await fixtures.Entity({
    name: "Representative Brand",
  });
  const representativeBottler = await fixtures.Entity({
    name: "Representative Bottler",
  });
  const representativeDistiller = await fixtures.Entity({
    name: "Representative Distiller",
  });
  const bottle = await fixtures.Bottle({
    brandId: representativeBrand.id,
    bottlerId: representativeBottler.id,
    distillerIds: [representativeDistiller.id],
  });
  const memberBrand = await fixtures.Entity({ name: "Member Brand" });
  const memberBottler = await fixtures.Entity({ name: "Member Bottler" });
  const memberDistiller = await fixtures.Entity({ name: "Member Distiller" });
  const member = await fixtures.LegacyBottle({
    brandId: memberBrand.id,
    bottlerId: memberBottler.id,
    distillerIds: [memberDistiller.id],
  });
  await db
    .update(bottles)
    .set({ groupId: bottle.groupId as number })
    .where(eq(bottles.id, member.id));
  await db.insert(catalogTargets).values({
    groupId: bottle.groupId as number,
    bottleId: member.id,
  });
  expect(member.id).not.toBe(bottle.id);
  expect(member.id).not.toBe(bottle.groupId);

  const targets = await db
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, bottle.groupId as number));
  const exactTarget = targets.find(({ bottleId }) => bottleId === bottle.id);
  const genericTarget = targets.find(({ bottleId }) => bottleId === null);
  if (!exactTarget || !genericTarget) {
    throw new Error("Missing Bottle target fixtures");
  }

  await fixtures.Tasting({
    bottleId: bottle.id,
    targetId: exactTarget.id,
    rating: SIMPLE_RATING_VALUES.PASS,
  });
  await fixtures.Tasting({
    bottleId: bottle.id,
    targetId: genericTarget.id,
    rating: SIMPLE_RATING_VALUES.SAVOR,
  });

  const result = await updateBottleGroupStats({
    groupId: bottle.groupId as number,
    entityStatsBottleId: member.id,
  });
  expect(result).toBeUndefined();

  const [persistedGroup] = await db
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, bottle.groupId as number));
  expect(persistedGroup).toMatchObject({
    totalBottles: 2,
    totalTastings: 2,
    avgRating: (SIMPLE_RATING_VALUES.PASS + SIMPLE_RATING_VALUES.SAVOR) / 2,
    ratingStats: {
      pass: 1,
      sip: 0,
      savor: 1,
      total: 2,
      avg: (SIMPLE_RATING_VALUES.PASS + SIMPLE_RATING_VALUES.SAVOR) / 2,
    },
  });

  expect(pushJob).toHaveBeenCalledTimes(3);
  for (const entityId of [
    memberDistiller.id,
    memberBrand.id,
    memberBottler.id,
  ]) {
    expect(pushJob).toHaveBeenCalledWith(
      "UpdateEntityStats",
      { entityId },
      { delay: 5000, removeOnComplete: true, removeOnFail: false },
    );
  }
  for (const entityId of [
    representativeDistiller.id,
    representativeBrand.id,
    representativeBottler.id,
    bottle.groupId as number,
  ]) {
    expect(pushJob).not.toHaveBeenCalledWith(
      "UpdateEntityStats",
      { entityId },
      expect.anything(),
    );
  }
});

test.each([
  undefined,
  {},
  { groupId: 0 },
  { groupId: -1 },
  { groupId: 1.5 },
  { groupId: "1" },
  { groupId: 1 },
  { groupId: 1, entityStatsBottleId: 0 },
  { groupId: 1, entityStatsBottleId: -1 },
  { groupId: 1, entityStatsBottleId: 1.5 },
  { groupId: 1, entityStatsBottleId: "1" },
  { groupId: 1, entityStatsBottleId: 1, unexpected: true },
])("rejects malformed job input %#", async (input) => {
  await expect(updateBottleGroupStats(input)).rejects.toThrow();
});

test("rethrows a BottleGroup statistics execution failure", async () => {
  const groupId = 2_000_000_000;

  await expect(
    updateBottleGroupStats({ groupId, entityStatsBottleId: 1 }),
  ).rejects.toThrow(
    `Cannot recompute BottleGroup ${groupId} statistics: not_found.`,
  );
});
