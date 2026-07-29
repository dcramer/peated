import { db, type AnyTransaction } from "@peated/server/db";
import {
  collectionBottles,
  flightBottles,
  tastings,
} from "@peated/server/db/schema";
import { sql, TransactionRollbackError, type SQL } from "drizzle-orm";

const MISSING_BOTTLE_ID = 9_000_000_000;

/**
 * Models the separately deployed post-repoint constraint inside a transaction
 * so the staged release-aware production constraint remains unchanged.
 */
async function expectDirectIdentityActivation(
  createIndex: SQL,
  expectedConstraint: RegExp,
  insertAllowed: (tx: AnyTransaction) => Promise<unknown>,
  insertConflict: (tx: AnyTransaction) => Promise<unknown>,
) {
  await expect(
    db.transaction(async (tx) => {
      await tx.execute(createIndex);
      await insertAllowed(tx);
      await expect(
        tx.transaction(async (savepoint) => {
          await insertConflict(savepoint);
        }),
      ).rejects.toThrow(expectedConstraint);
      tx.rollback();
    }),
  ).rejects.toBeInstanceOf(TransactionRollbackError);
}

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

describe("post-repoint direct Bottle uniqueness activation", () => {
  test("collections ignore retained release evidence for uniqueness", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const collection = await fixtures.Collection();
    const otherCollection = await fixtures.Collection();

    await expectDirectIdentityActivation(
      sql.raw(
        'CREATE UNIQUE INDEX "collection_bottle_direct_identity_activation_test" ON "collection_bottle" ("collection_id", "bottle_id")',
      ),
      /collection_bottle_direct_identity_activation_test/,
      (tx) =>
        tx.insert(collectionBottles).values([
          {
            collectionId: otherCollection.id,
            bottleId: bottle.id,
          },
          {
            collectionId: collection.id,
            bottleId: otherBottle.id,
          },
        ]),
      (tx) =>
        tx.insert(collectionBottles).values([
          {
            collectionId: collection.id,
            bottleId: bottle.id,
            releaseId: release.id,
          },
          {
            collectionId: collection.id,
            bottleId: bottle.id,
            releaseId: null,
          },
        ]),
    );
  });

  test("Flights ignore retained release evidence for uniqueness", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const flight = await fixtures.Flight();
    const otherFlight = await fixtures.Flight();

    await expectDirectIdentityActivation(
      sql.raw(
        'CREATE UNIQUE INDEX "flight_bottle_direct_identity_activation_test" ON "flight_bottle" ("flight_id", "bottle_id")',
      ),
      /flight_bottle_direct_identity_activation_test/,
      (tx) =>
        tx.insert(flightBottles).values([
          {
            flightId: otherFlight.id,
            bottleId: bottle.id,
          },
          {
            flightId: flight.id,
            bottleId: otherBottle.id,
          },
        ]),
      (tx) =>
        tx.insert(flightBottles).values([
          {
            flightId: flight.id,
            bottleId: bottle.id,
            releaseId: release.id,
          },
          {
            flightId: flight.id,
            bottleId: bottle.id,
            releaseId: null,
          },
        ]),
    );
  });

  test("tastings ignore retained release evidence for uniqueness", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const user = await fixtures.User();
    const otherUser = await fixtures.User();
    const createdAt = new Date("2026-07-27T13:00:00.000Z");

    await expectDirectIdentityActivation(
      sql.raw(
        'CREATE UNIQUE INDEX "tasting_direct_identity_activation_test" ON "tasting" ("bottle_id", "created_by_id", "created_at")',
      ),
      /tasting_direct_identity_activation_test/,
      (tx) =>
        tx.insert(tastings).values([
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
      (tx) =>
        tx.insert(tastings).values([
          {
            bottleId: bottle.id,
            releaseId: release.id,
            createdById: user.id,
            createdAt,
          },
          {
            bottleId: bottle.id,
            releaseId: null,
            createdById: user.id,
            createdAt,
          },
        ]),
    );
  });
});
