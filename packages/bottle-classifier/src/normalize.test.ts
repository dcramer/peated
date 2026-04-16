import { describe, expect, test } from "vitest";

import {
  normalizeBottle,
  normalizeBottleAge,
  normalizeBottleBatchNumber,
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
      normalizeBottleBatchNumber("Four Roses Limited Edition Small Batch 2017"),
    ).toBe("Four Roses Limited Edition Small Batch 2017");
  });

  test("normalizes age expressions into bottle identity", () => {
    expect(
      normalizeBottle({
        name: "Delicious twelve Year thing",
      }),
    ).toMatchObject({
      name: "Delicious 12-year-old thing",
      statedAge: 12,
    });
  });

  test("normalizes coded batch wording but leaves generic batch names alone", () => {
    expect(
      normalizeBottle({
        name: "Traigh Bhan 19-year-old Scotch Batch No. 5",
      }),
    ).toMatchObject({
      name: "Traigh Bhan 19-year-old Scotch (Batch 5)",
      statedAge: 19,
    });

    expect(
      normalizeBottle({
        name: "Batch Proof",
      }),
    ).toMatchObject({
      name: "Batch Proof",
      statedAge: null,
    });
  });

  test("extracts release traits without dropping stable bottle identity", () => {
    expect(
      normalizeBottle({
        name: "Octomore 15.1 2025 Release Cask Strength",
      }),
    ).toMatchObject({
      name: "Octomore 15.1 Cask Strength",
      releaseYear: 2025,
      caskStrength: true,
    });
  });

  test("strips duplicate brand prefixes case-insensitively", () => {
    expect(
      stripDuplicateBrandPrefixFromBottleName(
        "Ardbeg Traigh Bhan 19-year-old",
        "ardbeg",
      ),
    ).toBe("Traigh Bhan 19-year-old");
  });

  test("normalizes simple metadata helpers", () => {
    expect(normalizeString("Maker’s Mark™")).toBe("Maker's Mark");
    expect(normalizeCategory("Single Malt Scotch Whisky")).toBe("single_malt");
    expect(normalizeEntityName("Maker's Mark Distillery")).toBe(
      "Maker's Mark Distillery",
    );
    expect(normalizeVolume("1.75L")).toBe(1750);
    expect(normalizeVolume("750ml")).toBe(750);
    expect(normalizeVolume("1.75")).toBeNull();
  });
});
