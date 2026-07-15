import { db } from "@peated/server/db";
import {
  bottleAliases,
  collectionBottles,
  flightBottles,
  tastings,
} from "@peated/server/db/schema";

async function getExactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottleId),
    columns: { id: true },
  });
  if (!target) throw new Error("Missing exact CatalogTarget fixture");
  return target.id;
}

async function getGenericTargetId(groupId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: (catalogTargets, { and, eq, isNull }) =>
      and(eq(catalogTargets.groupId, groupId), isNull(catalogTargets.bottleId)),
    columns: { id: true },
  });
  if (!target) throw new Error("Missing generic CatalogTarget fixture");
  return target.id;
}

describe("CatalogTarget set membership constraints", () => {
  test("collections enforce target membership while retaining null legacy rows", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);
    const collection = await fixtures.Collection();

    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
      targetId,
    });
    await expect(
      db.insert(collectionBottles).values({
        collectionId: collection.id,
        bottleId: otherBottle.id,
        targetId,
      }),
    ).rejects.toThrow(/collection_bottle_target_unq/);

    const otherCollection = await fixtures.Collection();
    await expect(
      db.insert(collectionBottles).values({
        collectionId: otherCollection.id,
        bottleId: bottle.id,
        targetId,
      }),
    ).resolves.toBeDefined();

    const legacyCollection = await fixtures.Collection();
    await expect(
      db.insert(collectionBottles).values([
        {
          collectionId: legacyCollection.id,
          bottleId: bottle.id,
          targetId: null,
        },
        {
          collectionId: legacyCollection.id,
          bottleId: otherBottle.id,
          targetId: null,
        },
      ]),
    ).resolves.toBeDefined();
  });

  test("flights enforce target membership while retaining null legacy rows", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);
    const flight = await fixtures.Flight();

    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: bottle.id,
      targetId,
    });
    await expect(
      db.insert(flightBottles).values({
        flightId: flight.id,
        bottleId: otherBottle.id,
        targetId,
      }),
    ).rejects.toThrow(/flight_bottle_target_unq/);

    const otherFlight = await fixtures.Flight();
    await expect(
      db.insert(flightBottles).values({
        flightId: otherFlight.id,
        bottleId: bottle.id,
        targetId,
      }),
    ).resolves.toBeDefined();

    const legacyFlight = await fixtures.Flight();
    await expect(
      db.insert(flightBottles).values([
        {
          flightId: legacyFlight.id,
          bottleId: bottle.id,
          targetId: null,
        },
        {
          flightId: legacyFlight.id,
          bottleId: otherBottle.id,
          targetId: null,
        },
      ]),
    ).resolves.toBeDefined();
  });

  test("tastings use target, user, and timestamp as the idempotency key", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);
    const otherTargetId = await getExactTargetId(otherBottle.id);
    const user = await fixtures.User();
    const otherUser = await fixtures.User();
    const createdAt = new Date("2026-07-14T12:00:00.000Z");

    await db.insert(tastings).values({
      bottleId: bottle.id,
      targetId,
      createdById: user.id,
      createdAt,
    });
    await expect(
      db.insert(tastings).values({
        bottleId: otherBottle.id,
        targetId,
        createdById: user.id,
        createdAt,
      }),
    ).rejects.toThrow(/tasting_target_unq/);

    await expect(
      db.insert(tastings).values([
        {
          bottleId: bottle.id,
          targetId,
          createdById: otherUser.id,
          createdAt,
        },
        {
          bottleId: bottle.id,
          targetId,
          createdById: user.id,
          createdAt: new Date(createdAt.getTime() + 1_000),
        },
        {
          bottleId: otherBottle.id,
          targetId: otherTargetId,
          createdById: user.id,
          createdAt,
        },
      ]),
    ).resolves.toBeDefined();

    await expect(
      db.insert(tastings).values([
        {
          bottleId: bottle.id,
          targetId: null,
          createdById: otherUser.id,
          createdAt: new Date(createdAt.getTime() + 2_000),
        },
        {
          bottleId: otherBottle.id,
          targetId: null,
          createdById: otherUser.id,
          createdAt: new Date(createdAt.getTime() + 2_000),
        },
      ]),
    ).resolves.toBeDefined();
  });

  test("aliases conflict case-insensitively across exact and generic targets", async ({
    fixtures,
  }) => {
    const exactBottle = await fixtures.Bottle();
    const genericBottle = await fixtures.Bottle();
    const exactTargetId = await getExactTargetId(exactBottle.id);
    const genericTargetId = await getGenericTargetId(
      genericBottle.groupId as number,
    );

    await db.insert(bottleAliases).values({
      bottleId: exactBottle.id,
      targetId: exactTargetId,
      name: "Cross Target Alias",
      assignedByActorId: exactBottle.createdByActorId,
    });
    await expect(
      db.insert(bottleAliases).values({
        targetId: genericTargetId,
        name: "cross target alias",
        assignedByActorId: genericBottle.createdByActorId,
      }),
    ).rejects.toThrow(/bottle_alias_name_idx/);
  });
});
