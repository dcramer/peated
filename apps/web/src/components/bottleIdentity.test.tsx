import type { Bottle } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BottleIdentity, { getRelativeBottleIdentity } from "./bottleIdentity";

function makeBottle(overrides: Partial<Bottle> = {}): Bottle {
  return {
    id: 42,
    fullName: "Springbank 12 Cask Strength Batch 24",
    name: "12-year-old Cask Strength Batch 24",
    group: {
      id: 7,
      name: "12-year-old Cask Strength",
      fullName: "Springbank 12 Cask Strength",
      statedAge: 12,
    },
    brand: { id: 1, name: "Springbank" },
    edition: "Batch 24",
    category: "single_malt",
    statedAge: 12,
    abv: 57.2,
    vintageYear: null,
    releaseYear: 2023,
    singleCask: false,
    caskStrength: true,
    caskFill: null,
    caskType: null,
    caskSize: null,
    ...overrides,
  } as Bottle;
}

describe("BottleIdentity", () => {
  it("renders family-relative edition identity with exact metadata", () => {
    const html = renderToStaticMarkup(
      <BottleIdentity bottle={makeBottle()} mode="relative" current />,
    );

    expect(html).toContain("Batch 24");
    expect(html).toContain("57.2% ABV");
    expect(html).toContain("2023 release");
    expect(html).toContain("Cask strength");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('title="Currently viewing"');
    expect(html).toContain("bg-orange-400");
    expect(html).not.toContain(">Viewing<");
    expect(html).not.toContain("Single Malt");
  });

  it("does not repeat exact metadata already expressed by an edition", () => {
    const html = renderToStaticMarkup(
      <BottleIdentity
        bottle={makeBottle({
          edition: "2023 Release",
          releaseYear: 2023,
        })}
        mode="relative"
      />,
    );

    expect(html.match(/>2023 release</gi)).toHaveLength(1);
  });

  it("structures an absolute Library identity from brand and group", () => {
    const html = renderToStaticMarkup(
      <BottleIdentity bottle={makeBottle()} mode="absolute" />,
    );

    expect(html).toContain("Springbank");
    expect(html).toContain("uppercase");
    expect(html).toContain("12-year-old Cask Strength");
    expect(html).toContain("Batch 24");
    expect(html).not.toContain(">12 years<");
    expect(html).not.toContain(">Cask strength</span>");
    expect(html).toContain('title="Springbank 12 Cask Strength Batch 24"');
  });

  it("uses every modeled exact branch before falling back to the name", () => {
    expect(
      getRelativeBottleIdentity(
        makeBottle({ edition: null, vintageYear: 1998 }),
      ).label,
    ).toBe("1998 vintage");
    expect(
      getRelativeBottleIdentity(
        makeBottle({
          edition: null,
          vintageYear: null,
          releaseYear: 2024,
        }),
      ).label,
    ).toBe("2024 release");
    expect(
      getRelativeBottleIdentity(
        makeBottle({
          edition: null,
          vintageYear: null,
          releaseYear: null,
          statedAge: 18,
        }),
      ).label,
    ).toBe("18 years");
    expect(
      getRelativeBottleIdentity(
        makeBottle({
          edition: null,
          vintageYear: null,
          releaseYear: null,
          statedAge: 12,
          singleCask: true,
        }),
      ).label,
    ).toBe("Single cask");
    expect(
      getRelativeBottleIdentity(
        makeBottle({
          edition: null,
          vintageYear: null,
          releaseYear: null,
          statedAge: 12,
          caskStrength: false,
          abv: 46,
        }),
      ).label,
    ).toBe("46.0% ABV");
    expect(
      getRelativeBottleIdentity(
        makeBottle({
          edition: null,
          vintageYear: null,
          releaseYear: null,
          statedAge: 12,
          caskStrength: false,
          abv: null,
        }),
      ).label,
    ).toBe("12-year-old Cask Strength Batch 24");
  });
});
