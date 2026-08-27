import type { Bottle, Entity, StorePrice } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StorePriceTable from "./storePriceTable";

const timestamp = "2026-07-22T12:00:00.000Z";

const brand = {
  id: 7,
  peatedId: "E0007",
  name: "Springbank",
  shortName: null,
  kind: "brand",
  ownerId: null,
  description: null,
  descriptionSrc: null,
  yearEstablished: null,
  website: null,
  country: null,
  region: null,
  address: null,
  location: null,
  totalTastings: 0,
  totalBottles: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Entity;

const bottle = {
  id: 19,
  peatedId: "B0019",
  fullName: "Springbank 12 Cask Strength Batch 24",
  name: "12 Cask Strength Batch 24",
  series: null,
  category: "single_malt",
  edition: "Batch 24",
  statedAge: 12,
  caskStrength: true,
  singleCask: false,
  naturalColor: null,
  nonChillFiltered: null,
  maltPhenolPpm: null,
  noAgeStatement: null,
  abv: 56.2,
  vintageYear: null,
  bottlingYear: null,
  releaseYear: 2024,
  releaseDate: null,
  maturation: null,
  caskNumber: null,
  outturn: null,
  brand,
  distillers: [],
  bottler: null,
  description: null,
  descriptionSrc: null,
  imageUrl: null,
  flavorProfile: null,
  tastingNotes: null,
  suggestedTags: [],
  avgRating: null,
  avgScore: null,
  totalScores: 0,
  ratingStats: {
    pass: 0,
    sip: 0,
    savor: 0,
    total: 0,
    avg: null,
    percentage: { pass: 0, sip: 0, savor: 0 },
  },
  totalTastings: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  isFavorite: false,
  isLibrary: false,
  hasTasted: false,
} satisfies Bottle;

function makePrice(overrides: Partial<StorePrice>): StorePrice {
  return {
    id: 1,
    name: "Store listing",
    externalProductId: null,
    barcode: null,
    price: 7999,
    currency: "usd",
    url: "https://example.com/store-listing",
    volume: 750,
    updatedAt: new Date().toISOString(),
    imageUrl: null,
    isValid: true,
    bottle: null,
    ...overrides,
  };
}

describe("StorePriceTable", () => {
  it("shows when each listing was last seen", () => {
    const updatedAt = "2026-07-22T12:34:56.000Z";
    const html = renderToStaticMarkup(
      <StorePriceTable priceList={[makePrice({ updatedAt })]} />,
    );

    expect(html).toContain("Last seen");
    expect(html).toContain(`dateTime="${updatedAt}"`);
  });

  it("links a resolved listing to its direct Bottle", () => {
    const html = renderToStaticMarkup(
      <StorePriceTable priceList={[makePrice({ bottle })]} />,
    );

    expect(html).toContain('href="/bottles/19"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
  });

  it("renders unresolved identity without a Bottle link", () => {
    const html = renderToStaticMarkup(
      <StorePriceTable
        priceList={[
          makePrice({ id: 2, name: "Unresolved listing", bottle: null }),
        ]}
      />,
    );

    expect(html).toContain("No Bottle");
    expect(html).not.toContain('href="/bottles/');
  });
});
