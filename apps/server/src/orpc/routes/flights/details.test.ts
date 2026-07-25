import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /flights/:flight", () => {
  test("returns direct Bottle details", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      name: "Batch 24",
      fullName: "Springbank 12 Cask Strength Batch 24",
    });
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    const data = await routerClient.flights.details({
      flight: flight.publicId,
    });

    expect(data.id).toEqual(flight.publicId);
    expect(data.bottles).toEqual([
      {
        bottle: expect.objectContaining({
          id: bottle.id,
          fullName: bottle.fullName,
        }),
        hasTasted: false,
        isLibrary: false,
      },
    ]);
    expect(data).not.toHaveProperty("targets");
  });

  test("returns ordered Bottles with Bottle-keyed viewer state", async ({
    fixtures,
    defaults,
  }) => {
    const brand = await fixtures.Entity({
      name: "Order Brand",
      shortName: "Order",
    });
    const laterBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Zulu Release",
    });
    const firstBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Alpha Release",
    });
    const flight = await fixtures.Flight({
      bottles: [laterBottle.id, firstBottle.id],
    });

    await fixtures.Tasting({
      bottleId: firstBottle.id,
      flightId: flight.id,
      createdById: defaults.user.id,
    });
    const otherFlight = await fixtures.Flight({ bottles: [laterBottle.id] });
    await fixtures.Tasting({
      bottleId: laterBottle.id,
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
    });

    const data = await routerClient.flights.details(
      { flight: flight.publicId },
      { context: { user: defaults.user } },
    );

    expect(data.bottles.map(({ bottle }) => bottle.fullName)).toEqual([
      firstBottle.fullName,
      laterBottle.fullName,
    ]);
    expect(data.bottles[0]).toMatchObject({
      bottle: { id: firstBottle.id },
      hasTasted: true,
      isLibrary: true,
    });
    expect(data.bottles[1]).toMatchObject({
      bottle: { id: laterBottle.id },
      hasTasted: false,
      isLibrary: false,
    });
  });

  test("errors on invalid flight", async () => {
    const error = await waitError(
      routerClient.flights.details({
        flight: "123",
      }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Flight not found.]`);
  });
});
