import { db } from "@peated/server/db";
import { catalogListings } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { upsertCatalogListing } from "./catalogListings";

describe("catalog listing persistence", () => {
  test("creates and updates one listing by external product identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "official-catalog-test" });
    const created = await upsertCatalogListing(site.id, {
      externalProductId: "product-1",
      name: "Original release",
      url: "https://example.com/products/original",
      volume: 700,
      sourceBottleIdentity: { stated_age: 12, abv: 46 },
    });
    const updated = await upsertCatalogListing(site.id, {
      externalProductId: "product-1",
      name: "Official release name",
      url: "https://example.com/products/current",
      imageUrl: "https://example.com/images/current.jpg",
      volume: 700,
      sourceBottleIdentity: { stated_age: 12, abv: 46 },
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Official release name");
    expect(updated.url).toBe("https://example.com/products/current");
    expect(updated.firstSeenAt).toEqual(created.firstSeenAt);
    expect(updated.sourceFingerprint).not.toBe("");
    const rows = await db
      .select()
      .from(catalogListings)
      .where(eq(catalogListings.externalSiteId, site.id));
    expect(rows).toHaveLength(1);
  });

  test("uses the canonical URL when no product id is available", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "catalog-url-test" });
    const first = await upsertCatalogListing(site.id, {
      name: "Release name",
      url: "https://example.com/products/release",
    });
    const repeated = await upsertCatalogListing(site.id, {
      name: "Updated release name",
      url: "https://example.com/products/release",
    });

    expect(repeated.id).toBe(first.id);
    expect(repeated.name).toBe("Updated release name");
  });

  test("rejects conflicting product id and URL identities", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "catalog-conflict-test" });
    await upsertCatalogListing(site.id, {
      externalProductId: "product-1",
      name: "First",
      url: "https://example.com/products/first",
    });
    await upsertCatalogListing(site.id, {
      externalProductId: "product-2",
      name: "Second",
      url: "https://example.com/products/second",
    });

    await expect(
      upsertCatalogListing(site.id, {
        externalProductId: "product-1",
        name: "Conflict",
        url: "https://example.com/products/second",
      }),
    ).rejects.toThrow(/identity conflicts/);
  });

  test("rejects an invalid stored volume", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "catalog-volume-test" });

    await expect(
      db.insert(catalogListings).values({
        externalSiteId: site.id,
        sourceFingerprint: "invalid-volume",
        name: "Invalid volume",
        url: "https://example.com/products/invalid-volume",
        volume: 0,
      }),
    ).rejects.toThrow(/catalog_listing_volume_check/);
  });
});
