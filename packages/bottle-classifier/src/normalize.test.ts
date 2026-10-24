import { describe, expect, test } from "vitest";

import {
  bottleNameDuplicatesBrand,
  normalizeBottleAge,
  normalizeBottleBatchNumber,
  normalizeBottleInput,
  normalizeBottleReferenceKey,
  normalizeCategory,
  normalizeEntityName,
  normalizeString,
  normalizeVolume,
  stripDuplicateBrandPrefixFromBottleName,
} from "./normalize";

describe("normalize", () => {
  test("normalizes standalone age and batch helper expressions", () => {
    expect(
      normalizeBottleAge({
        name: "Springbank 12 yo",
      }),
    ).toEqual({
      name: "Springbank 12-year-old",
      statedAge: 12,
    });

    expect(
      normalizeBottleBatchNumber("Elijah Craig Barrel Proof Batch C923"),
    ).toBe("Elijah Craig Barrel Proof (Batch C923)");
    expect(normalizeBottleBatchNumber("Elijah Craig Small Batch")).toBe(
      "Elijah Craig Small Batch",
    );
    expect(
      normalizeBottleBatchNumber("Example Limited Edition Small Batch 2017"),
    ).toBe("Example Limited Edition Small Batch 2017");
  });

  test("normalizes age expressions into bottle identity", () => {
    expect(
      normalizeBottleInput({
        name: "Delicious twelve Year thing",
      }),
    ).toMatchObject({
      name: "Delicious 12-year-old thing",
      statedAge: 12,
    });
  });

  test("does not rewrite bare numeric expressions into age statements", () => {
    expect(
      normalizeBottleAge({
        name: "The Last Drop 42",
        statedAge: 42,
      }),
    ).toEqual({
      name: "The Last Drop 42",
      statedAge: 42,
    });

    expect(
      normalizeBottleInput({
        name: "42",
        statedAge: 42,
      }),
    ).toMatchObject({
      name: "42",
      statedAge: 42,
    });
  });

  test("normalizes coded batch wording but leaves generic batch names alone", () => {
    expect(
      normalizeBottleInput({
        name: "Traigh Bhan 19-year-old Scotch Batch No. 5",
      }),
    ).toMatchObject({
      name: "Traigh Bhan 19-year-old Scotch (Batch 5)",
      statedAge: 19,
    });

    expect(
      normalizeBottleInput({
        name: "Batch Proof",
      }),
    ).toMatchObject({
      name: "Batch Proof",
      statedAge: null,
    });
  });

  test("extracts release traits without dropping stable bottle identity", () => {
    expect(
      normalizeBottleInput({
        name: "Octomore 15.1 2025 Release Cask Strength",
      }),
    ).toMatchObject({
      name: "Octomore 15.1 Cask Strength",
      releaseYear: 2025,
      caskStrength: true,
    });
  });

  test("builds alias keys without dropping identity-bearing tokens", () => {
    expect(normalizeBottleReferenceKey("Ardbeg   10 years old")).toBe(
      "Ardbeg 10-year-old",
    );
    expect(normalizeBottleReferenceKey("The Last Drop 42")).toBe(
      "The Last Drop 42",
    );
    expect(
      normalizeBottleReferenceKey("Lagavulin Distillers Edition 2011 Release"),
    ).toBe("Lagavulin Distillers Edition 2011 Release");
    expect(
      normalizeBottleReferenceKey("Springbank 12 Cask Strength Batch No. 24"),
    ).toBe("Springbank 12 Cask Strength Batch No. 24");
    expect(
      normalizeBottleReferenceKey(
        "Four Roses Single Barrel Barrel Strength OESK Store Pick",
      ),
    ).toBe("Four Roses Single Barrel Barrel Strength OESK Store Pick");
  });

  test("strips duplicate brand prefixes case-insensitively", () => {
    expect(
      stripDuplicateBrandPrefixFromBottleName(
        "Ardbeg Traigh Bhan 19-year-old",
        "ardbeg",
      ),
    ).toBe("Traigh Bhan 19-year-old");
  });

  test("detects a bottle expression that only repeats its brand", () => {
    expect(
      bottleNameDuplicatesBrand("  Example   Brand ", "example brand"),
    ).toBe(true);
    expect(bottleNameDuplicatesBrand("8-year-old", "Example Brand")).toBe(
      false,
    );
  });

  test("normalizes simple metadata helpers", () => {
    expect(normalizeString("Maker’s Mark™")).toBe("Maker's Mark");
    expect(normalizeCategory("Single Malt Scotch Whisky")).toBe("single_malt");
    expect(normalizeCategory("Redbreast Single Pot Still Irish Whiskey")).toBe(
      "single_pot_still",
    );
    expect(normalizeCategory("Compass Box Blended Malt Scotch Whisky")).toBe(
      "blended_malt",
    );
    expect(normalizeCategory("Blended Grain Scotch Whisky")).toBe(
      "blended_grain",
    );
    expect(normalizeCategory("Blended Straight Rye Whiskeys")).toBe("rye");
    expect(normalizeCategory("Blended Corn Whiskey")).toBe("corn");
    expect(normalizeCategory("Blended Wheat Whiskey")).toBe("wheat");
    expect(normalizeCategory("American Corn Whiskey")).toBe("corn");
    expect(normalizeCategory("Malt Whisky")).toBeNull();
    expect(normalizeCategory("Spirit")).toBeNull();
    expect(normalizeEntityName("Maker's Mark Distillery")).toBe(
      "Maker's Mark Distillery",
    );
    expect(normalizeVolume("1.75L")).toBe(1750);
    expect(normalizeVolume("750ml")).toBe(750);
    expect(normalizeVolume("1.75")).toBeNull();
  });
});

describe("normalizeBottleInput", () => {
  test("just the age", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "10",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10"`);
    expect(statedAge).toBe(10);
  });

  test("age suffix", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious 10",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 10"`);
    expect(statedAge).toBe(10);
  });

  test("age suffix not age", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious 10",
      statedAge: null,
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 10"`);
    expect(statedAge).toBeNull();
  });

  test("age prefix", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "10 Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10 Wood"`);
    expect(statedAge).toBe(10);
  });

  test("age prefix not age", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "10 Wood",
      statedAge: null,
    });
    expect(name).toMatchInlineSnapshot(`"10 Wood"`);
    expect(statedAge).toBeNull();
  });

  test("casing", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "10-YEAR-OLD Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("plural to singular", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "10-years-old Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("spacing", async () => {
    let { name, statedAge } = normalizeBottleInput({
      name: "10 years old Wood",
      statedAge: 10,
    });
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);

    ({ name, statedAge } = normalizeBottleInput({
      name: "10 year old Wood",
      statedAge: 10,
    }));
    expect(name).toMatchInlineSnapshot(`"10-year-old Wood"`);
    expect(statedAge).toBe(10);
  });

  test("12", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "10",
    });
    expect(name).toMatchInlineSnapshot(`"10"`);
    expect(statedAge).toBeNull();
  });

  test("Name 12yr", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious 12yr",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12yr.", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious 12yr.",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12YO", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious 12YO",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12yrs", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious 12yrs",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12 year", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious 12 year",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old"`);
    expect(statedAge).toBe(12);
  });

  test("Name 12 year thing", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious 12 Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old thing"`);
    expect(statedAge).toBe(12);
  });

  test("Name twelve year thing", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious twelve Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 12-year-old thing"`);
    expect(statedAge).toBe(12);
  });

  test("Name ten year thing", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious ten Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 10-year-old thing"`);
    expect(statedAge).toBe(10);
  });

  test("Name fifteen year thing", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Delicious fifteen Year thing",
    });
    expect(name).toMatchInlineSnapshot(`"Delicious 15-year-old thing"`);
    expect(statedAge).toBe(15);
  });

  test("Cask No. 1.285 Hello World", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Cask No. 1.285 Hello World",
    });
    expect(name).toMatchInlineSnapshot(`"Cask No. 1.285 Hello World"`);
    expect(statedAge).toBeNull();
  });

  test("Hello World Cask No. 1.285", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Hello World Cask No. 1.285",
    });
    expect(name).toMatchInlineSnapshot(`"Hello World Cask No. 1.285"`);
    expect(statedAge).toBeNull();
  });

  test("Traigh Bhan 19-year-old Scotch Batch No. 5", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Traigh Bhan 19-year-old Scotch Batch No. 5",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch (Batch No. 5)", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Traigh Bhan 19-year-old Scotch (Batch No. 5)",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch #5", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Traigh Bhan 19-year-old Scotch Batch #5",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch 5", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Traigh Bhan 19-year-old Scotch Batch 5",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch 5)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch Batch A", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Traigh Bhan 19-year-old Scotch Batch A",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch A)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Traigh Bhan 19-year-old Scotch, Batch A", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Traigh Bhan 19-year-old Scotch, Batch A",
    });
    expect(name).toMatchInlineSnapshot(
      `"Traigh Bhan 19-year-old Scotch (Batch A)"`,
    );
    expect(statedAge).toEqual(19);
  });

  test("Batch A", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Batch A",
    });
    expect(name).toMatchInlineSnapshot(`"Batch A"`);
    expect(statedAge).toBeNull();
  });

  test("Booker's Springfield Batch Kentucky Straight Bourbon Whiskey", async () => {
    const rv = normalizeBottleInput({
      name: "Booker's Springfield Batch Kentucky Straight Bourbon Whiskey",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Booker's Springfield Batch Kentucky Straight Bourbon Whiskey",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test("Small Batch Bourbon", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Small Batch Bourbon",
    });
    expect(name).toMatchInlineSnapshot(`"Small Batch Bourbon"`);
    expect(statedAge).toBeNull();
  });

  test("Redbreast Small Batch Cask Strength (Batch A)", async () => {
    const rv = normalizeBottleInput({
      name: "Redbreast Small Batch Cask Strength (Batch A)",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": true,
        "name": "Redbreast Small Batch Cask Strength (Batch A)",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test("Old Synergies #12", async () => {
    const { name, statedAge } = normalizeBottleInput({
      name: "Old Synergies #12",
    });
    expect(name).toMatchInlineSnapshot(`"Old Synergies #12"`);
    expect(statedAge).toBeNull();
  });

  test("1993 Vintage", async () => {
    const rv = normalizeBottleInput({
      name: "1993 Vintage",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "1993 Vintage",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": 1993,
      }
    `);
  });

  test("1993 Release", async () => {
    const rv = normalizeBottleInput({
      name: "1993 Release",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "1993 Release",
        "releaseYear": 1993,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test("Invalid Vintage", async () => {
    const rv = normalizeBottleInput({
      name: "Invalid Vintage",
      statedAge: 23,
      vintageYear: 2013,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Invalid Vintage",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": 23,
        "vintageYear": null,
      }
    `);
  });

  test("Invalid Release due to Vintage", async () => {
    const rv = normalizeBottleInput({
      name: "Invalid Release",
      vintageYear: 2013,
      releaseYear: 2013,
      statedAge: 10,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Invalid Release",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": 10,
        "vintageYear": 2013,
      }
    `);
  });

  test("Invalid Release and Vintage", async () => {
    const rv = normalizeBottleInput({
      name: "Invalid Release",
      vintageYear: 2013,
      releaseYear: 2013,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Invalid Release",
        "releaseYear": 2013,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test("synergies (1993 Vintage) (2012 Release)", async () => {
    const rv = normalizeBottleInput({
      name: "synergies (1993 Vintage) (2012 Release)",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "synergies (1993 Vintage)",
        "releaseYear": 2012,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": 1993,
      }
    `);
  });

  test("13-year-old Bottled in Bond (Batch VVS 2024)", async () => {
    const rv = normalizeBottleInput({
      name: "13-year-old Bottled in Bond (Batch VVS 2024)",
      releaseYear: 2024,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "13-year-old Bottled in Bond (Batch VVS 2024)",
        "releaseYear": 2024,
        "singleCask": null,
        "statedAge": 13,
        "vintageYear": null,
      }
    `);
  });

  test("(distilled at Inchgower), 26-year-old old, 1976 vintage", async () => {
    const rv = normalizeBottleInput({
      name: "(distilled at Inchgower), 26-year-old old, 1976 vintage",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "26-year-old old, 1976 vintage (distilled at Inchgower)",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": 26,
        "vintageYear": 1976,
      }
    `);
  });

  test("(Distilled at Ardbeg) 1990, 8-year-old", async () => {
    const rv = normalizeBottleInput({
      name: "(Distilled at Ardbeg) 1990, 8-year-old",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "1990, 8-year-old (Distilled at Ardbeg)",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": 8,
        "vintageYear": null,
      }
    `);
  });

  test("Kentucky Owl® Batch #12 Kentucky Straight Bourbon Whiskey", async () => {
    const rv = normalizeBottleInput({
      name: "Kentucky Owl® Batch #12 Kentucky Straight Bourbon Whiskey",
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Kentucky Owl Kentucky Straight Bourbon Whiskey (Batch 12)",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test('Whiskey JYPSI ™ Legacy Batch 001, "The Journey"', async () => {
    const rv = normalizeBottleInput({
      name: 'Whiskey JYPSI ™ Legacy Batch 001, "The Journey"',
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Whiskey JYPSI Legacy "The Journey" (Batch 001)",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  describe("isFullName = false", () => {
    test("Black Art 1992 Edition 9.1 29-year-old Single Malt", async () => {
      const { name, statedAge } = normalizeBottleInput({
        name: "Black Art 1992 Edition 9.1 29-year-old Single Malt",
        isFullName: false,
      });
      expect(name).toMatchInlineSnapshot(
        `"Black Art 1992 Edition 9.1 29-year-old Single Malt"`,
      );
      expect(statedAge).toEqual(29);
    });

    test("Wolves Spring Run, Batch 2", async () => {
      const rv = normalizeBottleInput({
        name: "Spring Run, Batch 2",
        isFullName: false,
      });
      expect(rv).toMatchInlineSnapshot(`
        {
          "caskStrength": null,
          "name": "Spring Run (Batch 2)",
          "releaseYear": null,
          "singleCask": null,
          "statedAge": null,
          "vintageYear": null,
        }
      `);
    });

    test("Cask No. 1.285 Hello World", async () => {
      const { name, statedAge } = normalizeBottleInput({
        name: "Cask No. 1.285 Hello World",
        isFullName: false,
      });
      expect(name).toMatchInlineSnapshot(`"1.285 Hello World"`);
      expect(statedAge).toBeNull();
    });

    test("Batch #1, 10-year-old", async () => {
      const { name, statedAge } = normalizeBottleInput({
        name: "Batch #1, 10-year-old",
        isFullName: false,
      });
      expect(name).toMatchInlineSnapshot(`"10-year-old (Batch 1)"`);
      expect(statedAge).toEqual(10);
    });
  });

  test("Single Cask Rye Batch A", async () => {
    const rv = normalizeBottleInput({
      name: "Single Cask Rye Batch A",
      isFullName: false,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": null,
        "name": "Single Cask Rye (Batch A)",
        "releaseYear": null,
        "singleCask": true,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });

  test("Barrel Strength Bourbon", async () => {
    const rv = normalizeBottleInput({
      name: "Barrel Strength Bourbon",
      isFullName: false,
    });
    expect(rv).toMatchInlineSnapshot(`
      {
        "caskStrength": true,
        "name": "Barrel Strength Bourbon",
        "releaseYear": null,
        "singleCask": null,
        "statedAge": null,
        "vintageYear": null,
      }
    `);
  });
});

describe("stripDuplicateBrandPrefixFromBottleName", () => {
  test("strips a duplicate brand prefix case-insensitively", () => {
    expect(
      stripDuplicateBrandPrefixFromBottleName(
        "Maker's Mark 46",
        "MAKER'S MARK",
      ),
    ).toBe("46");
  });
});

describe("normalizeVolume", () => {
  test("750ml", async () => {
    const rv = normalizeVolume("750ml");
    expect(rv).toBe(750);
  });
  test("1.75L", async () => {
    const rv = normalizeVolume("1.75L");
    expect(rv).toBe(1750);
  });
  test("50 mL", async () => {
    const rv = normalizeVolume("50 mL");
    expect(rv).toBe(50);
  });
  test("invalid", async () => {
    const rv = normalizeVolume("1.75");
    expect(rv).toBe(null);
  });
});
