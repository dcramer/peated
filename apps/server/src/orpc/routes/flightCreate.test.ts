import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { routerClient } from "../router";

describe("POST /flights", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.flightCreate({
        name: "Delicious Wood",
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("creates a new flight", async ({ fixtures }) => {
    const user = await fixtures.User();
    const data = await routerClient.flightCreate(
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
