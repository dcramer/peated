import { upsertCatalogListing } from "@peated/server/lib/catalogListings";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("official catalog listing routes", () => {
  test("requires an administrator", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: false });

    const listError = await waitError(() =>
      routerClient.externalSites.catalogListings.list(
        { site: "catalog-auth-test" },
        { context: { user } },
      ),
    );
    const coverageError = await waitError(() =>
      routerClient.externalSites.catalogListings.coverage(
        { site: "catalog-auth-test" },
        { context: { user } },
      ),
    );

    expect(listError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(coverageError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists, filters, and paginates one site's catalog evidence", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const site = await fixtures.ExternalSite({ type: "catalog-route-test" });
    const otherSite = await fixtures.ExternalSite({
      type: "other-catalog-route-test",
    });
    await upsertCatalogListing(site.id, {
      externalProductId: "alpha-1",
      name: "Alpha Release",
      url: "https://example.com/alpha",
      imageUrl: "https://example.com/alpha.jpg",
      volume: 700,
      sourceBottleIdentity: { abv: 46 },
    });
    await upsertCatalogListing(site.id, {
      name: "Beta Release",
      url: "https://example.com/beta",
    });
    await upsertCatalogListing(otherSite.id, {
      name: "Other Release",
      url: "https://other.example.com/release",
    });

    const first = await routerClient.externalSites.catalogListings.list(
      { site: site.type, limit: 1 },
      { context: { user: admin } },
    );
    expect(first.results).toMatchObject([
      {
        externalProductId: "alpha-1",
        name: "Alpha Release",
        volume: 700,
        sourceBottleIdentity: { abv: 46 },
      },
    ]);
    expect(first.rel).toEqual({ nextCursor: 2, prevCursor: null });

    const filtered = await routerClient.externalSites.catalogListings.list(
      { site: site.type, query: "beta" },
      { context: { user: admin } },
    );
    expect(filtered.results.map(({ name }) => name)).toEqual(["Beta Release"]);
  });

  test("returns source-level evidence coverage", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const site = await fixtures.ExternalSite({
      type: "catalog-coverage-test",
    });
    await upsertCatalogListing(site.id, {
      externalProductId: "complete-1",
      name: "Complete Release",
      url: "https://example.com/complete",
      imageUrl: "https://example.com/complete.jpg",
      volume: 700,
      sourceBottleIdentity: { stated_age: 12 },
    });
    await upsertCatalogListing(site.id, {
      name: "Sparse Release",
      url: "https://example.com/sparse",
    });

    await expect(
      routerClient.externalSites.catalogListings.coverage(
        { site: site.type },
        { context: { user: admin } },
      ),
    ).resolves.toEqual({
      total: 2,
      withProductId: 1,
      withImage: 1,
      withVolume: 1,
      withBottleDetails: 1,
    });
  });
});
