import { db } from "@peated/server/db";
import { regions } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /countries/:country/regions/:region", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.regions.delete({
        country: "test-country",
        region: "test-region",
      })
    );
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });

  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.regions.delete(
        {
          country: "test-country",
          region: "test-region",
        },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });

  test("deletes region by country id and slug", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const adminUser = await fixtures.User({ admin: true });

    await routerClient.regions.delete(
      {
        country: country.slug,
        region: region.slug,
      },
      { context: { user: adminUser } }
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

    await routerClient.regions.delete(
      {
        country: country.slug,
        region: region.slug,
      },
      { context: { user: adminUser } }
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
      routerClient.regions.delete(
        {
          country: "nonexistent-country",
          region: "some-region",
        },
        { context: { user: adminUser } }
      )
    );
    expect(err).toMatchInlineSnapshot("[Error: Invalid country.]");
  });

  test("throws NOT_FOUND for non-existent region", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const adminUser = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.regions.delete(
        {
          country: country.slug,
          region: "nonexistent-region",
        },
        { context: { user: adminUser } }
      )
    );
    expect(err).toMatchInlineSnapshot("[Error: Region not found.]");
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

    await routerClient.regions.delete(
      {
        country: "united-states",
        region: "california",
      },
      { context: { user: adminUser } }
    );

    const deletedRegion = await db
      .select()
      .from(regions)
      .where(eq(regions.id, region.id));
    expect(deletedRegion.length).toBe(0);
  });
});
