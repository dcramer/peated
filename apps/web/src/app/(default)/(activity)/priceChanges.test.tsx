import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PriceChangeIdentity } from "./priceChanges";

describe("PriceChangeIdentity", () => {
  it("links price changes to their independently complete Bottle", () => {
    const html = renderToStaticMarkup(
      <PriceChangeIdentity
        bottle={{
          id: 19,
          fullName: "Springbank 12 Cask Strength Batch 24",
          category: "single_malt",
        }}
        hasTasted={false}
        isLibrary
      />,
    );

    expect(html).toContain('href="/bottles/19"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
    expect(html).toContain("Single Malt");
    expect(html).toContain('aria-label="In Library"');
    expect(html).not.toContain('aria-label="Tasted"');
  });

  it("renders tasted state without release-family presentation", () => {
    const html = renderToStaticMarkup(
      <PriceChangeIdentity
        bottle={{
          id: 99,
          fullName: "Springbank 12 Cask Strength",
          category: null,
        }}
        hasTasted
        isLibrary={false}
      />,
    );

    expect(html).toContain('href="/bottles/99"');
    expect(html).not.toContain("/releases");
    expect(html).toContain("Springbank 12 Cask Strength");
    expect(html).not.toContain('aria-label="In Library"');
    expect(html).toContain('aria-label="Tasted"');
  });
});
