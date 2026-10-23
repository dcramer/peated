import { db } from "@peated/server/db";
import {
  collectionBottles,
  flightBottles,
  tastings,
} from "@peated/server/db/schema";
import { sql } from "drizzle-orm";

const MISSING_BOTTLE_ID = 9_000_000_000;

describe("direct Bottle consumer constraints", () => {
  test("collections require a unique valid Bottle", async ({ fixtures }) => {
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
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/collection_bottle_collection_id_bottle_id_unique/),
    );

    const legacyCollection = await fixtures.Collection();
    await expect(
      db.insert(collectionBottles).values([
        {
          collectionId: legacyCollection.id,
          bottleId: bottle.id,
        },
        {
          collectionId: legacyCollection.id,
          bottleId: bottle.id,
        },
      ]),
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/collection_bottle_collection_id_bottle_id_unique/),
    );

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
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/collection_bottle_bottle_id_bottle_id_fk/),
    );

    await expect(
      db.insert(collectionBottles).values({
        collectionId: collection.id,
        bottleId: sql<number>`NULL`,
      }),
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/not-null constraint/),
    );
  });

  test("Flights require a unique valid Bottle", async ({ fixtures }) => {
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
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/flight_bottle_flight_id_bottle_id_unique/),
    );

    const legacyFlight = await fixtures.Flight();
    await expect(
      db.insert(flightBottles).values([
        {
          flightId: legacyFlight.id,
          bottleId: bottle.id,
        },
        {
          flightId: legacyFlight.id,
          bottleId: bottle.id,
        },
      ]),
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/flight_bottle_flight_id_bottle_id_unique/),
    );

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
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/flight_bottle_bottle_id_bottle_id_fk/),
    );

    await expect(
      db.insert(flightBottles).values({
        flightId: flight.id,
        bottleId: sql<number>`NULL`,
      }),
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/not-null constraint/),
    );
  });

  test("tastings require a unique valid Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const user = await fixtures.User();
    const otherUser = await fixtures.User();
    const tastedAt = new Date("2026-07-27T12:00:00.000Z");

    await db.insert(tastings).values({
      bottleId: bottle.id,
      createdById: user.id,
      tastedAt,
    });

    await expect(
      db.insert(tastings).values({
        bottleId: bottle.id,
        createdById: user.id,
        tastedAt,
      }),
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/tasting_unq/),
    );

    await expect(
      db.insert(tastings).values([
        {
          bottleId: bottle.id,
          createdById: user.id,
          tastedAt: new Date(tastedAt.getTime() + 10_000),
        },
        {
          bottleId: bottle.id,
          createdById: user.id,
          tastedAt: new Date(tastedAt.getTime() + 10_000),
        },
      ]),
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/tasting_unq/),
    );

    await expect(
      db.insert(tastings).values([
        {
          bottleId: bottle.id,
          createdById: otherUser.id,
          tastedAt,
        },
        {
          bottleId: bottle.id,
          createdById: user.id,
          tastedAt: new Date(tastedAt.getTime() + 1_000),
        },
        {
          bottleId: otherBottle.id,
          createdById: user.id,
          tastedAt,
        },
      ]),
    ).resolves.toBeDefined();

    await expect(
      db.insert(tastings).values({
        bottleId: MISSING_BOTTLE_ID,
        createdById: user.id,
        tastedAt: new Date(tastedAt.getTime() + 2_000),
      }),
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/tasting_bottle_id_bottle_id_fk/),
    );

    await expect(
      db.insert(tastings).values({
        bottleId: sql<number>`NULL`,
        createdById: user.id,
        tastedAt: new Date(tastedAt.getTime() + 3_000),
      }),
    ).rejects.toHaveProperty(
      "cause.message",
      expect.stringMatching(/not-null constraint/),
    );
  });
});
