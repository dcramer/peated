import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CatalogListingTable, {
  catalogListingFacts,
} from "./catalogListingTable";

type Listing = ComponentProps<typeof CatalogListingTable>["listings"][number];

function listing(overrides: Partial<Listing> = {}): Listing {
  const timestamp = "2026-09-05T12:00:00.000Z";
  return {
    externalProductId: "official-1",
    name: "Official Release",
    url: "https://example.com/whisky/release",
    imageUrl: null,
    volume: 700,
    sourceBottleIdentity: {
      brand: null,
      bottler: null,
      expression: null,
      series: null,
      distillery: null,
      category: null,
      stated_age: 12,
      abv: 46,
      release_year: 2026,
      vintage_year: null,
      cask_strength: null,
      single_cask: null,
      maturation: null,
      cask_number: null,
      outturn: null,
      edition: "Autumn Edition",
    },
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("CatalogListingTable", () => {
  it("shows the product details and first and last seen times", () => {
    const item = listing();
    const html = renderToStaticMarkup(
      <CatalogListingTable
        listings={[item]}
        rel={{ nextCursor: null, prevCursor: null }}
      />,
    );

    expect(html).toContain("Official Release");
    expect(html).toContain("official-1");
    expect(html).toContain(
      "700 ml · 46% ABV · 12 years · Autumn Edition · Released 2026",
    );
    expect(html).toContain("Bottle details");
    expect(html).toContain("Product ID");
    expect(html).toContain("First seen");
    expect(html).toContain("Last seen");
    expect(
      html.match(new RegExp(`dateTime="${item.firstSeenAt}"`, "g")),
    ).toHaveLength(4);
    expect(html).toContain(`dateTime="${item.lastSeenAt}"`);
  });

  it("explains missing optional evidence", () => {
    const sparse = listing({
      externalProductId: null,
      volume: null,
      sourceBottleIdentity: null,
    });

    expect(catalogListingFacts(sparse)).toBe("");
    const html = renderToStaticMarkup(
      <CatalogListingTable
        listings={[sparse]}
        rel={{ nextCursor: null, prevCursor: null }}
      />,
    );
    expect(html).toContain("No bottle details");
    expect(html).toContain("Page URL");
  });
});
