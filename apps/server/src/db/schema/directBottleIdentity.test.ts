import { db } from "@peated/server/db";
import {
  collectionBottles,
  flightBottles,
  tastings,
} from "@peated/server/db/schema";

const MISSING_BOTTLE_ID = 9_000_000_000;

describe("direct Bottle consumer constraints", () => {
  test("collections require a valid Bottle and preserve staged release evidence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection();

    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
    });

    await expect(
      db.insert(collectionBottles).values({
        collectionId: collection.id,
        bottleId: bottle.id,
      }),
    ).rejects.toThrow(
      /collection_bottle_collection_id_bottle_id_release_id_unique/,
    );

    const firstRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Collection Evidence One",
    });
    const secondRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Collection Evidence Two",
    });
    const legacyCollection = await fixtures.Collection();
    await expect(
      db.insert(collectionBottles).values([
        {
          collectionId: legacyCollection.id,
          bottleId: bottle.id,
          releaseId: firstRelease.id,
        },
        {
          collectionId: legacyCollection.id,
          bottleId: bottle.id,
          releaseId: secondRelease.id,
        },
      ]),
    ).resolves.toBeDefined();

    await expect(
      db.insert(collectionBottles).values({
        collectionId: (await fixtures.Collection()).id,
        bottleId: bottle.id,
      }),
    ).resolves.toBeDefined();

    await expect(
      db.insert(collectionBottles).values({
        collectionId: collection.id,
        bottleId: MISSING_BOTTLE_ID,
      }),
    ).rejects.toThrow(/collection_bottle_bottle_id_bottle_id_fk/);

    await expect(
      db.insert(collectionBottles).values({
        collectionId: collection.id,
        bottleId: null as unknown as number,
      }),
    ).rejects.toThrow(/not-null constraint/);
  });

  test("Flights require a valid Bottle and preserve staged release evidence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight();

    await db.insert(flightBottles).values({
      flightId: flight.id,
      bottleId: bottle.id,
    });

    await expect(
      db.insert(flightBottles).values({
        flightId: flight.id,
        bottleId: bottle.id,
      }),
    ).rejects.toThrow(/flight_bottle_flight_id_bottle_id_release_id_unique/);

    const firstRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Flight Evidence One",
    });
    const secondRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Flight Evidence Two",
    });
    const legacyFlight = await fixtures.Flight();
    await expect(
      db.insert(flightBottles).values([
        {
          flightId: legacyFlight.id,
          bottleId: bottle.id,
          releaseId: firstRelease.id,
        },
        {
          flightId: legacyFlight.id,
          bottleId: bottle.id,
          releaseId: secondRelease.id,
        },
      ]),
    ).resolves.toBeDefined();

    await expect(
      db.insert(flightBottles).values({
        flightId: (await fixtures.Flight()).id,
        bottleId: bottle.id,
      }),
    ).resolves.toBeDefined();

    await expect(
      db.insert(flightBottles).values({
        flightId: flight.id,
        bottleId: MISSING_BOTTLE_ID,
      }),
    ).rejects.toThrow(/flight_bottle_bottle_id_bottle_id_fk/);

    await expect(
      db.insert(flightBottles).values({
        flightId: flight.id,
        bottleId: null as unknown as number,
      }),
    ).rejects.toThrow(/not-null constraint/);
  });

  test("tastings require a valid Bottle and preserve staged release evidence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const user = await fixtures.User();
    const otherUser = await fixtures.User();
    const createdAt = new Date("2026-07-27T12:00:00.000Z");

    await db.insert(tastings).values({
      bottleId: bottle.id,
      createdById: user.id,
      createdAt,
    });

    await expect(
      db.insert(tastings).values({
        bottleId: bottle.id,
        createdById: user.id,
        createdAt,
      }),
    ).rejects.toThrow(/tasting_unq/);

    const firstRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Tasting Evidence One",
    });
    const secondRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Tasting Evidence Two",
    });
    await expect(
      db.insert(tastings).values([
        {
          bottleId: bottle.id,
          releaseId: firstRelease.id,
          createdById: user.id,
          createdAt: new Date(createdAt.getTime() + 10_000),
        },
        {
          bottleId: bottle.id,
          releaseId: secondRelease.id,
          createdById: user.id,
          createdAt: new Date(createdAt.getTime() + 10_000),
        },
      ]),
    ).resolves.toBeDefined();

    await expect(
      db.insert(tastings).values([
        {
          bottleId: bottle.id,
          createdById: otherUser.id,
          createdAt,
        },
        {
          bottleId: bottle.id,
          createdById: user.id,
          createdAt: new Date(createdAt.getTime() + 1_000),
        },
        {
          bottleId: otherBottle.id,
          createdById: user.id,
          createdAt,
        },
      ]),
    ).resolves.toBeDefined();

    await expect(
      db.insert(tastings).values({
        bottleId: MISSING_BOTTLE_ID,
        createdById: user.id,
        createdAt: new Date(createdAt.getTime() + 2_000),
      }),
    ).rejects.toThrow(/tasting_bottle_id_bottle_id_fk/);

    await expect(
      db.insert(tastings).values({
        bottleId: null as unknown as number,
        createdById: user.id,
        createdAt: new Date(createdAt.getTime() + 3_000),
      }),
    ).rejects.toThrow(/not-null constraint/);
  });
});
