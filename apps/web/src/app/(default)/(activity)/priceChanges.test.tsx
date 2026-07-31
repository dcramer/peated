import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PriceChangeIdentity } from "./priceChanges";

function bottleIdentity({
  id,
  fullName,
  category,
}: {
  id: number;
  fullName: string;
  category: "single_malt" | null;
}) {
  return {
    id,
    fullName,
    name: fullName.replace(/^Springbank /, ""),
    brand: { name: "Springbank", shortName: null },
    group: { name: "12 Cask Strength", statedAge: 12 },
    category,
    edition: null,
    statedAge: 12,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    singleCask: false,
    caskStrength: true,
    caskFill: null,
    caskType: null,
    caskSize: null,
  };
}

describe("PriceChangeIdentity", () => {
  it("links price changes to their independently complete Bottle", () => {
    const html = renderToStaticMarkup(
      <PriceChangeIdentity
        bottle={bottleIdentity({
          id: 19,
          fullName: "Springbank 12 Cask Strength Batch 24",
          category: "single_malt",
        })}
        hasTasted={false}
        isLibrary
      />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(html).toContain('href="/bottles/19"');
    expect(text).toContain("Springbank");
    expect(text).toContain("12 Cask Strength");
    expect(text).not.toContain("Springbank 12 Cask Strength Batch 24");
    expect(html).toContain('aria-label="In Library"');
    expect(html).not.toContain('aria-label="Tasted"');
  });

  it("renders tasted state without release-family presentation", () => {
    const html = renderToStaticMarkup(
      <PriceChangeIdentity
        bottle={bottleIdentity({
          id: 99,
          fullName: "Springbank 12 Cask Strength",
          category: null,
        })}
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
