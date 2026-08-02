import { db } from "@peated/server/db";
import { regions } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("PATCH /countries/:country/regions/:region", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.regions.update(
        {
          country: "test-country",
          region: "test-region",
        },
        { context: { user: null } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod", async ({ fixtures }) => {
    const user = await fixtures.User();
    const err = await waitError(
      routerClient.regions.update(
        {
          country: "test-country",
          region: "test-region",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates region description", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const modUser = await fixtures.User({ mod: true });

    const updatedRegion = await routerClient.regions.update(
      {
        country: country.slug,
        region: region.slug,
        description: "New description",
      },
      { context: { user: modUser } },
    );

    expect(updatedRegion.id).toBe(region.id);
    expect(updatedRegion.description).toBe("New description");

    const [dbRegion] = await db
      .select()
      .from(regions)
      .where(eq(regions.id, region.id));
    expect(dbRegion.description).toBe("New description");
    expect(dbRegion.descriptionSrc).toBe("user");
  });

  test("renames a region and regenerates its slug", async ({ fixtures }) => {
    const country = await fixtures.Country({
      name: "Scotland",
      slug: "scotland",
    });
    const region = await fixtures.Region({
      countryId: country.id,
      name: "Cambeltown",
      slug: "cambeltown",
    });
    const modUser = await fixtures.User({ mod: true });

    const updatedRegion = await routerClient.regions.update(
      {
        country: country.slug,
        region: region.slug,
        name: "Campbeltown",
      },
      { context: { user: modUser } },
    );

    expect(updatedRegion).toMatchObject({
      id: region.id,
      name: "Campbeltown",
      slug: "campbeltown",
    });
    await expect(
      db.query.regions.findFirst({ where: eq(regions.id, region.id) }),
    ).resolves.toMatchObject({
      name: "Campbeltown",
      slug: "campbeltown",
    });
  });

  test("repairs a stale slug when the supplied name is unchanged", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({
      countryId: country.id,
      name: "Campbeltown",
      slug: "cambeltown",
    });
    const modUser = await fixtures.User({ mod: true });

    const updatedRegion = await routerClient.regions.update(
      {
        country: country.slug,
        region: region.slug,
        name: region.name,
      },
      { context: { user: modUser } },
    );

    expect(updatedRegion).toMatchObject({
      id: region.id,
      name: "Campbeltown",
      slug: "campbeltown",
    });
  });

  test("updates region with country slug", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const modUser = await fixtures.User({ mod: true });

    const updatedRegion = await routerClient.regions.update(
      {
        country: country.slug,
        region: region.slug,
        description: "New description",
      },
      { context: { user: modUser } },
    );

    expect(updatedRegion.id).toBe(region.id);
    expect(updatedRegion.description).toBe("New description");
  });

  test("returns unchanged region when no updates provided", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country();
    const region = await fixtures.Region({ countryId: country.id });
    const modUser = await fixtures.User({ mod: true });

    const result = await routerClient.regions.update(
      {
        country: country.slug,
        region: region.slug,
      },
      { context: { user: modUser } },
    );

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

    const err = await waitError(
      routerClient.regions.update(
        {
          country: "nonexistent-country",
          region: "some-region",
        },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Invalid country.]`);
  });

  test("throws NOT_FOUND for non-existent region", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.regions.update(
        {
          country: country.slug,
          region: "nonexistent-region",
        },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Region not found.]`);
  });
});
