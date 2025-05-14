import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("POST /flights", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.flights.create({
        name: "Delicious Wood",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized]`);
  });

  test("creates a new flight", async ({ fixtures }) => {
    const user = await fixtures.User();
    const data = await routerClient.flights.create(
      {
        name: "Macallan",
      },
      { context: { user } },
    );

    expect(data.id).toBeDefined();

    const [flight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, data.id));
    expect(flight.name).toEqual("Macallan");
  });
});
