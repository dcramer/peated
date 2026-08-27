import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TastingBottleIdentity, {
  type TastingBottleIdentitySource,
} from "./tastingBottleIdentity";

const bottle = {
  id: 42,
  fullName:
    "Lagavulin 21-year-old - 2025 Release - 55.1% ABV - Single Cask - Cask Strength",
  name: "21-year-old - 2025 Release - 55.1% ABV - Single Cask - Cask Strength",
  brand: {
    id: 7,
    kind: "brand",
    name: "Lagavulin",
    shortName: null,
  },
  series: null,
  group: {
    name: "21-year-old",
    statedAge: 21,
  },
  edition: "2025 Release",
  category: "single_malt",
  statedAge: 21,
  noAgeStatement: null,
  abv: 55.1,
  vintageYear: 2004,
  releaseYear: 2025,
  singleCask: true,
  caskStrength: true,
  outturn: null,
  maturation: null,
  caskNumber: null,
  distillers: [{ id: 7, kind: "distillery", name: "Lagavulin Distillery" }],
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
      'title="Lagavulin 21-year-old - 2025 Release - 55.1% ABV - Single Cask - Cask Strength"',
    );
    expect(text).toContain("Lagavulin 21-year-old");
    expect(text).toContain("2025 Release");
    expect(text.match(/2025 Release/g)).toHaveLength(1);
    expect(text).not.toContain("2004 Vintage");
    expect(text).toContain("·Lagavulin Distillery");
    expect(text).not.toContain("Single Malt");
    expect(text).not.toContain("Aged 21 years");
    expect(html).toContain("bg-highlight");
    expect(html).toContain("p-4");
    expect(html).toContain("text-black");
    expect(html).toContain("lg:p-5");
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
    expect(text).toContain("Lagavulin 21-year-old");
    expect(text).toContain("Lagavulin 21-year-old - 2025 Release");
    expect(text).not.toContain("Lagavulin Distillery");
    expect(text).not.toContain("Single Malt");
    expect(text).not.toContain("Aged 21 years");
    expect(text).not.toContain("Single Cask");
    expect(text).not.toContain("55.1% ABV");
    expect(html).toContain('data-bottle-status="library"');
    expect(html).toContain('data-bottle-status="tasted"');
  });

  it("calls out a missing age statement in the panel", () => {
    const html = renderToStaticMarkup(
      <TastingBottleIdentity
        bottle={{
          ...bottle,
          statedAge: null,
          noAgeStatement: true,
          group: { name: "Offerman Edition", statedAge: null },
        }}
      />,
    );

    expect(html.replace(/<[^>]*>/g, "")).toContain("No age statement");
  });

  it("does not label an unknown age as NAS", () => {
    const html = renderToStaticMarkup(
      <TastingBottleIdentity
        bottle={{
          ...bottle,
          statedAge: null,
          noAgeStatement: null,
          group: { name: "Offerman Edition", statedAge: null },
        }}
      />,
    );

    expect(html.replace(/<[^>]*>/g, "")).not.toContain("No age statement");
  });

  it("does not repeat Single Cask when the clean name already includes it", () => {
    const html = renderToStaticMarkup(
      <TastingBottleIdentity
        bottle={{
          ...bottle,
          group: { name: "Single Cask 21", statedAge: 21 },
        }}
        variant="inline"
      />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text.match(/Single Cask/g)).toHaveLength(1);
    expect(html).not.toContain('title="Single cask"');
  });

  it.each(["inline", "panel"] as const)(
    "falls back to a concise absolute Bottle name in the %s variant",
    (variant) => {
      const html = renderToStaticMarkup(
        <TastingBottleIdentity
          bottle={{ ...bottle, group: undefined }}
          variant={variant}
        />,
      );

      expect(html).toContain('href="/bottles/42"');
      expect(html).toContain("Lagavulin 21-year-old");
      expect(html).not.toContain(
        ">Lagavulin 21-year-old - 2025 Release - 55.1% ABV - Single Cask - Cask Strength<",
      );
    },
  );
});
