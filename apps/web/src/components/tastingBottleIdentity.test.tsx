import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TastingBottleIdentity, {
  type TastingBottleIdentitySource,
} from "./tastingBottleIdentity";

const bottle = {
  id: 42,
  fullName: "Lagavulin 21 - 2025 Release - 55.1% ABV - Single Cask - Cask 42",
  brand: {
    name: "Lagavulin",
    shortName: null,
  },
  group: {
    name: "21",
  },
  edition: "2025 Release",
  category: "single_malt",
  statedAge: 21,
  vintageYear: 2004,
  releaseYear: 2025,
  singleCask: true,
  distillers: [{ id: 7, name: "Lagavulin Distillery" }],
  isLibrary: true,
  hasTasted: true,
} satisfies TastingBottleIdentitySource;

describe("TastingBottleIdentity", () => {
  it("renders the legacy highlighted bottle card in a panel", () => {
    const html = renderToStaticMarkup(
      <TastingBottleIdentity bottle={bottle} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(html).toContain('href="/bottles/42"');
    expect(html).toContain(
      'title="Lagavulin 21 - 2025 Release - 55.1% ABV - Single Cask - Cask 42"',
    );
    expect(text).toContain("Lagavulin 21");
    expect(text).toContain("2025 Release (2025) (2004 Vintage)");
    expect(text).toContain("·Lagavulin Distillery");
    expect(text).toContain("Single Malt");
    expect(text).toContain("Aged 21 years");
    expect(html).toContain("bg-highlight p-4 text-black lg:p-5");
  });

  it("renders the complete legacy inline bottle card", () => {
    const html = renderToStaticMarkup(
      <TastingBottleIdentity bottle={bottle} variant="inline" />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(html).toContain(
      'class="flex items-center space-x-2 overflow-hidden sm:space-x-3 sm:rounded"',
    );
    expect(html).not.toContain("border-slate-800");
    expect(html).not.toContain("bg-slate-950");
    expect(text).toContain("Lagavulin 21");
    expect(text).toContain("2025 Release (2025) (2004 Vintage)");
    expect(text).toContain("·Lagavulin Distillery");
    expect(text).toContain("Single Malt");
    expect(text).toContain("Aged 21 years");
    expect(text).toContain("Single Cask");
    expect(text).not.toContain("55.1% ABV");
    expect(html).toContain('data-bottle-status="library"');
    expect(html).toContain('data-bottle-status="tasted"');
  });

  it.each(["inline", "panel"] as const)(
    "falls back to the exact Bottle name in the %s variant",
    (variant) => {
      const html = renderToStaticMarkup(
        <TastingBottleIdentity
          bottle={{ ...bottle, group: undefined }}
          variant={variant}
        />,
      );

      expect(html).toContain('href="/bottles/42"');
      expect(html).toContain(
        "Lagavulin 21 - 2025 Release - 55.1% ABV - Single Cask - Cask 42",
      );
    },
  );
});
