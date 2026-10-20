import { describe, expect, it } from "vitest";
import {
  findJsonSubsetDifferences,
  formatJsonSubsetDifference,
} from "./evalExpectationDifferences";

describe("findJsonSubsetDifferences", () => {
  it("compares exact cask identifiers independently of an optional number sign", () => {
    expect(
      findJsonSubsetDifferences(
        { caskNumber: "#AB-12" },
        { caskNumber: "AB-12" },
        "proposedBottle",
      ),
    ).toEqual([]);
    expect(
      findJsonSubsetDifferences(
        { caskNumber: "#AB-13" },
        { caskNumber: "AB-12" },
        "proposedBottle",
      ),
    ).toHaveLength(1);
    expect(
      findJsonSubsetDifferences(
        { caskNumber: "AB12" },
        { caskNumber: "AB-12" },
        "proposedBottle",
      ),
    ).toHaveLength(1);
  });
  it("accepts matching subsets and ignores extra actual fields", () => {
    expect(
      findJsonSubsetDifferences(
        { brand: { id: 1169, name: "Mars" }, extra: true },
        { brand: { id: 1169 } },
        "proposedBottle",
      ),
    ).toEqual([]);
  });

  it("reports nested differing and missing fields", () => {
    const differences = findJsonSubsetDifferences(
      {
        brand: { name: "Mars" },
        distillers: [{ id: 238555, name: "Shinshu" }],
      },
      {
        brand: { id: 1169, name: "Mars" },
        distillers: [{ id: 1953 }],
      },
      "proposedBottle",
    );

    expect(differences.map(formatJsonSubsetDifference)).toEqual([
      "proposedBottle.brand.id expected 1169 but was missing",
      "proposedBottle.distillers[0].id expected 1953 but got 238555",
    ]);
  });

  it("reports every expected leaf when the actual value is missing", () => {
    const differences = findJsonSubsetDifferences(
      undefined,
      { brand: { name: "Elijah Craig" }, statedAge: 18 },
      "proposedBottle",
    );

    expect(differences.map(formatJsonSubsetDifference)).toEqual([
      'proposedBottle.brand.name expected "Elijah Craig" but was missing',
      "proposedBottle.statedAge expected 18 but was missing",
    ]);
  });

  it("keeps null distinct from a missing value", () => {
    expect(findJsonSubsetDifferences(null, null, "proposedBottle")).toEqual([]);
    expect(
      findJsonSubsetDifferences(
        { releaseYear: null },
        { releaseYear: null },
        "proposedBottle",
      ),
    ).toEqual([]);
    expect(
      findJsonSubsetDifferences(
        {},
        { releaseYear: null },
        "proposedBottle",
      ).map(formatJsonSubsetDifference),
    ).toEqual(["proposedBottle.releaseYear expected null but was missing"]);
  });
});
