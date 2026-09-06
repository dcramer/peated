import { describe, expect, it } from "vitest";
import {
  serializeBottleStructuredData,
  serializeCountryStructuredData,
  serializeRegionStructuredData,
  serializeSeriesStructuredData,
} from "./catalogStructuredData";

describe("catalog structured data", () => {
  const country = { name: "Scotland", slug: "scotland", description: null };
  it("marks up a Product without the combined median as an aggregate rating", () => {
    const data = JSON.parse(
      serializeBottleStructuredData({
        id: 42,
        name: "16-year-old",
        brand: { name: "Lagavulin" },
        description: "A smoky Islay single malt.",
        imageUrl: "https://images.peated.com/lagavulin.jpg",
        lastPrice: { currency: "USD", price: 8999 },
      }),
    );

    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Lagavulin 16-year-old",
      url: expect.stringContaining("/bottles/42-lagavulin-16-year-old"),
      offers: {
        "@type": "AggregateOffer",
        lowPrice: 89.99,
        highPrice: 89.99,
        priceCurrency: "USD",
      },
    });
    expect(data).not.toHaveProperty("aggregateRating");
  });

  it("escapes Bottle text in structured data", () => {
    const json = serializeBottleStructuredData({
      id: 42,
      name: '</script><script>alert("bottle")</script>',
      brand: { name: "Example" },
      description: '</script><script>alert("description")</script>',
      imageUrl: null,
      lastPrice: null,
    });
    expect(json).not.toContain("<");
  });

  it("describes countries and regions with their browse hierarchy", () => {
    const countryData = JSON.parse(serializeCountryStructuredData(country));
    expect(countryData).toMatchObject({
      "@type": "CollectionPage",
      name: "Whisky from Scotland",
      about: { "@type": "Country", name: "Scotland" },
    });
    const regionData = JSON.parse(
      serializeRegionStructuredData({
        name: "Islay",
        slug: "islay",
        country,
        description: null,
      }),
    );
    expect(
      regionData.breadcrumb.itemListElement.map(
        (item: { name: string; position: number }) => [
          item.position,
          item.name,
        ],
      ),
    ).toEqual([
      [1, "Locations"],
      [2, "Scotland"],
      [3, "Islay"],
    ]);
    expect(regionData.url).toMatch(/\/locations\/scotland\/regions\/islay$/);
    expect(regionData.about["@type"]).toBe("AdministrativeArea");
  });
  it("links a series to its owning brand and safely embeds stored names", () => {
    const serialized = serializeSeriesStructuredData({
      id: 42,
      fullName: "Ardbeg </script>",
      description: null,
      numReleases: 1,
      brand: { id: 1, kind: "brand", name: "Ardbeg" },
    });
    expect(serialized).not.toContain("<");
    const data = JSON.parse(serialized);
    expect(data.name).toBe("Ardbeg </script> — Whisky series");
    expect(data.breadcrumb.itemListElement[0].item).toMatch(
      /\/brands\/1-ardbeg$/,
    );
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("mainEntity");
  });
});
