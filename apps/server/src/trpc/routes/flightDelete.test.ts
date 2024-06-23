import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { flights } from "../../db/schema";
import { createCaller } from "../router";

test("deletes flight", async ({ fixtures }) => {
  const user = await fixtures.User({ admin: true });
  const flight = await fixtures.Flight();

  const caller = createCaller({ user });
  const data = await caller.flightDelete(flight.publicId);
  expect(data).toEqual({});

  const [newFlight] = await db
    .select()
    .from(flights)
    .where(eq(flights.id, flight.id));
  expect(newFlight).toBeUndefined();
});

test("cannot delete without admin", async ({ fixtures }) => {
  const user = await fixtures.User({ mod: true });
  const flight = await fixtures.Flight({ createdById: user.id });

  const caller = createCaller({ user });
  const err = await waitError(caller.flightDelete(flight.publicId));
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});
