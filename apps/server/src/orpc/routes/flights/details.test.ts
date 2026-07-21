import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottles,
  catalogTargets,
  collectionBottles,
  flightBottles,
  type Bottle,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";

async function promoteRelease(parent: Bottle, releaseId: number) {
  const [promoted] = await db
    .insert(bottles)
    .values({
      groupId: parent.groupId,
      brandId: parent.brandId,
      name: `${parent.name} promoted`,
      fullName: `${parent.fullName} promoted`,
      createdByActorId: parent.createdByActorId,
    })
    .returning();
  if (!promoted) throw new Error("Missing promoted Bottle fixture");
  const [target] = await db
    .insert(catalogTargets)
    .values({ groupId: parent.groupId as number, bottleId: promoted.id })
    .returning();
  if (!target) throw new Error("Missing promoted target fixture");
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId: promoted.id,
    status: "promoted",
    completedAt: new Date(),
    createdByActorId: parent.createdByActorId,
  });
  return { promoted, target };
}

describe("GET /flights/:flight", () => {
  test("returns independently complete exact Bottle targets", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({
      name: "Batch 24",
      fullName: "Springbank 12 Cask Strength Batch 24",
    });
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    const data = await routerClient.flights.details({
      flight: flight.publicId,
    });
    expect(data.id).toEqual(flight.publicId);
    expect(data.targets).toEqual([
      expect.objectContaining({
        hasTasted: false,
        isLibrary: false,
        target: expect.objectContaining({
          kind: "bottle",
          bottle: expect.objectContaining({
            id: bottle.id,
            fullName: bottle.fullName,
          }),
        }),
      }),
    ]);
  });

  test("returns a generic group without selecting a representative Bottle", async ({
    fixtures,
  }) => {
    const distiller = await fixtures.Entity({ name: "Springbank Distillery" });
    const parent = await fixtures.Bottle({
      fullName: "Springbank 12 Cask Strength",
      distillerIds: [distiller.id],
    });
    await fixtures.BottleRelease({ bottleId: parent.id });
    const flight = await fixtures.Flight();
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, parent.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Missing generic target fixture");
    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: parent.id,
      releaseId: null,
      targetId: genericTarget.id,
    });

    const data = await routerClient.flights.details({
      flight: flight.publicId,
    });

    expect(data.targets).toEqual([
      expect.objectContaining({
        distillers: [expect.objectContaining({ id: distiller.id })],
        target: expect.objectContaining({
          kind: "group",
          targetId: genericTarget.id,
          group: expect.objectContaining({
            id: parent.groupId,
          }),
        }),
      }),
    ]);
    expect(data.targets[0]?.target).not.toHaveProperty("bottle");
  });

  test("resolves a promoted release through its exact durable target", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const { promoted, target } = await promoteRelease(parent, release.id);
    const flight = await fixtures.Flight();
    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: parent.id,
      releaseId: release.id,
      targetId: target.id,
    });

    const data = await routerClient.flights.details({
      flight: flight.publicId,
    });

    expect(data.targets).toEqual([
      expect.objectContaining({
        target: expect.objectContaining({
          kind: "bottle",
          targetId: target.id,
          bottle: expect.objectContaining({ id: promoted.id }),
        }),
      }),
    ]);
  });

  test("keeps a durable target authoritative over a mismatched retained pair", async ({
    fixtures,
  }) => {
    const retainedBottle = await fixtures.Bottle();
    const targetBottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, targetBottle.id),
    });
    if (!target) throw new Error("Missing exact target fixture");
    const flight = await fixtures.Flight();
    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: retainedBottle.id,
      releaseId: null,
      targetId: target.id,
    });

    const data = await routerClient.flights.details({
      flight: flight.publicId,
    });

    expect(data.targets[0]?.target).toMatchObject({
      kind: "bottle",
      targetId: target.id,
      bottle: { id: targetBottle.id },
    });
  });

  test("returns ordered targets with target-keyed viewer state and owner distillers", async ({
    fixtures,
    defaults,
  }) => {
    const distiller = await fixtures.Entity({ name: "Ardbeg Distillery" });
    const secondDistiller = await fixtures.Entity({
      name: "Caol Ila Distillery",
    });
    const brand = await fixtures.Entity({
      name: "Order Brand",
      shortName: "Order",
    });
    const laterBottle = await fixtures.Bottle({
      name: "Zulu Release",
      brandId: brand.id,
      distillerIds: [secondDistiller.id],
    });
    const firstBottle = await fixtures.Bottle({
      name: "Alpha Release",
      brandId: brand.id,
      distillerIds: [distiller.id],
    });
    const flight = await fixtures.Flight({
      bottles: [laterBottle.id, firstBottle.id],
    });
    const firstTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, firstBottle.id),
    });
    const laterTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, laterBottle.id),
    });
    if (!firstTarget || !laterTarget)
      throw new Error("Missing exact target fixture");

    await fixtures.Tasting({
      bottleId: firstBottle.id,
      targetId: firstTarget.id,
      flightId: flight.id,
      createdById: defaults.user.id,
    });
    const otherFlight = await fixtures.Flight({ bottles: [laterBottle.id] });
    await fixtures.Tasting({
      bottleId: laterBottle.id,
      targetId: laterTarget.id,
      flightId: otherFlight.id,
      createdById: defaults.user.id,
    });
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    await db.insert(collectionBottles).values({
      collectionId: library.id,
      bottleId: firstBottle.id,
      targetId: firstTarget.id,
    });

    const data = await routerClient.flights.details(
      { flight: flight.publicId },
      { context: { user: defaults.user } },
    );

    expect(
      data.targets.map(({ target }) =>
        target.kind === "bottle"
          ? target.bottle.fullName
          : target.group.fullName,
      ),
    ).toEqual([firstBottle.fullName, laterBottle.fullName]);
    expect(data.targets[0]).toMatchObject({
      target: { targetId: firstTarget.id },
      hasTasted: true,
      isLibrary: true,
      distillers: [{ id: distiller.id, name: distiller.name }],
    });
    expect(data.targets[1]).toMatchObject({
      hasTasted: false,
      isLibrary: false,
      distillers: [{ id: secondDistiller.id, name: secondDistiller.name }],
    });
  });

  test("rejects a targetless membership instead of falling back", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight();
    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: bottle.id,
      releaseId: null,
      targetId: null,
    });

    const error = await waitError(
      routerClient.flights.details({ flight: flight.publicId }),
    );

    expect(error.message).toContain("has no durable CatalogTarget");
  });

  test("errors on invalid flight", async () => {
    const err = await waitError(
      routerClient.flights.details({
        flight: "123",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Flight not found.]`);
  });
});
