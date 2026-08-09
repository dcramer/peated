import { db } from "@peated/server/db";
import {
  bottles,
  bottleTombstones,
  flightBottles,
  flights,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("POST /flights", () => {
  test("requires authentication", async () => {
    const error = await waitError(
      routerClient.flights.create({
        name: "Delicious Wood",
      }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a new flight", async ({ fixtures }) => {
    const user = await fixtures.User();

    const data = await routerClient.flights.create(
      {
        name: "Macallan",
        description: "A regional comparison",
        public: true,
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      id: expect.any(String),
      name: "Macallan",
      description: "A regional comparison",
      public: true,
    });
    expect(data).not.toHaveProperty("bottles");
    expect(data).not.toHaveProperty("targets");

    const flight = await db.query.flights.findFirst({
      where: eq(flights.publicId, data.id),
    });
    expect(flight).toMatchObject({
      name: "Macallan",
      description: "A regional comparison",
      public: true,
      createdById: user.id,
    });
  });

  test("stores direct Bottle memberships", async ({ fixtures }) => {
    const user = await fixtures.User();
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();

    const data = await routerClient.flights.create(
      {
        name: "Bottle flight",
        bottles: [secondBottle.id, firstBottle.id],
      },
      { context: { user } },
    );

    const flight = await db.query.flights.findFirst({
      where: eq(flights.publicId, data.id),
    });
    if (!flight) throw new Error("Flight fixture not found");

    const memberships = await db
      .select({
        flightId: flightBottles.flightId,
        bottleId: flightBottles.bottleId,
      })
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));

    expect(memberships).toHaveLength(2);
    expect(
      memberships.toSorted(
        (left, right) => (left.bottleId ?? 0) - (right.bottleId ?? 0),
      ),
    ).toEqual([
      {
        flightId: flight.id,
        bottleId: firstBottle.id,
      },
      {
        flightId: flight.id,
        bottleId: secondBottle.id,
      },
    ]);
  });

  test("keeps same-group Bottles distinct and deterministically ordered", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const brand = await fixtures.Entity({ name: "Flight Ordering Brand" });
    const laterBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Zulu release",
    });
    if (laterBottle.groupId === null) {
      throw new Error("Bottle Group fixture not found");
    }
    const [firstBottle] = await db
      .insert(bottles)
      .values({
        groupId: laterBottle.groupId,
        brandId: laterBottle.brandId,
        createdByActorId: laterBottle.createdByActorId,
        name: "Alpha release",
        fullName: `${brand.name} Alpha release`,
      })
      .returning();
    if (!firstBottle) throw new Error("Same-group Bottle fixture not found");

    const data = await routerClient.flights.create(
      {
        name: "Same group flight",
        bottles: [laterBottle.id, firstBottle.id],
      },
      { context: { user } },
    );
    const flight = await db.query.flights.findFirst({
      where: eq(flights.publicId, data.id),
    });
    if (!flight) throw new Error("Flight fixture not found");

    const memberships = await db
      .select({ bottleId: flightBottles.bottleId })
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));

    expect(memberships.map(({ bottleId }) => bottleId).sort()).toEqual(
      [firstBottle.id, laterBottle.id].sort(),
    );

    const details = await routerClient.flights.details(
      { flight: data.id },
      { context: { user } },
    );
    expect(details.bottles.map(({ bottle }) => bottle.id)).toEqual([
      firstBottle.id,
      laterBottle.id,
    ]);
  });

  test("deduplicates repeated Bottle ids", async ({ fixtures }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();

    const data = await routerClient.flights.create(
      {
        name: "Deduplicated flight",
        bottles: [bottle.id, bottle.id, bottle.id],
      },
      { context: { user } },
    );
    const flight = await db.query.flights.findFirst({
      where: eq(flights.publicId, data.id),
    });
    if (!flight) throw new Error("Flight fixture not found");

    const memberships = await db
      .select({ bottleId: flightBottles.bottleId })
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));

    expect(memberships).toEqual([{ bottleId: bottle.id }]);
  });

  test("rejects a Bottle without a group and rolls back the flight", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const legacyBottle = await fixtures.LegacyBottle();

    const error = await waitError(() =>
      routerClient.flights.create(
        {
          name: "Invalid Bottle flight",
          bottles: [bottle.id, legacyBottle.id],
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
      db.query.flights.findFirst({
        where: eq(flights.name, "Invalid Bottle flight"),
      }),
    ).resolves.toBeUndefined();
  });

  test("rejects a missing Bottle and rolls back the flight", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();

    const error = await waitError(() =>
      routerClient.flights.create(
        {
          name: "Missing Bottle flight",
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
      db.query.flights.findFirst({
        where: eq(flights.name, "Missing Bottle flight"),
      }),
    ).resolves.toBeUndefined();
  });

  test("rejects a retired Bottle and rolls back the flight", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(() =>
      routerClient.flights.create(
        {
          name: "Retired Bottle flight",
          bottles: [bottle.id],
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
      db.query.flights.findFirst({
        where: eq(flights.name, "Retired Bottle flight"),
      }),
    ).resolves.toBeUndefined();
  });

  test("rejects legacy targets input", async ({ fixtures }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();

    const error = await waitError(() =>
      routerClient.flights.create(
        {
          name: "Legacy target flight",
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
      db.query.flights.findFirst({
        where: eq(flights.name, "Legacy target flight"),
      }),
    ).resolves.toBeUndefined();
  });
});
