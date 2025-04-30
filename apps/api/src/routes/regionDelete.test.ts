import { db } from "@peated/server/db";
import { regions } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../trpc/router";

describe("regionDelete", () => {
  test("requires authentication", async () => {
    const caller = createCaller({ user: null });
    const err = await waitError(
      caller.regionDelete({
        country: "test-country",
        slug: "test-region",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const caller = createCaller({ user });
    const err = await waitError(
      caller.regionDelete({
        country: "test-country",
        slug: "test-region",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  test("deletes region by country id and slug", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const adminUser = await fixtures.User({ admin: true });

    const caller = createCaller({ user: adminUser });
    await caller.regionDelete({
      country: country.id,
      slug: region.slug,
    });

    const deletedRegion = await db
      .select()
      .from(regions)
      .where(eq(regions.id, region.id));
    expect(deletedRegion.length).toBe(0);
  });

  test("deletes region by country slug and region slug", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const adminUser = await fixtures.User({ admin: true });

    const caller = createCaller({ user: adminUser });
    await caller.regionDelete({
      country: country.slug,
      slug: region.slug,
    });

    const deletedRegion = await db
      .select()
      .from(regions)
      .where(eq(regions.id, region.id));
    expect(deletedRegion.length).toBe(0);
  });

  test("throws BAD_REQUEST for invalid country", async ({ fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });

    const caller = createCaller({ user: adminUser });
    const err = await waitError(
      caller.regionDelete({
        country: "nonexistent-country",
        slug: "some-region",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: Invalid country]`);
  });

  test("throws NOT_FOUND for non-existent region", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const adminUser = await fixtures.User({ admin: true });

    const caller = createCaller({ user: adminUser });
    const err = await waitError(
      caller.regionDelete({
        country: country.id,
        slug: "nonexistent-region",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: NOT_FOUND]`);
  });

  test("is case-insensitive for country and region slugs", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country({ slug: "United-States" });
    const region = await fixtures.Region({
      countryId: country.id,
      slug: "California",
    });
    const adminUser = await fixtures.User({ admin: true });

    const caller = createCaller({ user: adminUser });
    await caller.regionDelete({
      country: "united-states",
      slug: "california",
    });

    const deletedRegion = await db
      .select()
      .from(regions)
      .where(eq(regions.id, region.id));
    expect(deletedRegion.length).toBe(0);
  });
});
