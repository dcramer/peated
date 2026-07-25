import type { CatalogTargetV1 } from "@peated/server/schemas";
import type { StorePrice } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StorePriceTable from "./storePriceTable";

const groupTarget = {
  kind: "group",
  targetId: 41,
  group: {
    id: 7,
    fullName: "Springbank 12 Cask Strength",
    representativeBottleId: 99,
  },
} as CatalogTargetV1;

const bottleTarget = {
  kind: "bottle",
  targetId: 42,
  group: groupTarget.group,
  bottle: {
    id: 19,
    fullName: "Springbank 12 Cask Strength Batch 24",
  },
} as CatalogTargetV1;

function makePrice(overrides: Partial<StorePrice>): StorePrice {
  return {
    id: 1,
    name: "Store listing",
    price: 7999,
    currency: "usd",
    url: "https://example.com/store-listing",
    volume: 750,
    updatedAt: new Date().toISOString(),
    imageUrl: null,
    isValid: true,
    target: null,
    ...overrides,
  };
}

describe("StorePriceTable", () => {
  it("links an exact target to its concrete Bottle", () => {
    const html = renderToStaticMarkup(
      <StorePriceTable priceList={[makePrice({ target: bottleTarget })]} />,
    );

    expect(html).toContain('href="/bottles/19"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
    expect(html).toContain("Exact bottle");
  });

  it("renders generic and unresolved identities without exact Bottle links", () => {
    const html = renderToStaticMarkup(
      <StorePriceTable
        priceList={[
          makePrice({ id: 1, target: groupTarget }),
          makePrice({ id: 2, name: "Unresolved listing", target: null }),
        ]}
      />,
    );

    expect(html).toContain('href="/bottles/99/releases"');
    expect(html).not.toContain('href="/bottles/99"');
    expect(html).toContain("Springbank 12 Cask Strength");
    expect(html).toContain("Exact bottle not specified");
    expect(html).toContain("No Bottle");
  });
});
