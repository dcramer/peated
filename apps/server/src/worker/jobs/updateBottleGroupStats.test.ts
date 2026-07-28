import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
} from "@peated/server/db/schema";
import { pushJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import updateBottleGroupStats from "./updateBottleGroupStats";

beforeEach(() => {
  vi.mocked(pushJob).mockClear();
});

test("recomputes direct member activity and queues only group-owned entities", async ({
  fixtures,
}) => {
  const groupBrand = await fixtures.Entity({ name: "Group Stats Brand" });
  const groupBottler = await fixtures.Entity({ name: "Group Stats Bottler" });
  const groupDistiller = await fixtures.Entity({
    name: "Group Stats Distiller",
  });
  const memberBrand = await fixtures.Entity({ name: "Member Stats Brand" });
  const member = await fixtures.LegacyBottle({ brandId: memberBrand.id });
  const bottle = await fixtures.Bottle({
    brandId: groupBrand.id,
    bottlerId: groupBottler.id,
    distillerIds: [groupDistiller.id],
  });
  const groupId = bottle.groupId as number;
  await db.update(bottles).set({ groupId }).where(eq(bottles.id, member.id));
  await fixtures.Tasting({
    bottleId: bottle.id,
    rating: SIMPLE_RATING_VALUES.PASS,
  });
  await fixtures.Tasting({
    bottleId: member.id,
    rating: SIMPLE_RATING_VALUES.SAVOR,
  });

  await updateBottleGroupStats({ groupId });

  await expect(
    db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, groupId),
    }),
  ).resolves.toMatchObject({
    totalBottles: 2,
    totalTastings: 2,
    avgRating: (SIMPLE_RATING_VALUES.PASS + SIMPLE_RATING_VALUES.SAVOR) / 2,
  });

  expect(pushJob).toHaveBeenCalledTimes(3);
  for (const entityId of [groupBrand.id, groupBottler.id, groupDistiller.id]) {
    expect(pushJob).toHaveBeenCalledWith(
      "UpdateEntityStats",
      { entityId },
      { delay: 5000, removeOnComplete: true, removeOnFail: false },
    );
  }
  expect(pushJob).not.toHaveBeenCalledWith(
    "UpdateEntityStats",
    { entityId: memberBrand.id },
    expect.anything(),
  );
});

test("deduplicates one Entity used by every group role", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "Deduplicated Group Entity" });
  const bottle = await fixtures.Bottle({ brandId: entity.id });
  const groupId = bottle.groupId as number;
  await db
    .update(bottleGroups)
    .set({ brandId: entity.id, bottlerId: entity.id })
    .where(eq(bottleGroups.id, groupId));
  await db.insert(bottleGroupDistillers).values({
    groupId,
    distillerId: entity.id,
  });

  await updateBottleGroupStats({ groupId });

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
  { groupId: 0 },
  { groupId: -1 },
  { groupId: 1.5 },
  { groupId: "1" },
  { groupId: 1, unexpected: true },
  { legacyId: 1 },
])("rejects malformed job input %#", async (input) => {
  await expect(updateBottleGroupStats(input)).rejects.toThrow();
});

test("rejects a missing BottleGroup", async () => {
  await expect(
    updateBottleGroupStats({ groupId: 2_000_000_000 }),
  ).rejects.toThrow(
    "Cannot recompute BottleGroup 2000000000 statistics: not_found",
  );
});
