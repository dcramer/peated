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
  category: "single_malt",
  statedAge: 21,
  abv: 55.1,
  vintageYear: 2004,
  releaseYear: 2025,
  singleCask: true,
  caskStrength: true,
  caskFill: "1st_fill",
  caskType: "oloroso",
  caskSize: "hogshead",
} satisfies TastingBottleIdentitySource;

describe("TastingBottleIdentity", () => {
  it("renders structured identity and exact fields in a panel", () => {
    const html = renderToStaticMarkup(
      <TastingBottleIdentity bottle={bottle} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(html).toContain('href="/bottles/42"');
    expect(html).toContain(
      'title="Lagavulin 21 - 2025 Release - 55.1% ABV - Single Cask - Cask 42"',
    );
    expect(text).toContain("Lagavulin 21");
    expect(text).toContain("Single Malt·21 years·55.1% ABV");
    expect(text).toContain("2004 vintage·2025 release");
    expect(text).toContain("Single cask·Cask strength");
    expect(text).toContain("1st Fill Oloroso Hogshead cask");
  });

  it("renders the clean name and status chip in the legacy card layout", () => {
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
    expect(text).toContain("Single Cask");
    expect(text).not.toContain("2025 Release");
    expect(text).not.toContain("55.1% ABV");
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
