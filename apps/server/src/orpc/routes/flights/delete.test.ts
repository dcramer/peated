import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("DELETE /flights/:flight", () => {
  test("deletes flight", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const flight = await fixtures.Flight();

    const data = await routerClient.flights.delete(
      {
        flight: flight.publicId,
      },
      { context: { user } },
    );
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

    const err = await waitError(
      routerClient.flights.delete(
        {
          flight: flight.publicId,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
