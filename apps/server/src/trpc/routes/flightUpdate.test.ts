import { db } from "@peated/server/db";
import { flightBottles, flights } from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.flightUpdate({
      flight: "1",
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("requires mod", async ({ defaults, fixtures }) => {
  const flight = await fixtures.Flight();

  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.flightUpdate({
      flight: flight.publicId,
    }),
  );
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: Cannot update another user's flight.]`,
  );
});

test("no changes", async ({ fixtures }) => {
  const flight = await fixtures.Flight();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.flightUpdate({
    flight: flight.publicId,
  });

  expect(data.id).toBeDefined();

  const [newFlight] = await db
    .select()
    .from(flights)
    .where(eq(flights.publicId, data.id));

  expect(flight).toEqual(newFlight);
});

test("can change name", async ({ fixtures }) => {
  const flight = await fixtures.Flight();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.flightUpdate({
    flight: flight.publicId,
    name: "Delicious Wood",
  });

  expect(data.id).toBeDefined();

  const [newFlight] = await db
    .select()
    .from(flights)
    .where(eq(flights.publicId, data.id));

  expect(omit(flight, "name")).toEqual(omit(newFlight, "name"));
  expect(newFlight.name).toBe("Delicious Wood");
});

test("can change bottles", async ({ fixtures }) => {
  const bottle1 = await fixtures.Bottle();
  const bottle2 = await fixtures.Bottle();
  const bottle3 = await fixtures.Bottle();
  const flight = await fixtures.Flight({ bottles: [bottle1.id, bottle2.id] });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.flightUpdate({
    flight: flight.publicId,
    bottles: [bottle1.id, bottle3.id],
  });

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
