import { db } from "@peated/server/db";
import { regions } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("POST /countries/:country/regions", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.regions.create(
        {
          name: "Test Region",
          country: "test-country",
        },
        { context: { user: null } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod", async ({ defaults }) => {
    const err = await waitError(
      routerClient.regions.create(
        {
          name: "Test Region",
          country: "test-country",
        },
        { context: { user: defaults.user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a new region", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.regions.create(
      {
        name: "Test Region",
        country: country.slug,
        description: "A test region",
      },
      { context: { user: modUser } }
    );

    expect(data.id).toBeDefined();
    expect(data.name).toBe("Test Region");
    expect(data.slug).toBe("test-region");
    expect(data.description).toBe("A test region");

    const [newRegion] = await db
      .select()
      .from(regions)
      .where(eq(regions.id, data.id));

    expect(newRegion).toBeDefined();
    expect(newRegion.countryId).toBe(country.id);
  });

  test("throws error for non-existent country", async ({ fixtures }) => {
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.regions.create(
        {
          name: "Test Region",
          country: "nonexistent-country",
        },
        { context: { user: modUser } }
      )
    );

    expect(err).toMatchInlineSnapshot(`[Error: Country not found.]`);
  });

  test("handles duplicate name", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const existingRegion = await fixtures.Region({ countryId: country.id });
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.regions.create(
        {
          name: existingRegion.name,
          country: country.slug,
        },
        { context: { user: modUser } }
      )
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Conflicting object already exists (ID=1).]`
    );
  });

  test("creates region with minimal data", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.regions.create(
      {
        name: "Minimal Region",
        country: country.slug,
      },
      { context: { user: modUser } }
    );

    expect(data.id).toBeDefined();
    expect(data.name).toBe("Minimal Region");
    expect(data.description).toBeNull();

    const [newRegion] = await db
      .select()
      .from(regions)
      .where(eq(regions.id, data.id));

    expect(newRegion).toBeDefined();
    expect(newRegion.countryId).toBe(country.id);
  });
});
