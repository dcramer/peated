import { db } from "@peated/server/db";
import { regions } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

describe("regionUpdate", () => {
  test("requires authentication", async () => {
    const caller = createCaller({ user: null });
    const err = await waitError(
      caller.regionUpdate({
        country: "test-country",
        slug: "test-region",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  test("requires mod", async ({ fixtures }) => {
    const user = await fixtures.User();
    const caller = createCaller({ user });
    const err = await waitError(
      caller.regionUpdate({
        country: "test-country",
        slug: "test-region",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  test("updates region description", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const modUser = await fixtures.User({ mod: true });

    const caller = createCaller({ user: modUser });
    const updatedRegion = await caller.regionUpdate({
      country: country.id,
      slug: region.slug,
      description: "New description",
    });

    expect(updatedRegion.id).toBe(region.id);
    expect(updatedRegion.description).toBe("New description");

    const [dbRegion] = await db
      .select()
      .from(regions)
      .where(eq(regions.id, region.id));
    expect(dbRegion.description).toBe("New description");
    expect(dbRegion.descriptionSrc).toBe("user");
  });

  test("updates region with country slug", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const modUser = await fixtures.User({ mod: true });

    const caller = createCaller({ user: modUser });
    const updatedRegion = await caller.regionUpdate({
      country: country.slug,
      slug: region.slug,
      description: "New description",
    });

    expect(updatedRegion.id).toBe(region.id);
    expect(updatedRegion.description).toBe("New description");
  });

  test("returns unchanged region when no updates provided", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const modUser = await fixtures.User({ mod: true });

    const caller = createCaller({ user: modUser });
    const result = await caller.regionUpdate({
      country: country.id,
      slug: region.slug,
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: region.id,
        name: region.name,
        slug: region.slug,
        description: region.description,
      }),
    );
  });

  test("throws BAD_REQUEST for invalid country", async ({ fixtures }) => {
    const modUser = await fixtures.User({ mod: true });

    const caller = createCaller({ user: modUser });
    const err = await waitError(
      caller.regionUpdate({
        country: "nonexistent-country",
        slug: "some-region",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: Invalid country]`);
  });

  test("throws NOT_FOUND for non-existent region", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const modUser = await fixtures.User({ mod: true });

    const caller = createCaller({ user: modUser });
    const err = await waitError(
      caller.regionUpdate({
        country: country.id,
        slug: "nonexistent-region",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: NOT_FOUND]`);
  });
});
