import { db } from "@peated/server/db";
import { eq } from "drizzle-orm";
import { flights } from "../../db/schema";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.flightCreate({
      name: "Delicious Wood",
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("creates a new flight", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
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
