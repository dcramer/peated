import type { CatalogTargetV1 } from "@peated/server/schemas";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PriceChangeIdentity } from "./priceChanges";

const groupTarget = {
  kind: "group",
  targetId: 41,
  group: {
    id: 7,
    fullName: "Springbank 12 Cask Strength",
    category: "single_malt",
    representativeBottleId: 99,
  },
} as CatalogTargetV1;

describe("PriceChangeIdentity", () => {
  it("links exact changes to their independently complete Bottle", () => {
    const target = {
      kind: "bottle",
      targetId: 42,
      group: groupTarget.group,
      bottle: {
        id: 19,
        fullName: "Springbank 12 Cask Strength Batch 24",
        category: "single_malt",
      },
    } as CatalogTargetV1;

    const html = renderToStaticMarkup(
      <PriceChangeIdentity target={target} hasTasted={false} isLibrary />,
    );

    expect(html).toContain('href="/bottles/19"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
    expect(html).toContain("Exact bottle");
    expect(html).toContain('aria-label="In Library"');
    expect(html).not.toContain('aria-label="Tasted"');
  });

  it("renders a generic change through a release-family route", () => {
    const html = renderToStaticMarkup(
      <PriceChangeIdentity target={groupTarget} hasTasted isLibrary />,
    );

    expect(html).toContain('href="/bottles/99/releases"');
    expect(html).not.toContain('href="/bottles/99"');
    expect(html).toContain("Springbank 12 Cask Strength");
    expect(html).toContain("Exact bottle not specified");
    expect(html).toContain("Single Malt");
    expect(html).toContain('aria-label="In Library"');
    expect(html).toContain('aria-label="Tasted"');
  });
});
