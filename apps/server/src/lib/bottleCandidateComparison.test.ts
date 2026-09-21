import { compareBottleCandidate } from "./bottleCandidateComparison";
import {
  rankBottleCreateCandidates,
  type BottleCreateCandidate,
} from "./bottleCreateCandidates";

const brand = { id: 1, name: "Independent Bottler" };
const candidate: BottleCreateCandidate = {
  id: 1,
  name: "Highland Release",
  fullName: "Independent Bottler Highland Release",
  brand,
  distillers: [],
  caskNumber: "53.322",
  abv: 49.6,
  vintageYear: 1990,
};

describe("Bottle candidate evidence", () => {
  test.each([
    ["caskNumber", "53.323"],
    ["caskNumber", "53322"],
    ["abv", 49.7],
    ["vintageYear", 1991],
  ] as const)("keeps neighboring %s values distinct (%s)", (field, value) => {
    expect(
      compareBottleCandidate(
        { name: candidate.name, [field]: value },
        candidate,
      ).conflicts,
    ).toEqual([field]);
  });

  test("unknown facts are missing evidence, not contradictions", () => {
    const result = compareBottleCandidate(
      { name: candidate.name, releaseYear: 2024, abv: 49.6 },
      candidate,
    );
    expect(result).toEqual({
      agreements: ["abv"],
      missing: ["releaseYear"],
      conflicts: [],
    });
  });

  test("stored relationship IDs take precedence over matching names", () => {
    expect(
      compareBottleCandidate(
        { name: candidate.name, brand: { ...brand, id: 2 } },
        candidate,
      ).conflicts,
    ).toEqual(["brand"]);
  });

  test("does not mistake bottle count or maturation wording for identity", () => {
    expect(
      compareBottleCandidate(
        { name: candidate.name, outturn: 250, maturation: "Sherry oak" },
        { ...candidate, outturn: 260, maturation: "Bourbon oak" },
      ).conflicts,
    ).toEqual([]);
  });

  test("ranks exact release evidence before stronger text similarity", () => {
    const results = rankBottleCreateCandidates(
      { name: candidate.name, caskNumber: "53.322", abv: 49.6 },
      [
        { ...candidate, id: 2, caskNumber: "53.323", textRelevance: 1 },
        { ...candidate, id: 3, caskNumber: null, textRelevance: 0.9 },
        { ...candidate, id: 4, textRelevance: 0.1 },
      ],
      3,
    );
    expect(results.map((b) => b.id)).toEqual([4, 3, 2]);
  });
});
