import {
  compareBottleCandidate,
  orderBottleCandidateComparisons,
} from "./bottleCandidateComparison";
import {
  rankBottleCreateCandidates,
  type BottleCreateCandidate,
  type BottleCreateCandidateInput,
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

  test("uses the matching rule for edition wording and a printed #", () => {
    expect(
      compareBottleCandidate(
        { name: candidate.name, edition: "2017 Release", caskNumber: "#3771" },
        { ...candidate, edition: "2017 Edition", caskNumber: "3771" },
      ),
    ).toEqual({
      agreements: ["edition", "caskNumber"],
      missing: [],
      conflicts: [],
    });
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

describe("Bottle candidate order", () => {
  const rosebank = { id: 10, name: "Rosebank" };
  const ardbeg = { id: 11, name: "Ardbeg" };
  const yamazaki = { id: 12, name: "Yamazaki" };

  function order(
    input: BottleCreateCandidateInput,
    candidates: BottleCreateCandidate[],
  ) {
    return candidates
      .map((bottle) => ({
        id: bottle.id,
        comparison: compareBottleCandidate(input, bottle),
      }))
      .sort((left, right) =>
        orderBottleCandidateComparisons(left.comparison, right.comparison),
      )
      .map(({ id }) => id);
  }

  // A label photo read as Whyte & Whyte, Rosebank, 18 years, 1974 once listed
  // an Ardbeg and four blends with the same age before any Rosebank.
  test("puts the label's distillery before other producers with the same age and vintage", () => {
    const label: BottleCreateCandidateInput = {
      name: "",
      brand: { name: "Whyte & Whyte" },
      distillers: [{ name: "Rosebank" }],
      category: "single_malt",
      statedAge: 18,
      vintageYear: 1974,
    };
    const otherDistillery: BottleCreateCandidate = {
      id: 1,
      name: "Ardbeg 1974 18-year-old",
      fullName: "Cadenhead's Ardbeg 1974 18-year-old",
      brand: { id: 20, name: "Cadenhead's" },
      distillers: [ardbeg],
      category: "single_malt",
      statedAge: 18,
      vintageYear: 1974,
    };
    const unrelatedBlend: BottleCreateCandidate = {
      id: 2,
      name: "18-year-old",
      fullName: "Deerstalker 18-year-old",
      brand: { id: 21, name: "Deerstalker" },
      distillers: [],
      statedAge: 18,
    };
    const otherRelease: BottleCreateCandidate = {
      id: 3,
      name: "21-year-old",
      fullName: "Rosebank 21-year-old",
      brand: rosebank,
      distillers: [rosebank],
      category: "single_malt",
      statedAge: 21,
      vintageYear: 1991,
    };
    const sameRelease: BottleCreateCandidate = {
      id: 4,
      name: "Rosebank 1974",
      fullName: "Old Malt Cask Rosebank 1974",
      brand: { id: 22, name: "Old Malt Cask" },
      distillers: [rosebank],
      statedAge: 18,
      vintageYear: 1974,
    };

    expect(
      order(label, [
        otherDistillery,
        unrelatedBlend,
        otherRelease,
        sameRelease,
      ]),
    ).toEqual([4, 3, 2, 1]);
  });

  test("a wrong Brand does not hide a Bottle from the entered distillery", () => {
    const input: BottleCreateCandidateInput = {
      name: "12-year-old",
      brand: { id: 30, name: "Suntory" },
      distillers: [yamazaki],
      statedAge: 12,
    };
    const yamazakiRelease: BottleCreateCandidate = {
      id: 5,
      name: "18-year-old",
      fullName: "Yamazaki 18-year-old",
      brand: yamazaki,
      distillers: [yamazaki],
      statedAge: 18,
    };
    const unrelatedBlend: BottleCreateCandidate = {
      id: 6,
      name: "12-year-old",
      fullName: "Hibiki 12-year-old",
      brand: { id: 31, name: "Hibiki" },
      distillers: [],
      statedAge: 12,
    };

    expect(order(input, [unrelatedBlend, yamazakiRelease])).toEqual([5, 6]);
  });
});
