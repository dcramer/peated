import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BottleIdentity, {
  type BottleIdentitySource,
  getAbsoluteBottleTitle,
  getMetadataExpressedByTitle,
  getRelativeBottleIdentity,
} from "./bottleIdentity";

function makeBottle(
  overrides: Partial<BottleIdentitySource> = {},
): BottleIdentitySource {
  return {
    id: 42,
    fullName: "Springbank 12 Cask Strength Batch 24",
    name: "12-year-old Cask Strength Batch 24",
    group: {
      name: "12-year-old Cask Strength",
      statedAge: 12,
    },
    brand: { id: 1, name: "Springbank", shortName: null },
    series: null,
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
  };
}

function makeBrand(id: number, name: string): BottleIdentitySource["brand"] {
  return { id, name, shortName: null };
}

function makeSeries(
  id: number,
  name: string,
): NonNullable<BottleIdentitySource["series"]> {
  return { id, name };
}

describe("BottleIdentity", () => {
  it("renders family-relative edition identity with exact metadata", () => {
    const html = renderToStaticMarkup(
      <BottleIdentity bottle={makeBottle()} mode="relative" current />,
    );

    expect(html).toContain("Batch 24");
    expect(html).toContain("57.2% ABV");
    expect(html).not.toContain(">12 years<");
    expect(html).not.toContain("2023 release");
    expect(html).not.toContain(">Cask strength</span>");
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

  it("keeps exact metadata in canonical order for grouped and ungrouped bottles", () => {
    const bottle = makeBottle({
      edition: null,
      vintageYear: null,
      releaseYear: 2023,
    });
    const groupedText = renderToStaticMarkup(
      <BottleIdentity bottle={bottle} mode="absolute" />,
    ).replace(/<[^>]*>/g, "");
    const ungroupedText = renderToStaticMarkup(
      <BottleIdentity
        bottle={{ ...bottle, group: undefined }}
        mode="absolute"
      />,
    ).replace(/<[^>]*>/g, "");

    expect(groupedText).toContain("57.2% ABV·2023 release");
    expect(ungroupedText).toContain("57.2% ABV·2023 release");
  });

  it("shows a nonduplicative series with producer context", () => {
    const html = renderToStaticMarkup(
      <BottleIdentity
        bottle={makeBottle({
          brand: makeBrand(2, "Woodford Reserve"),
          series: makeSeries(3, "Master's Collection"),
          group: {
            ...makeBottle().group!,
            name: "Batch Proof",
          },
          edition: null,
        })}
      />,
    );

    expect(html).toContain("Woodford Reserve");
    expect(html).toContain("Master&#x27;s Collection");
    expect(html).toContain('href="/bottles?series=3"');
    expect(html).toContain("Batch Proof");
  });

  it("keeps series context when the surrounding view supplies the Brand", () => {
    const html = renderToStaticMarkup(
      <BottleIdentity
        bottle={makeBottle({
          brand: makeBrand(2, "Woodford Reserve"),
          series: makeSeries(3, "Master's Collection"),
          group: {
            ...makeBottle().group!,
            name: "Batch Proof",
          },
          edition: null,
        })}
        showBrand={false}
      />,
    );

    expect(html).not.toContain("Woodford Reserve");
    expect(html).toContain("Master&#x27;s Collection");
    expect(html).toContain('href="/bottles?series=3"');
    expect(html).toContain("Batch Proof");
  });

  it("does not repeat a historical Series that equals the Brand", () => {
    const html = renderToStaticMarkup(
      <BottleIdentity
        bottle={makeBottle({
          brand: makeBrand(2, "Whiskyland"),
          series: makeSeries(3, "Whiskyland"),
          group: {
            ...makeBottle().group!,
            name: "Pittyvaich",
          },
          edition: "Chapter Thirty",
        })}
        showBrand={false}
      />,
    );

    expect(html).not.toContain('href="/bottles?series=3"');
    expect(html).toContain("Pittyvaich");
    expect(html).toContain("Chapter Thirty");
  });

  it("does not use exact age as a subtitle when the family title includes it", () => {
    const html = renderToStaticMarkup(
      <BottleIdentity
        bottle={makeBottle({
          group: {
            ...makeBottle().group!,
            name: "Single Cask 4-year-old",
            statedAge: null,
          },
          edition: null,
          statedAge: 4,
          singleCask: true,
        })}
        mode="absolute"
      />,
    );

    expect(html).toContain("Single Cask 4-year-old");
    expect(html).not.toContain(">4 years<");
    expect(html).not.toContain(">Single cask<");
  });

  it.each(["No Age Statement", "NAS"])(
    "does not repeat %s when it is already in the title",
    (name) => {
      const bottle = makeBottle({
        name,
        fullName: `Springbank ${name}`,
        group: { name, statedAge: null },
        edition: null,
        statedAge: null,
        noAgeStatement: true,
      });
      const html = renderToStaticMarkup(<BottleIdentity bottle={bottle} />);
      const text = html.replace(/<[^>]*>/g, "");

      expect(getMetadataExpressedByTitle(bottle, name)).toContain("age");
      expect(text.match(/No age statement/gi) ?? []).toHaveLength(
        name === "No Age Statement" ? 1 : 0,
      );
      expect(text.match(/NAS/g) ?? []).toHaveLength(name === "NAS" ? 1 : 0);
    },
  );

  it("moves canonical metadata out of ungrouped Library headlines", () => {
    const bottle = makeBottle({
      name: "Whiskyland - Chapter Thirty Three - 52-year-old - 2026 Release - 1973 Vintage - 53.2% ABV",
      fullName:
        "Decadent Drinks Whiskyland - Chapter Thirty Three - 52-year-old - 2026 Release - 1973 Vintage - 53.2% ABV",
      group: undefined,
      edition: "Chapter Thirty Three",
      statedAge: 52,
      releaseYear: 2026,
      vintageYear: 1973,
      abv: 53.2,
      caskStrength: false,
    });
    const html = renderToStaticMarkup(
      <BottleIdentity bottle={bottle} mode="absolute" />,
    );

    expect(getAbsoluteBottleTitle(bottle)).toBe(
      "Whiskyland - Chapter Thirty Three",
    );
    expect(html).toContain(">Whiskyland - Chapter Thirty Three</a>");
    expect(html).toContain(">52 years</span>");
    expect(html).not.toContain(">2026 release</span>");
    expect(html).not.toContain(">1973 vintage</span>");
    expect(html).toContain(">53.2% ABV</span>");
  });

  it("strips canonical cask traits while preserving the product and edition", () => {
    expect(
      getAbsoluteBottleTitle(
        makeBottle({
          name: "Glenrothes - Individual Cask Release - 23-year-old - 2021 Release - 1997 Vintage - Single Cask - Cask Strength",
          group: undefined,
          edition: "Individual Cask Release",
          statedAge: 23,
          releaseYear: 2021,
          vintageYear: 1997,
          abv: null,
          singleCask: true,
          caskStrength: true,
        }),
      ),
    ).toBe("Glenrothes - Individual Cask Release");
  });

  it("keeps cask details when a title only expresses part of the cask", () => {
    const bottle = makeBottle({
      caskFill: "1st_fill",
      caskType: "bourbon",
      caskSize: "hogshead",
    });

    expect(getMetadataExpressedByTitle(bottle, "Bourbon Cask")).not.toContain(
      "cask-details",
    );
    expect(
      getMetadataExpressedByTitle(bottle, "1st Fill Bourbon Hogshead Cask"),
    ).toContain("cask-details");
  });

  it("keeps metadata-only names as the absolute headline", () => {
    const bottle = makeBottle({
      name: "21-year-old",
      group: undefined,
      edition: null,
      statedAge: 21,
      releaseYear: null,
      abv: null,
      caskStrength: false,
    });
    const html = renderToStaticMarkup(
      <BottleIdentity bottle={bottle} mode="absolute" />,
    );

    expect(getAbsoluteBottleTitle(bottle)).toBe("21-year-old");
    expect(html).toContain(">21-year-old</a>");
    expect(html).not.toContain(">21 years</span>");
  });

  it("uses meaningful release branches before falling back to the name", () => {
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
          abv: null,
        }),
      ).label,
    ).toBe("12-year-old Cask Strength Batch 24");
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
