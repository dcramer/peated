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
import updateBottleGroupStats from "./updateBottleGroupStats";

beforeEach(() => {
  vi.mocked(pushJob).mockClear();
});

test("recomputes a generic target and queues only group-owned entities", async ({
  fixtures,
}) => {
  const groupBrand = await fixtures.Entity({ name: "Group Stats Brand" });
  const groupBottler = await fixtures.Entity({ name: "Group Stats Bottler" });
  const groupDistiller = await fixtures.Entity({
    name: "Group Stats Distiller",
  });
  const memberBrand = await fixtures.Entity({ name: "Drifted Member Brand" });
  const memberBottler = await fixtures.Entity({
    name: "Drifted Member Bottler",
  });
  const memberDistiller = await fixtures.Entity({
    name: "Drifted Member Distiller",
  });
  const bottle = await fixtures.Bottle({
    brandId: groupBrand.id,
    bottlerId: groupBottler.id,
    distillerIds: [groupDistiller.id],
  });
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

  const targets = await db
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, bottle.groupId as number));
  const exactTarget = targets.find(({ bottleId }) => bottleId === bottle.id);
  const genericTarget = targets.find(({ bottleId }) => bottleId === null);
  if (!exactTarget || !genericTarget) throw new Error("Missing target fixture");

  await fixtures.Tasting({
    bottleId: member.id,
    targetId: exactTarget.id,
    rating: SIMPLE_RATING_VALUES.PASS,
  });
  await fixtures.Tasting({
    bottleId: member.id,
    targetId: genericTarget.id,
    rating: SIMPLE_RATING_VALUES.SAVOR,
  });

  await updateBottleGroupStats({ targetId: genericTarget.id });

  const [persistedGroup] = await db
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, bottle.groupId as number));
  expect(persistedGroup).toMatchObject({
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
  for (const entityId of [
    memberBrand.id,
    memberBottler.id,
    memberDistiller.id,
  ]) {
    expect(pushJob).not.toHaveBeenCalledWith(
      "UpdateEntityStats",
      { entityId },
      expect.anything(),
    );
  }
});

test("queues one refresh when one Entity fills every generic group role", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "Deduplicated Group Entity" });
  const bottle = await fixtures.Bottle({ brandId: entity.id });
  await db
    .update(bottleGroups)
    .set({ brandId: entity.id, bottlerId: entity.id })
    .where(eq(bottleGroups.id, bottle.groupId as number));
  await db.insert(bottleGroupDistillers).values({
    groupId: bottle.groupId as number,
    distillerId: entity.id,
  });
  const target = await db.query.catalogTargets.findFirst({
    where: (catalogTargets, { and, eq, isNull }) =>
      and(
        eq(catalogTargets.groupId, bottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
  });
  if (!target) throw new Error("Missing generic target fixture");

  await updateBottleGroupStats({ targetId: target.id });

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
  { groupId: 1 },
])("rejects malformed job input %#", async (input) => {
  await expect(updateBottleGroupStats(input)).rejects.toThrow();
});

test("rejects an exact target", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const target = await db.query.catalogTargets.findFirst({
    where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottle.id),
  });
  if (!target) throw new Error("Missing exact target fixture");

  await expect(updateBottleGroupStats({ targetId: target.id })).rejects.toThrow(
    "UpdateBottleGroupStats requires a generic BottleGroup target",
  );
});

test("rejects a missing target", async () => {
  await expect(
    updateBottleGroupStats({ targetId: 2_000_000_000 }),
  ).rejects.toThrow("Catalog target not found");
});
