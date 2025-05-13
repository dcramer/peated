import { TRPCError } from "@trpc/server";
import { createCaller } from "../router";

describe("regionBySlug", () => {
  test("retrieves a region by slug and country id", async ({
    fixtures,
    expect,
  }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    const caller = createCaller({ user: null });
    const result = await caller.regionBySlug({
      country: country.id,
      slug: region.slug,
    });

    expect(result.id).toBe(region.id);
    expect(result.name).toBe(region.name);
    expect(result.slug).toBe(region.slug);
  });

  test("retrieves a region by slug and country slug", async ({
    fixtures,
    expect,
  }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    const caller = createCaller({ user: null });
    const result = await caller.regionBySlug({
      country: country.slug,
      slug: region.slug,
    });

    expect(result.id).toBe(region.id);
    expect(result.name).toBe(region.name);
    expect(result.slug).toBe(region.slug);
  });

  test("throws BAD_REQUEST for invalid country slug", async ({
    fixtures,
    expect,
  }) => {
    const caller = createCaller({ user: null });
    await expect(
      caller.regionBySlug({
        country: "nonexistent-country",
        slug: "some-region",
      }),
    ).rejects.toThrow(TRPCError);
  });

  test("throws NOT_FOUND for non-existent region", async ({
    fixtures,
    expect,
  }) => {
    const country = await fixtures.Country();

    const caller = createCaller({ user: null });
    await expect(
      caller.regionBySlug({
        country: country.id,
        slug: "nonexistent-region",
      }),
    ).rejects.toThrow(TRPCError);
  });

  test("is case-insensitive for country and region slugs", async ({
    fixtures,
    expect,
  }) => {
    const country = await fixtures.Country({ slug: "United-States" });
    const region = await fixtures.Region({
      countryId: country.id,
      slug: "California",
    });

    const caller = createCaller({ user: null });
    const result = await caller.regionBySlug({
      country: "united-states",
      slug: "california",
    });

    expect(result.id).toBe(region.id);
    expect(result.name).toBe(region.name);
    expect(result.slug).toBe(region.slug);
  });

  test("returns serialized region data", async ({ fixtures, expect }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });

    const caller = createCaller({ user: null });
    const result = await caller.regionBySlug({
      country: country.id,
      slug: region.slug,
    });

    expect(result.id).toBe(region.id);
    expect(result.name).toBe(region.name);
    expect(result.slug).toBe(region.slug);
  });
});
