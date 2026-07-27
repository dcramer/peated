import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleTombstones,
  catalogTargets,
  entities,
  tastings,
} from "@peated/server/db/schema";
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

test("follows tasting.bottleId and ignores stale CatalogTarget evidence", async ({
  fixtures,
}) => {
  const directOwner = await fixtures.Entity({ name: "Direct Bottle Owner" });
  const staleTargetOwner = await fixtures.Entity({
    name: "Stale Target Owner",
  });
  const directBottle = await fixtures.Bottle({
    name: "Direct Identity Expression",
    brandId: directOwner.id,
  });
  const staleTargetBottle = await fixtures.Bottle({
    name: "Stale Target Expression",
    brandId: staleTargetOwner.id,
  });
  const staleTarget = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, staleTargetBottle.id),
  });
  if (!staleTarget) throw new Error("Missing exact CatalogTarget fixture");

  await fixtures.Tasting({
    bottleId: directBottle.id,
    targetId: staleTarget.id,
  });

  await updateEntityStats({ entityId: directOwner.id });
  await updateEntityStats({ entityId: staleTargetOwner.id });

  expect(await getEntity(directOwner.id)).toMatchObject({
    totalBottles: 1,
    totalTastings: 1,
  });
  expect(await getEntity(staleTargetOwner.id)).toMatchObject({
    totalBottles: 1,
    totalTastings: 0,
  });
});

test("ignores unresolved tastings with a null bottleId", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "Resolved Bottle Owner" });
  const bottle = await fixtures.Bottle({
    name: "Resolved Tasting Expression",
    brandId: entity.id,
  });
  const tasting = await fixtures.Tasting({ bottleId: bottle.id });
  await db
    .update(tastings)
    .set({ bottleId: null })
    .where(eq(tastings.id, tasting.id));

  await updateEntityStats({ entityId: entity.id });

  expect(await getEntity(entity.id)).toMatchObject({
    totalBottles: 1,
    totalTastings: 0,
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

test("excludes Bottle- and group-tombstoned members and their tastings", async ({
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
  const retiredGroupBottle = await fixtures.Bottle({
    name: "Retired Group Expression",
    brandId: entity.id,
  });
  const destination = await fixtures.Bottle({
    name: "Tombstone Destination Expression",
  });
  await fixtures.Tasting({ bottleId: activeBottle.id });
  await fixtures.Tasting({ bottleId: retiredBottle.id });
  await fixtures.Tasting({ bottleId: retiredGroupBottle.id });

  await db.insert(bottleTombstones).values({
    bottleId: retiredBottle.id,
    newBottleId: destination.id,
  });
  await db.insert(bottleGroupTombstones).values({
    groupId: requireBottleGroupId(retiredGroupBottle),
    newGroupId: requireBottleGroupId(destination),
    createdByActorId: retiredGroupBottle.createdByActorId,
  });

  await updateEntityStats({ entityId: entity.id });

  expect(await getEntity(entity.id)).toMatchObject({
    totalBottles: 1,
    totalTastings: 1,
  });
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
