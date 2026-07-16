import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottles,
  catalogTargets,
} from "@peated/server/db/schema";
import { pushJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import updateBottleStats from "./updateBottleStats";

beforeEach(() => {
  vi.mocked(pushJob).mockClear();
});

test("recomputes the exact target while scheduling retained legacy Bottle entities", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();
  const entityBrand = await fixtures.Entity({ name: "Entity Stats Brand" });
  const entityBottler = await fixtures.Entity({ name: "Entity Stats Bottler" });
  const entityDistiller = await fixtures.Entity({
    name: "Entity Stats Distiller",
  });
  const entityStatsBottle = await fixtures.Bottle({
    brandId: entityBrand.id,
    bottlerId: entityBottler.id,
    distillerIds: [entityDistiller.id],
  });
  const unrelated = await fixtures.Bottle();
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
    bottleId: entityStatsBottle.id,
    targetId: exactTarget.id,
    rating: SIMPLE_RATING_VALUES.SIP,
  });
  await fixtures.Tasting({
    bottleId: entityStatsBottle.id,
    targetId: genericTarget.id,
    rating: SIMPLE_RATING_VALUES.SAVOR,
  });
  await fixtures.Tasting({
    bottleId: unrelated.id,
    rating: SIMPLE_RATING_VALUES.PASS,
  });

  await updateBottleStats({
    bottleId: bottle.id,
    entityStatsBottleId: entityStatsBottle.id,
  });

  const [persistedBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));
  expect(persistedBottle).toMatchObject({
    totalTastings: 1,
    avgRating: SIMPLE_RATING_VALUES.SIP,
    ratingStats: {
      sip: 1,
      savor: 0,
      pass: 0,
      total: 1,
      avg: SIMPLE_RATING_VALUES.SIP,
    },
  });

  const [persistedGroup] = await db
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, bottle.groupId as number));
  expect(persistedGroup).toMatchObject({
    totalBottles: 1,
    totalTastings: 2,
    avgRating: (SIMPLE_RATING_VALUES.SIP + SIMPLE_RATING_VALUES.SAVOR) / 2,
    ratingStats: {
      sip: 1,
      savor: 1,
      pass: 0,
      total: 2,
      avg: (SIMPLE_RATING_VALUES.SIP + SIMPLE_RATING_VALUES.SAVOR) / 2,
    },
  });

  expect(pushJob).toHaveBeenCalledTimes(3);
  for (const entityId of [
    entityDistiller.id,
    entityBrand.id,
    entityBottler.id,
  ]) {
    expect(pushJob).toHaveBeenCalledWith(
      "UpdateEntityStats",
      { entityId },
      { delay: 5000, removeOnComplete: true, removeOnFail: false },
    );
  }
});

test("queues one refresh when an Entity fills every Bottle role", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "Deduplicated Stats Entity" });
  const bottle = await fixtures.Bottle({
    brandId: entity.id,
    bottlerId: entity.id,
    distillerIds: [entity.id],
  });

  await updateBottleStats({
    bottleId: bottle.id,
    entityStatsBottleId: bottle.id,
  });

  expect(pushJob).toHaveBeenCalledTimes(1);
  expect(pushJob).toHaveBeenCalledWith(
    "UpdateEntityStats",
    { entityId: entity.id },
    { delay: 5000, removeOnComplete: true, removeOnFail: false },
  );
});

test.each([
  undefined,
  {},
  { bottleId: 0 },
  { bottleId: -1 },
  { bottleId: 1.5 },
  { bottleId: "1" },
  { bottleId: 1 },
  { bottleId: 1, entityStatsBottleId: 0 },
  { bottleId: 1, entityStatsBottleId: -1 },
  { bottleId: 1, entityStatsBottleId: 1.5 },
  { bottleId: 1, entityStatsBottleId: "1" },
  { bottleId: 1, entityStatsBottleId: 1, unexpected: true },
])("rejects malformed job input %#", async (input) => {
  await expect(updateBottleStats(input)).rejects.toThrow();
});

test("rethrows a Bottle statistics execution failure", async () => {
  const bottleId = 2_000_000_000;

  await expect(
    updateBottleStats({ bottleId, entityStatsBottleId: 1 }),
  ).rejects.toThrow(
    `Cannot recompute Bottle ${bottleId} statistics: not_found.`,
  );
});
