import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "../router";

describe("GET /regions/:slug", () => {
  test("retrieves a region by slug and country id", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    const data = await routerClient.regionBySlug({
      country: country.id,
      slug: region.slug,
    });

    expect(data.id).toBe(region.id);
    expect(data.name).toBe(region.name);
    expect(data.slug).toBe(region.slug);
  });

  test("retrieves a region by slug and country slug", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    const data = await routerClient.regionBySlug({
      country: country.slug,
      slug: region.slug,
    });

    expect(data.id).toBe(region.id);
    expect(data.name).toBe(region.name);
    expect(data.slug).toBe(region.slug);
  });

  test("errors on invalid country slug", async ({ fixtures }) => {
    const err = await waitError(
      routerClient.regionBySlug({
        country: "nonexistent-country",
        slug: "some-region",
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("errors on non-existent region", async ({ fixtures }) => {
    const country = await fixtures.Country();

    const err = await waitError(
      routerClient.regionBySlug({
        country: country.id,
        slug: "nonexistent-region",
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("is case-insensitive for country and region slugs", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country({ slug: "United-States" });
    const region = await fixtures.Region({
      countryId: country.id,
      slug: "California",
    });

    const data = await routerClient.regionBySlug({
      country: "united-states",
      slug: "california",
    });

    expect(data.id).toBe(region.id);
    expect(data.name).toBe(region.name);
    expect(data.slug).toBe(region.slug);
  });

  test("returns serialized region data", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    const data = await routerClient.regionBySlug({
      country: country.id,
      slug: region.slug,
    });

    expect(data.id).toBe(region.id);
    expect(data.name).toBe(region.name);
    expect(data.slug).toBe(region.slug);
  });
});
