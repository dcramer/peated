import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /countries/:country", () => {
  test("get country by slug", async ({ fixtures }) => {
    const country = await fixtures.Country();

    const data = await routerClient.countries.details({
      country: country.slug,
    });
    expect(data.id).toEqual(country.id);
  });

  test("errors on invalid country", async () => {
    const err = await waitError(
      routerClient.countries.details({
        country: "nochance",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Country not found.]`);
  });
});
