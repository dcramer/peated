import { TRPCError } from "@trpc/server";
import { createCaller } from "../trpc/router";

describe("regionList", () => {
  test("lists regions for a country by id", async ({ fixtures, expect }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Region A",
    });
    const region2 = await fixtures.Region({
      countryId: country.id,
      name: "Region B",
    });

    const caller = createCaller({ user: null });
    const { results, rel } = await caller.regionList({
      country: country.id,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(region1.id);
    expect(results[1].id).toBe(region2.id);
    expect(rel.nextCursor).toBeNull();
    expect(rel.prevCursor).toBeNull();
  });

  test("lists regions for a country by slug", async ({ fixtures, expect }) => {
    const country = await fixtures.Country({ slug: "test-country" });
    const region = await fixtures.Region({ countryId: country.id });

    const caller = createCaller({ user: null });
    const { results } = await caller.regionList({
      country: "test-country",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(region.id);
  });

  test("filters regions by query", async ({ fixtures, expect }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Alpha Region",
    });
    await fixtures.Region({ countryId: country.id, name: "Beta Region" });

    const caller = createCaller({ user: null });
    const { results } = await caller.regionList({
      country: country.id,
      query: "Alpha",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(region1.id);
  });

  test("sorts regions by name ascending", async ({ fixtures, expect }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Alpha",
    });
    const region2 = await fixtures.Region({
      countryId: country.id,
      name: "Beta",
    });

    const caller = createCaller({ user: null });
    const { results } = await caller.regionList({
      country: country.id,
      sort: "name",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(region1.id);
    expect(results[1].id).toBe(region2.id);
  });

  test("sorts regions by name descending", async ({ fixtures, expect }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Alpha",
    });
    const region2 = await fixtures.Region({
      countryId: country.id,
      name: "Beta",
    });

    const caller = createCaller({ user: null });
    const { results } = await caller.regionList({
      country: country.id,
      sort: "-name",
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(region2.id);
    expect(results[1].id).toBe(region1.id);
  });

  test("paginates results", async ({ fixtures, expect }) => {
    const country = await fixtures.Country();
    const regions = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        fixtures.Region({ countryId: country.id, name: `Region ${i + 1}` }),
      ),
    );

    const caller = createCaller({ user: null });
    const { results, rel } = await caller.regionList({
      country: country.id,
      limit: 2,
      cursor: 1,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(regions[0].id);
    expect(results[1].id).toBe(regions[1].id);
    expect(rel.nextCursor).toBe(2);
    expect(rel.prevCursor).toBeNull();
  });

  test("filters regions with bottles", async ({ fixtures, expect }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      totalBottles: 1,
    });
    await fixtures.Region({ countryId: country.id, totalBottles: 0 });

    const caller = createCaller({ user: null });
    const { results } = await caller.regionList({
      country: country.id,
      hasBottles: true,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(region1.id);
  });

  test("throws error for invalid country slug", async ({
    fixtures,
    expect,
  }) => {
    const caller = createCaller({ user: null });
    await expect(
      caller.regionList({ country: "nonexistent-country" }),
    ).rejects.toThrow(TRPCError);
  });
});
