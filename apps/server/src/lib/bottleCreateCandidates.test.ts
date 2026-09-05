import {
  buildBottleCreateCandidateQueries,
  rankBottleCreateCandidates,
  type BottleCreateCandidate,
  type BottleCreateCandidateInput,
} from "./bottleCreateCandidates";

const yamazaki = { id: 2, name: "Yamazaki" };

function candidate(
  overrides: Partial<BottleCreateCandidate> = {},
): BottleCreateCandidate {
  return {
    id: 1,
    fullName: "Yamazaki Peated Malt Spanish Oak",
    name: "Peated Malt Spanish Oak",
    brand: yamazaki,
    distillers: [yamazaki],
    ...overrides,
  };
}

const regressionInput: BottleCreateCandidateInput = {
  name: "The Yamazaki Peated Malt Spanish Oak - Kogei Collection",
  brand: { id: 1, name: "Suntory" },
  distillers: [yamazaki],
};

describe("Bottle create candidate discovery", () => {
  test("builds search-only variants for repeated identity and collection text", () => {
    expect(buildBottleCreateCandidateQueries(regressionInput)).toEqual([
      "the yamazaki peated malt spanish oak kogei collection",
      "the yamazaki peated malt spanish oak",
      "peated malt spanish oak kogei collection",
      "peated malt spanish oak",
    ]);
  });

  test("suppresses a generic name without supporting identity facts", () => {
    expect(buildBottleCreateCandidateQueries({ name: "12-year-old" })).toEqual(
      [],
    );
  });

  test("ranks the core product above a weaker name match despite a wrong Brand", () => {
    const results = rankBottleCreateCandidates(
      regressionInput,
      [
        candidate({
          id: 3,
          fullName: "Yamazaki Peated Malt",
          name: "Peated Malt",
        }),
        candidate({ id: 2 }),
      ],
      3,
    );

    expect(results.map(({ id }) => id)).toEqual([2, 3]);
  });

  test("deduplicates candidates returned by several discovery queries", () => {
    const duplicate = candidate();
    expect(
      rankBottleCreateCandidates(regressionInput, [duplicate, duplicate], 3),
    ).toEqual([duplicate]);
  });

  test("uses release facts to order otherwise identical names", () => {
    const input = { ...regressionInput, releaseYear: 2024 };
    const results = rankBottleCreateCandidates(
      input,
      [
        candidate({ id: 2, releaseYear: 2023 }),
        candidate({ id: 3, releaseYear: 2024 }),
      ],
      3,
    );

    expect(results.map(({ id }) => id)).toEqual([3, 2]);
  });

  test("does not use malt phenol level to rank possible duplicates", () => {
    const input = { ...regressionInput, maltPhenolPpm: 50 };
    const results = rankBottleCreateCandidates(
      input,
      [
        candidate({ id: 2, maltPhenolPpm: 20 }),
        candidate({ id: 3, maltPhenolPpm: 50 }),
      ],
      3,
    );

    expect(results.map(({ id }) => id)).toEqual([2, 3]);
  });

  test("uses distinguishing production and cask facts from the full draft", () => {
    const input: BottleCreateCandidateInput = {
      ...regressionInput,
      category: "single_malt",
      noAgeStatement: true,
      singleCask: true,
      caskStrength: true,
      maturation: "Mizunara oak",
      caskNumber: "35.401",
      outturn: 240,
    };
    const results = rankBottleCreateCandidates(
      input,
      [
        candidate({
          id: 2,
          category: "single_malt",
          noAgeStatement: false,
          singleCask: false,
          caskStrength: false,
          maturation: "Ex-bourbon barrels",
          caskNumber: "18",
          outturn: 480,
        }),
        candidate({
          id: 3,
          category: "single_malt",
          noAgeStatement: true,
          singleCask: true,
          caskStrength: true,
          maturation: "mizunara oak",
          caskNumber: "35.401",
          outturn: 240,
        }),
      ],
      3,
    );

    expect(results.map(({ id }) => id)).toEqual([3, 2]);
  });
});
