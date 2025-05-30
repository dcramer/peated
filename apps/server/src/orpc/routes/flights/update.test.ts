import { db } from "@peated/server/db";
import { flightBottles, flights } from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("PATCH /flights/:flight", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.flights.update({
        flight: "1",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod", async ({ fixtures }) => {
    const user = await fixtures.User();
    const flight = await fixtures.Flight();

    const err = await waitError(
      routerClient.flights.update(
        {
          flight: flight.publicId,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot update another user's flight.]`,
    );
  });

  test("no changes", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const flight = await fixtures.Flight();

    const data = await routerClient.flights.update(
      {
        flight: flight.publicId,
      },
      { context: { user } },
    );

    expect(data.id).toBeDefined();

    const [newFlight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, data.id));

    expect(flight).toEqual(newFlight);
  });

  test("can change name", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const flight = await fixtures.Flight();

    const data = await routerClient.flights.update(
      {
        flight: flight.publicId,
        name: "Delicious Wood",
      },
      { context: { user } },
    );

    expect(data.id).toBeDefined();

    const [newFlight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, data.id));

    expect(omit(flight, "name")).toEqual(omit(newFlight, "name"));
    expect(newFlight.name).toBe("Delicious Wood");
  });

  test("can change bottles", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle1 = await fixtures.Bottle({ name: "Bottle 1" });
    const bottle2 = await fixtures.Bottle({ name: "Bottle 2" });
    const bottle3 = await fixtures.Bottle({ name: "Bottle 3" });
    const flight = await fixtures.Flight({ bottles: [bottle1.id, bottle2.id] });

    const data = await routerClient.flights.update(
      {
        flight: flight.publicId,
        bottles: [bottle1.id, bottle3.id],
      },
      { context: { user } },
    );

    expect(data.id).toBeDefined();

    const [newFlight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, data.id));

    expect(flight).toEqual(newFlight);

    const bottles = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, newFlight.id));
    expect(bottles.length).toEqual(2);

    expect(bottles.map((fb) => fb.bottleId).sort()).toEqual([
      bottle1.id,
      bottle3.id,
    ]);
  });
});
