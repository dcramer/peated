import { describe, expect, it } from "vitest";
import {
  serializeCountryStructuredData,
  serializeRegionStructuredData,
  serializeSeriesStructuredData,
} from "./catalogStructuredData";

describe("catalog structured data", () => {
  const country = { name: "Scotland", slug: "scotland", description: null };
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
