import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
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

test("recomputes an exact target and queues its Bottle-owned entities", async ({
  fixtures,
}) => {
  const brand = await fixtures.Entity({ name: "Exact Stats Brand" });
  const bottler = await fixtures.Entity({ name: "Exact Stats Bottler" });
  const distiller = await fixtures.Entity({ name: "Exact Stats Distiller" });
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
  const retainedPairBottle = await fixtures.Bottle();
  const targets = await db
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, groupId));
  const exactTarget = targets.find(({ bottleId }) => bottleId === bottle.id);
  const genericTarget = targets.find(({ bottleId }) => bottleId === null);
  if (!exactTarget || !genericTarget) throw new Error("Missing target fixture");

  await fixtures.Tasting({
    bottleId: retainedPairBottle.id,
    targetId: exactTarget.id,
    rating: SIMPLE_RATING_VALUES.SIP,
  });
  await fixtures.Tasting({
    bottleId: retainedPairBottle.id,
    targetId: genericTarget.id,
    rating: SIMPLE_RATING_VALUES.SAVOR,
  });

  await updateBottleStats({ targetId: exactTarget.id });

  const [persistedBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));
  expect(persistedBottle).toMatchObject({
    totalTastings: 1,
    avgRating: SIMPLE_RATING_VALUES.SIP,
  });
  const [persistedGroup] = await db
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, groupId));
  expect(persistedGroup).toMatchObject({
    totalTastings: 2,
    avgRating: (SIMPLE_RATING_VALUES.SIP + SIMPLE_RATING_VALUES.SAVOR) / 2,
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

test("queues one refresh when one Entity fills every exact Bottle role", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "Deduplicated Stats Entity" });
  const bottle = await fixtures.Bottle({
    brandId: entity.id,
    bottlerId: entity.id,
    distillerIds: [entity.id],
  });
  const [exactTarget] = await db
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.bottleId, bottle.id));
  if (!exactTarget) throw new Error("Missing exact target fixture");

  await updateBottleStats({ targetId: exactTarget.id });

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
  { targetId: 0 },
  { targetId: -1 },
  { targetId: 1.5 },
  { targetId: "1" },
  { targetId: 1, unexpected: true },
  { bottleId: 1 },
])("rejects malformed job input %#", async (input) => {
  await expect(updateBottleStats(input)).rejects.toThrow();
});

test("rejects a generic target", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const target = await db.query.catalogTargets.findFirst({
    where: (catalogTargets, { and, eq, isNull }) =>
      and(
        eq(catalogTargets.groupId, bottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
  });
  if (!target) throw new Error("Missing generic target fixture");

  await expect(updateBottleStats({ targetId: target.id })).rejects.toThrow(
    "UpdateBottleStats requires an exact Bottle target",
  );
});

test("rejects a missing target", async () => {
  await expect(updateBottleStats({ targetId: 2_000_000_000 })).rejects.toThrow(
    "Catalog target not found",
  );
});
