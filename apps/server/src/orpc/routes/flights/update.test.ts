import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottles,
  bottleTombstones,
  flightBottles,
  flights,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("PATCH /flights/:flight", () => {
  test("requires authentication", async () => {
    const error = await waitError(
      routerClient.flights.update({
        flight: "1",
      }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot update another user's flight", async ({ fixtures }) => {
    const user = await fixtures.User();
    const flight = await fixtures.Flight();

    const error = await waitError(
      routerClient.flights.update(
        {
          flight: flight.publicId,
          name: "Not allowed",
        },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Cannot update another user's flight.]`,
    );
  });

  test("owner can update flight metadata", async ({ fixtures }) => {
    const user = await fixtures.User();
    const flight = await fixtures.Flight({ createdById: user.id });

    const data = await routerClient.flights.update(
      {
        flight: flight.publicId,
        name: "Delicious Wood",
        description: "Updated by its owner",
        public: true,
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      id: flight.publicId,
      name: "Delicious Wood",
      description: "Updated by its owner",
      public: true,
    });
    await expect(
      db.query.flights.findFirst({ where: eq(flights.id, flight.id) }),
    ).resolves.toMatchObject({
      name: "Delicious Wood",
      description: "Updated by its owner",
      public: true,
    });
  });

  test("moderator can update another user's flight", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });
    const flight = await fixtures.Flight();

    await routerClient.flights.update(
      {
        flight: flight.publicId,
        name: "Moderator edit",
      },
      { context: { user: moderator } },
    );

    await expect(
      db.query.flights.findFirst({ where: eq(flights.id, flight.id) }),
    ).resolves.toMatchObject({ name: "Moderator edit" });
  });

  test("no changes returns the existing flight", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const flight = await fixtures.Flight();

    const data = await routerClient.flights.update(
      {
        flight: flight.publicId,
      },
      { context: { user } },
    );

    expect(data.id).toBe(flight.publicId);
    await expect(
      db.query.flights.findFirst({ where: eq(flights.id, flight.id) }),
    ).resolves.toEqual(flight);
  });

  test("metadata-only updates preserve direct Bottle memberships", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [bottle.id] });
    const before = await db
      .select({
        flightId: flightBottles.flightId,
        bottleId: flightBottles.bottleId,
      })
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));

    await routerClient.flights.update(
      { flight: flight.publicId, name: "Metadata only" },
      { context: { user } },
    );

    const after = await db
      .select({
        flightId: flightBottles.flightId,
        bottleId: flightBottles.bottleId,
      })
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(after).toEqual(before);
  });

  test("replaces memberships with direct Bottles", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const firstBottle = await fixtures.Bottle({ name: "First" });
    const removedBottle = await fixtures.Bottle({ name: "Removed" });
    const addedBottle = await fixtures.Bottle({ name: "Added" });
    const flight = await fixtures.Flight({
      bottles: [firstBottle.id, removedBottle.id],
    });

    await routerClient.flights.update(
      {
        flight: flight.publicId,
        bottles: [addedBottle.id, firstBottle.id],
      },
      { context: { user } },
    );

    const memberships = await db
      .select({ bottleId: flightBottles.bottleId })
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(memberships.map(({ bottleId }) => bottleId).sort()).toEqual(
      [firstBottle.id, addedBottle.id].sort(),
    );
  });

  test("keeps same-group replacement Bottles distinct and ordered", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const laterBottle = await fixtures.Bottle({
      name: "Zulu release",
      fullName: "Zulu release",
    });
    if (laterBottle.groupId === null) {
      throw new Error("Bottle group fixture not found");
    }
    const [firstBottle] = await db
      .insert(bottles)
      .values({
        groupId: laterBottle.groupId,
        brandId: laterBottle.brandId,
        createdByActorId: laterBottle.createdByActorId,
        name: "Alpha release",
        fullName: "Alpha release",
      })
      .returning();
    if (!firstBottle) throw new Error("Same-group Bottle fixture not found");
    const flight = await fixtures.Flight();

    await routerClient.flights.update(
      {
        flight: flight.publicId,
        bottles: [laterBottle.id, firstBottle.id],
      },
      { context: { user } },
    );

    const details = await routerClient.flights.details(
      { flight: flight.publicId },
      { context: { user } },
    );
    expect(details.bottles.map(({ bottle }) => bottle.id)).toEqual([
      firstBottle.id,
      laterBottle.id,
    ]);
  });

  test("deduplicates the replacement Bottle set", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const flight = await fixtures.Flight();

    await routerClient.flights.update(
      {
        flight: flight.publicId,
        bottles: [
          secondBottle.id,
          firstBottle.id,
          secondBottle.id,
          firstBottle.id,
        ],
      },
      { context: { user } },
    );

    const memberships = await db
      .select({ bottleId: flightBottles.bottleId })
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(memberships).toHaveLength(2);
    expect(memberships.map(({ bottleId }) => bottleId).sort()).toEqual(
      [firstBottle.id, secondBottle.id].sort(),
    );
  });

  test("an empty Bottle list clears every membership", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    await routerClient.flights.update(
      { flight: flight.publicId, bottles: [] },
      { context: { user } },
    );

    await expect(
      db.query.flightBottles.findMany({
        where: eq(flightBottles.flightId, flight.id),
      }),
    ).resolves.toHaveLength(0);
  });

  test("invalid Bottle replacement rolls back metadata and memberships", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const legacyBottle = await fixtures.LegacyBottle();
    const flight = await fixtures.Flight({ bottles: [bottle.id] });
    const before = await db
      .select({
        flightId: flightBottles.flightId,
        bottleId: flightBottles.bottleId,
      })
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));

    const error = await waitError(() =>
      routerClient.flights.update(
        {
          flight: flight.publicId,
          name: "Should not persist",
          bottles: [legacyBottle.id],
        },
        { context: { user } },
      ),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message:
        "One or more Bottles are missing or not ready for Flight activity.",
    });
    await expect(
      db.query.flights.findFirst({ where: eq(flights.id, flight.id) }),
    ).resolves.toMatchObject({ name: flight.name });
    await expect(
      db
        .select({
          flightId: flightBottles.flightId,
          bottleId: flightBottles.bottleId,
        })
        .from(flightBottles)
        .where(eq(flightBottles.flightId, flight.id)),
    ).resolves.toEqual(before);
  });

  test("missing Bottle replacement rolls back metadata and memberships", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    const error = await waitError(() =>
      routerClient.flights.update(
        {
          flight: flight.publicId,
          name: "Should not persist",
          bottles: [Number.MAX_SAFE_INTEGER],
        },
        { context: { user } },
      ),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message:
        "One or more Bottles are missing or not ready for Flight activity.",
    });
    await expect(
      db.query.flights.findFirst({ where: eq(flights.id, flight.id) }),
    ).resolves.toMatchObject({ name: flight.name });
    await expect(
      db.query.flightBottles.findMany({
        where: eq(flightBottles.flightId, flight.id),
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        flightId: flight.id,
        bottleId: bottle.id,
      }),
    ]);
  });

  test("retired BottleGroup replacement rolls back metadata and memberships", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const retainedBottle = await fixtures.Bottle();
    const retiredGroupBottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [retainedBottle.id] });
    if (retiredGroupBottle.groupId === null || replacement.groupId === null) {
      throw new Error("BottleGroup fixtures not found.");
    }
    await db.insert(bottleGroupTombstones).values({
      groupId: retiredGroupBottle.groupId,
      newGroupId: replacement.groupId,
      createdByActorId: retiredGroupBottle.createdByActorId,
    });

    const error = await waitError(() =>
      routerClient.flights.update(
        {
          flight: flight.publicId,
          name: "Should not persist",
          bottles: [retiredGroupBottle.id],
        },
        { context: { user } },
      ),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message:
        "One or more Bottles are missing or not ready for Flight activity.",
    });
    await expect(
      db.query.flights.findFirst({ where: eq(flights.id, flight.id) }),
    ).resolves.toMatchObject({ name: flight.name });
    await expect(
      db.query.flightBottles.findMany({
        where: eq(flightBottles.flightId, flight.id),
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        flightId: flight.id,
        bottleId: retainedBottle.id,
      }),
    ]);
  });

  test("retired Bottle replacement rolls back metadata and memberships", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const retainedBottle = await fixtures.Bottle();
    const retiredBottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [retainedBottle.id] });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(() =>
      routerClient.flights.update(
        {
          flight: flight.publicId,
          name: "Should not persist",
          bottles: [retiredBottle.id],
        },
        { context: { user } },
      ),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message:
        "One or more Bottles are missing or not ready for Flight activity.",
    });
    await expect(
      db.query.flights.findFirst({ where: eq(flights.id, flight.id) }),
    ).resolves.toMatchObject({ name: flight.name });
    await expect(
      db.query.flightBottles.findMany({
        where: eq(flightBottles.flightId, flight.id),
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        flightId: flight.id,
        bottleId: retainedBottle.id,
      }),
    ]);
  });

  test("replaces an inactive existing member with an active Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const retiredBottle = await fixtures.Bottle();
    const activeBottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [retiredBottle.id] });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: activeBottle.id,
    });

    await routerClient.flights.update(
      {
        flight: flight.publicId,
        name: "Cleaned up flight",
        bottles: [activeBottle.id],
      },
      { context: { user } },
    );

    await expect(
      db.query.flights.findFirst({ where: eq(flights.id, flight.id) }),
    ).resolves.toMatchObject({ name: "Cleaned up flight" });
    await expect(
      db.query.flightBottles.findMany({
        where: eq(flightBottles.flightId, flight.id),
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        flightId: flight.id,
        bottleId: activeBottle.id,
      }),
    ]);
  });

  test("rejects legacy targets input without changing the flight", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    const error = await waitError(() =>
      routerClient.flights.update(
        {
          flight: flight.publicId,
          name: "Should not persist",
          targets: [bottle.id],
        } as never,
        { context: { user } },
      ),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
    await expect(
      db.query.flights.findFirst({ where: eq(flights.id, flight.id) }),
    ).resolves.toMatchObject({ name: flight.name });
  });

  test("errors on invalid flight", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const error = await waitError(
      routerClient.flights.update(
        {
          flight: "missing",
          name: "Missing",
        },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Flight not found.]`);
  });
});
