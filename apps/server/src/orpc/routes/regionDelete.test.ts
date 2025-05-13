import { db } from "@peated/server/db";
import { regions } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("DELETE /regions", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.regionDelete({
        country: "test-country",
        slug: "test-region",
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.regionDelete(
        {
          country: "test-country",
          slug: "test-region",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("deletes region by country id and slug", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const adminUser = await fixtures.User({ admin: true });

    await routerClient.regionDelete(
      {
        country: country.id,
        slug: region.slug,
      },
      { context: { user: adminUser } },
    );

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

    await routerClient.regionDelete(
      {
        country: country.slug,
        slug: region.slug,
      },
      { context: { user: adminUser } },
    );

    const deletedRegion = await db
      .select()
      .from(regions)
      .where(eq(regions.id, region.id));
    expect(deletedRegion.length).toBe(0);
  });

  test("throws BAD_REQUEST for invalid country", async ({ fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.regionDelete(
        {
          country: "nonexistent-country",
          slug: "some-region",
        },
        { context: { user: adminUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("throws NOT_FOUND for non-existent region", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const adminUser = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.regionDelete(
        {
          country: country.id,
          slug: "nonexistent-region",
        },
        { context: { user: adminUser } },
      ),
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
    const adminUser = await fixtures.User({ admin: true });

    await routerClient.regionDelete(
      {
        country: "united-states",
        slug: "california",
      },
      { context: { user: adminUser } },
    );

    const deletedRegion = await db
      .select()
      .from(regions)
      .where(eq(regions.id, region.id));
    expect(deletedRegion.length).toBe(0);
  });
});
