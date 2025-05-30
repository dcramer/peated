import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /flights/:flight", () => {
  test("get flight by id", async ({ fixtures }) => {
    const flight = await fixtures.Flight();

    const data = await routerClient.flights.details({
      flight: flight.publicId,
    });
    expect(data.id).toEqual(flight.publicId);
  });

  test("errors on invalid flight", async () => {
    const err = await waitError(
      routerClient.flights.details({
        flight: "123",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Flight not found.]`);
  });
});
