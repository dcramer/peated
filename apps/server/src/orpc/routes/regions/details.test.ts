import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /countries/:country/regions/:region", () => {
  test("retrieves a region by slug and country id", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    const data = await routerClient.regions.details({
      country: country.slug,
      region: region.slug,
    });

    expect(data.id).toBe(region.id);
    expect(data.name).toBe(region.name);
    expect(data.slug).toBe(region.slug);
  });

  test("retrieves a region by slug and country slug", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    const data = await routerClient.regions.details({
      country: country.slug,
      region: region.slug,
    });

    expect(data.id).toBe(region.id);
    expect(data.name).toBe(region.name);
    expect(data.slug).toBe(region.slug);
  });

  test("errors on invalid country slug", async ({ fixtures }) => {
    const err = await waitError(
      routerClient.regions.details({
        country: "nonexistent-country",
        region: "some-region",
      })
    );
    expect(err).toMatchInlineSnapshot(`[Error: Invalid country.]`);
  });

  test("errors on non-existent region", async ({ fixtures }) => {
    const country = await fixtures.Country();

    const err = await waitError(
      routerClient.regions.details({
        country: country.slug,
        region: "nonexistent-region",
      })
    );
    expect(err).toMatchInlineSnapshot(`[Error: Region not found.]`);
  });

  test("is case-insensitive for country and region slugs", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country({ slug: "United-States" });
    const region = await fixtures.Region({
      countryId: country.id,
      slug: "California",
    });

    const data = await routerClient.regions.details({
      country: "united-states",
      region: "california",
    });

    expect(data.id).toBe(region.id);
    expect(data.name).toBe(region.name);
    expect(data.slug).toBe(region.slug);
  });

  test("returns serialized region data", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    const data = await routerClient.regions.details({
      country: country.slug,
      region: region.slug,
    });

    expect(data.id).toBe(region.id);
    expect(data.name).toBe(region.name);
    expect(data.slug).toBe(region.slug);
  });
});
