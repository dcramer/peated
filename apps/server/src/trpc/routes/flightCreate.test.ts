import { db } from "@peated/server/db";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { flights } from "../../db/schema";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.flightCreate({
      name: "Delicious Wood",
    }),
  );
  expect(err).toMatchInlineSnapshot();
});

test("creates a new flight", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const data = await caller.flightCreate({
    name: "Macallan",
  });

  expect(data.id).toBeDefined();

  const [flight] = await db
    .select()
    .from(flights)
    .where(eq(flights.publicId, data.id));
  expect(flight.name).toEqual("Macallan");
});
