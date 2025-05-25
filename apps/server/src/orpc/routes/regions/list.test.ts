import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /countries/:country/regions", () => {
  test("lists regions for a country by id", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Region A",
    });
    const region2 = await fixtures.Region({
      countryId: country.id,
      name: "Region B",
    });

    const { results, rel } = await routerClient.regions.list({
      country: country.slug,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(region1.id);
    expect(results[1].id).toBe(region2.id);
    expect(rel.nextCursor).toBeNull();
    expect(rel.prevCursor).toBeNull();
  });

  test("lists regions for a country by slug", async ({ fixtures }) => {
    const country = await fixtures.Country({ slug: "test-country" });
    const region = await fixtures.Region({ countryId: country.id });

    const { results } = await routerClient.regions.list({
      country: "test-country",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(region.id);
  });

  test("filters regions by query", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Alpha Region",
    });
    await fixtures.Region({ countryId: country.id, name: "Beta Region" });

    const { results } = await routerClient.regions.list({
      country: country.slug,
      query: "Alpha",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(region1.id);
  });

  test("sorts regions by name ascending", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Alpha",
    });
    const region2 = await fixtures.Region({
      countryId: country.id,
      name: "Beta",
    });

    const { results } = await routerClient.regions.list({
      country: country.slug,
      sort: "name",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(region1.id);
    expect(results[1].id).toBe(region2.id);
  });

  test("sorts regions by name descending", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Alpha",
    });
    const region2 = await fixtures.Region({
      countryId: country.id,
      name: "Beta",
    });

    const { results } = await routerClient.regions.list({
      country: country.slug,
      sort: "-name",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(region2.id);
    expect(results[1].id).toBe(region1.id);
  });

  test("paginates results", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const regions = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        fixtures.Region({ countryId: country.id, name: `Region ${i + 1}` }),
      ),
    );

    const { results, rel } = await routerClient.regions.list({
      country: country.slug,
      limit: 2,
      cursor: 1,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(regions[0].id);
    expect(results[1].id).toBe(regions[1].id);
    expect(rel.nextCursor).toBe(2);
    expect(rel.prevCursor).toBeNull();
  });

  test("filters regions with bottles", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      totalBottles: 1,
    });
    await fixtures.Region({ countryId: country.id, totalBottles: 0 });

    const { results } = await routerClient.regions.list({
      country: country.slug,
      hasBottles: true,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(region1.id);
  });

  test("errors on invalid country slug", async ({ fixtures }) => {
    const err = await waitError(
      routerClient.regions.list({
        country: "nonexistent-country",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Invalid country.]`);
  });
});
