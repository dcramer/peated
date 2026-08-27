import { db } from "@peated/server/db";
import { bottleTombstones, entities } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import updateEntityStats from "./updateEntityStats";

const ownerRoles = ["brand", "bottler", "distiller"] as const;

type OwnerRole = (typeof ownerRoles)[number];

function bottleOwnerData(ownerRole: OwnerRole, entityId: number) {
  switch (ownerRole) {
    case "brand":
      return { brandId: entityId };
    case "bottler":
      return { bottlerId: entityId };
    case "distiller":
      return { distillerIds: [entityId] };
  }
}

function requireBottleGroupId(bottle: { groupId: number | null }) {
  if (bottle.groupId === null) throw new Error("Missing BottleGroup fixture");
  return bottle.groupId;
}

async function getEntity(entityId: number) {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityId));
  if (!entity) throw new Error(`Missing Entity ${entityId}`);
  return entity;
}

test("counts direct active Bottles and tastings for every Entity association", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "Direct Bottle Entity" });

  for (const ownerRole of ownerRoles) {
    const bottle = await fixtures.Bottle({
      ...bottleOwnerData(ownerRole, entity.id),
      name: `Direct ${ownerRole} Bottle`,
    });
    await fixtures.Tasting({ bottleId: bottle.id });
  }
  await fixtures.LegacyBottle({
    name: "Ungrouped Legacy Bottle",
    brandId: entity.id,
  });

  await updateEntityStats({ entityId: entity.id });

  expect(await getEntity(entity.id)).toMatchObject({
    totalBottles: 3,
    totalTastings: 3,
  });
});

test("counts each tasting once when an Entity fills every Bottle association", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "All Bottle Roles Entity" });
  const bottle = await fixtures.Bottle({
    name: "All Bottle Roles Expression",
    brandId: entity.id,
    bottlerId: entity.id,
    distillerIds: [entity.id],
  });
  await fixtures.Tasting({ bottleId: bottle.id });

  await updateEntityStats({ entityId: entity.id });

  expect(await getEntity(entity.id)).toMatchObject({
    totalBottles: 1,
    totalTastings: 1,
  });
});

test("counts exact Bottles in the same group independently", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "Same Group Owner" });
  const first = await fixtures.Bottle({
    name: "Same Group Expression",
    brandId: entity.id,
  });
  const second = await fixtures.BottleGroupMember({
    groupId: requireBottleGroupId(first),
    edition: "Second Exact Bottle",
  });
  await fixtures.Tasting({ bottleId: first.id });
  await fixtures.Tasting({ bottleId: second.id });

  await updateEntityStats({ entityId: entity.id });

  expect(await getEntity(entity.id)).toMatchObject({
    totalBottles: 2,
    totalTastings: 2,
  });
});

test("excludes Bottle-tombstoned members and their tastings", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "Active Entity" });
  const activeBottle = await fixtures.Bottle({
    name: "Active Stats Expression",
    brandId: entity.id,
  });
  const retiredBottle = await fixtures.Bottle({
    name: "Retired Bottle Expression",
    brandId: entity.id,
  });
  const destination = await fixtures.Bottle({
    name: "Tombstone Destination Expression",
  });
  await fixtures.Tasting({ bottleId: activeBottle.id });
  await fixtures.Tasting({ bottleId: retiredBottle.id });

  await db.insert(bottleTombstones).values({
    bottleId: retiredBottle.id,
    newBottleId: destination.id,
  });

  await updateEntityStats({ entityId: entity.id });

  expect(await getEntity(entity.id)).toMatchObject({
    totalBottles: 1,
    totalTastings: 1,
  });
});

test("skips stale work for a deleted Entity", async () => {
  await expect(
    updateEntityStats({ entityId: 2_147_483_647 }),
  ).resolves.toBeUndefined();
});

test.each([
  undefined,
  {},
  { entityId: 0 },
  { entityId: -1 },
  { entityId: 1.5 },
  { entityId: "1" },
  { entityId: 1, unexpected: true },
])("rejects malformed job input %#", async (input) => {
  await expect(updateEntityStats(input)).rejects.toThrow();
});
