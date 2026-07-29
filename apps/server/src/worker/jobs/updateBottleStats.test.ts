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
import updateBottleStats from "./updateBottleStats";

beforeEach(() => {
  vi.mocked(pushJob).mockClear();
});

test("recomputes direct Bottle and group activity and queues Bottle-owned entities", async ({
  fixtures,
}) => {
  const brand = await fixtures.Entity({ name: "Direct Stats Brand" });
  const bottler = await fixtures.Entity({ name: "Direct Stats Bottler" });
  const distiller = await fixtures.Entity({ name: "Direct Stats Distiller" });
  const bottle = await fixtures.Bottle({
    brandId: brand.id,
    bottlerId: bottler.id,
    distillerIds: [distiller.id],
  });
  const groupBrand = await fixtures.Entity({ name: "Group-Only Stats Brand" });
  const groupBottler = await fixtures.Entity({
    name: "Group-Only Stats Bottler",
  });
  const groupDistiller = await fixtures.Entity({
    name: "Group-Only Stats Distiller",
  });
  const groupId = bottle.groupId;
  if (groupId === null) throw new Error("Missing BottleGroup fixture");
  await db
    .update(bottleGroups)
    .set({ brandId: groupBrand.id, bottlerId: groupBottler.id })
    .where(eq(bottleGroups.id, groupId));
  await db
    .delete(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.groupId, groupId));
  await db.insert(bottleGroupDistillers).values({
    groupId,
    distillerId: groupDistiller.id,
  });
  await fixtures.Tasting({
    bottleId: bottle.id,
    rating: SIMPLE_RATING_VALUES.SIP,
  });

  await updateBottleStats({ bottleId: bottle.id });

  await expect(
    db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
  ).resolves.toMatchObject({
    totalTastings: 1,
    avgRating: SIMPLE_RATING_VALUES.SIP,
  });
  await expect(
    db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, groupId),
    }),
  ).resolves.toMatchObject({
    totalTastings: 1,
    avgRating: SIMPLE_RATING_VALUES.SIP,
  });

  expect(pushJob).toHaveBeenCalledTimes(3);
  for (const entityId of [brand.id, bottler.id, distiller.id]) {
    expect(pushJob).toHaveBeenCalledWith(
      "UpdateEntityStats",
      { entityId },
      { delay: 5000, removeOnComplete: true, removeOnFail: false },
    );
  }
  for (const entityId of [groupBrand.id, groupBottler.id, groupDistiller.id]) {
    expect(pushJob).not.toHaveBeenCalledWith(
      "UpdateEntityStats",
      { entityId },
      expect.anything(),
    );
  }
});

test("deduplicates one Entity used by every Bottle role", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "Deduplicated Stats Entity" });
  const bottle = await fixtures.Bottle({
    brandId: entity.id,
    bottlerId: entity.id,
    distillerIds: [entity.id],
  });

  await updateBottleStats({ bottleId: bottle.id });

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
  { bottleId: 1, unexpected: true },
  { legacyId: 1 },
])("rejects malformed job input %#", async (input) => {
  await expect(updateBottleStats(input)).rejects.toThrow();
});

test("rejects a missing Bottle", async () => {
  await expect(updateBottleStats({ bottleId: 2_000_000_000 })).rejects.toThrow(
    "Cannot recompute Bottle 2000000000 statistics: not_found",
  );
});
