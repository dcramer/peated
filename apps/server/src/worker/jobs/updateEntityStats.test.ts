import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottlesToDistillers,
  catalogTargets,
  entities,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import updateEntityStats from "./updateEntityStats";

const ownerRoles = ["brand", "bottler", "distiller"] as const;
const targetKinds = ["exact", "generic"] as const;

type OwnerRole = (typeof ownerRoles)[number];
type TargetKind = (typeof targetKinds)[number];

const targetOwnerCases = targetKinds.flatMap((targetKind) =>
  ownerRoles.map((ownerRole) => ({ ownerRole, targetKind })),
);

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

async function replaceNonAuthoritativeOwner({
  bottle,
  entityId,
  ownerRole,
  targetKind,
}: {
  bottle: { id: number; groupId: number };
  entityId: number;
  ownerRole: OwnerRole;
  targetKind: TargetKind;
}) {
  if (targetKind === "exact") {
    switch (ownerRole) {
      case "brand":
        await db
          .update(bottleGroups)
          .set({ brandId: entityId })
          .where(eq(bottleGroups.id, bottle.groupId));
        return;
      case "bottler":
        await db
          .update(bottleGroups)
          .set({ bottlerId: entityId })
          .where(eq(bottleGroups.id, bottle.groupId));
        return;
      case "distiller":
        await db
          .delete(bottleGroupDistillers)
          .where(eq(bottleGroupDistillers.groupId, bottle.groupId));
        await db.insert(bottleGroupDistillers).values({
          groupId: bottle.groupId,
          distillerId: entityId,
        });
        return;
    }
  }

  switch (ownerRole) {
    case "brand":
      await db
        .update(bottles)
        .set({ brandId: entityId })
        .where(eq(bottles.id, bottle.id));
      return;
    case "bottler":
      await db
        .update(bottles)
        .set({ bottlerId: entityId })
        .where(eq(bottles.id, bottle.id));
      return;
    case "distiller":
      await db
        .delete(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, bottle.id));
      await db.insert(bottlesToDistillers).values({
        bottleId: bottle.id,
        distillerId: entityId,
      });
  }
}

async function getEntity(entityId: number) {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityId));
  if (!entity) throw new Error(`Missing Entity ${entityId}`);
  return entity;
}

test("counts only active concrete Bottles", async ({ fixtures }) => {
  const entity = await fixtures.Entity({ name: "Active Bottle Entity" });
  await fixtures.Bottle({ name: "Exact Brand", brandId: entity.id });
  await fixtures.Bottle({ name: "Exact Bottler", bottlerId: entity.id });
  await fixtures.Bottle({ name: "Exact Distiller", distillerIds: [entity.id] });
  await fixtures.LegacyBottle({
    name: "Ungrouped Legacy Bottle",
    brandId: entity.id,
  });

  await updateEntityStats({ entityId: entity.id });

  expect((await getEntity(entity.id)).totalBottles).toBe(3);
});

describe.each(targetOwnerCases)(
  "$targetKind target with $ownerRole ownership",
  ({ ownerRole, targetKind }) => {
    test("counts tastings for the authoritative owner", async ({
      fixtures,
    }) => {
      const targetOwner = await fixtures.Entity({
        name: `${targetKind} ${ownerRole} owner`,
      });
      const nonAuthoritativeOwner = await fixtures.Entity({
        name: `${targetKind} ${ownerRole} non-authoritative owner`,
      });
      const retainedPairOwner = await fixtures.Entity({
        name: `${targetKind} ${ownerRole} retained-pair owner`,
      });
      const targetBottle = await fixtures.Bottle(
        bottleOwnerData(ownerRole, targetOwner.id),
      );
      const groupId = requireBottleGroupId(targetBottle);
      const retainedPairBottle = await fixtures.LegacyBottle({
        brandId: retainedPairOwner.id,
      });
      await replaceNonAuthoritativeOwner({
        bottle: { id: targetBottle.id, groupId },
        entityId: nonAuthoritativeOwner.id,
        ownerRole,
        targetKind,
      });

      const target = await db.query.catalogTargets.findFirst({
        where: (catalogTargets, { and, eq, isNull }) =>
          targetKind === "exact"
            ? eq(catalogTargets.bottleId, targetBottle.id)
            : and(
                eq(catalogTargets.groupId, groupId),
                isNull(catalogTargets.bottleId),
              ),
      });
      if (!target) throw new Error(`Missing ${targetKind} target fixture`);

      await fixtures.Tasting({
        bottleId: retainedPairBottle.id,
        targetId: target.id,
      });

      for (const entityId of [
        targetOwner.id,
        nonAuthoritativeOwner.id,
        retainedPairOwner.id,
      ]) {
        await updateEntityStats({ entityId });
      }

      expect((await getEntity(targetOwner.id)).totalTastings).toBe(1);
      expect((await getEntity(nonAuthoritativeOwner.id)).totalTastings).toBe(0);
      expect((await getEntity(retainedPairOwner.id)).totalTastings).toBe(0);
    });
  },
);

test("counts each tasting once when an Entity fills every owner role", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ name: "All Target Roles Entity" });
  const bottle = await fixtures.Bottle({
    brandId: entity.id,
    bottlerId: entity.id,
    distillerIds: [entity.id],
  });
  const groupId = requireBottleGroupId(bottle);
  const targets = await db
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, groupId));
  const exactTarget = targets.find(({ bottleId }) => bottleId === bottle.id);
  const genericTarget = targets.find(({ bottleId }) => bottleId === null);
  if (!exactTarget || !genericTarget) throw new Error("Missing target fixture");
  await fixtures.Tasting({ bottleId: bottle.id, targetId: exactTarget.id });
  await fixtures.Tasting({ bottleId: bottle.id, targetId: genericTarget.id });

  await updateEntityStats({ entityId: entity.id });

  expect((await getEntity(entity.id)).totalTastings).toBe(2);
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
