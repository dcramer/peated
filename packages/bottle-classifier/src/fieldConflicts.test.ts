import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { BottleExtractedDetails } from "./classifierTypes";
import {
  COMPARABLE_BOTTLE_FIELDS,
  compareBottleFields,
  getBottleFieldConflicts,
  type ComparableBottleFields,
} from "./fieldConflicts";

const facts: BottleExtractedDetails = {
  brand: "Example",
  bottler: null,
  expression: "Port Cask",
  series: null,
  distillery: [],
  category: "single_malt",
  stated_age: 10,
  abv: 46,
  release_year: null,
  vintage_year: null,
  cask_strength: null,
  single_cask: null,
  maturation: null,
  cask_number: null,
  outturn: null,
  edition: "Batch No. 3",
};

const bottle: ComparableBottleFields = {
  category: "single_malt",
  statedAge: 10,
  abv: 46,
  vintageYear: 2012,
  releaseYear: null,
  caskStrength: true,
  singleCask: null,
  edition: "Batch 3",
};

function editionConflicts(source: string, stored: string) {
  return getBottleFieldConflicts(
    { ...facts, edition: source },
    { ...bottle, edition: stored },
  );
}

describe("getBottleFieldConflicts", () => {
  test("finds no conflict when populated fields agree or one side is empty", () => {
    expect(getBottleFieldConflicts(facts, bottle)).toEqual([]);
  });

  test("reports each typed field that differs", () => {
    expect(
      getBottleFieldConflicts(
        { ...facts, stated_age: 12, category: "bourbon", edition: "Batch 4" },
        bottle,
      ),
    ).toEqual(["category", "statedAge", "edition"]);
  });

  test("counts any ABV difference", () => {
    expect(getBottleFieldConflicts({ ...facts, abv: 46.04 }, bottle)).toEqual([
      "abv",
    ]);
  });

  test("never compares free-text names", () => {
    expect(
      getBottleFieldConflicts(
        { ...facts, brand: "Another", expression: "Different" },
        bottle,
      ),
    ).toEqual([]);
  });

  test("has nothing to compare without facts", () => {
    expect(getBottleFieldConflicts(null, bottle)).toEqual([]);
  });

  test("reads a printed # or letter case as the same cask number", () => {
    const target = { ...bottle, caskNumber: "3771" };
    expect(
      getBottleFieldConflicts({ ...facts, cask_number: "#3771" }, target),
    ).toEqual([]);
    expect(
      getBottleFieldConflicts(
        { ...facts, cask_number: "r10/34" },
        { ...bottle, caskNumber: "R10/34" },
      ),
    ).toEqual([]);
    expect(
      getBottleFieldConflicts({ ...facts, cask_number: "#3773" }, target),
    ).toEqual(["caskNumber"]);
  });

  test("keeps other cask number punctuation", () => {
    expect(
      getBottleFieldConflicts(
        { ...facts, cask_number: "53322" },
        { ...bottle, caskNumber: "53.322" },
      ),
    ).toEqual(["caskNumber"]);
  });

  test("checks cask and date facts for every caller without inventing missing values", () => {
    const target = {
      ...bottle,
      caskNumber: "123",
      bottlingYear: 2020,
      releaseMonth: 9,
      releaseDay: 1,
    };
    expect(getBottleFieldConflicts(facts, target)).toEqual([]);
    expect(
      getBottleFieldConflicts(
        {
          ...facts,
          cask_number: "124",
          bottling_year: 2021,
          release_month: 10,
          release_day: 2,
        },
        target,
      ),
    ).toEqual(["caskNumber", "bottlingYear", "releaseMonth", "releaseDay"]);
    expect(
      getBottleFieldConflicts(
        { ...facts, cask_number: "123", bottling_year: 2020 },
        target,
      ),
    ).toEqual([]);
  });
});

describe("edition conflicts", () => {
  test("ignores wording around the same year", () => {
    // Auction lot 7551 against Bottle 3277, 2026-10-24.
    expect(editionConflicts("2017 Release", "2017 Edition")).toEqual([]);
    expect(editionConflicts("Release 2020", "2020 Edition")).toEqual([]);
  });

  test("ignores a marker that only one side records", () => {
    // Auction lot 4722 against Bottle 52158, 2026-10-24.
    expect(editionConflicts("Cask #2787", "Cask 2787 · Fèis Ìle 2023")).toEqual(
      [],
    );
    expect(
      editionConflicts("Batch 7", "Batch 7 · for The Whisky Shop"),
    ).toEqual([]);
  });

  test("reads accents, No., and leading zeros as the same marker", () => {
    expect(editionConflicts("Fèis Ìle 2023", "Feis Ile 2023")).toEqual([]);
    expect(editionConflicts("Edition No. 1", "Edition 01")).toEqual([]);
  });

  test("conflicts when each side has a different marker", () => {
    expect(editionConflicts("Batch 3", "Batch 4")).toEqual(["edition"]);
    expect(editionConflicts("S2B13", "S2B14")).toEqual(["edition"]);
    expect(editionConflicts("Fèis Ìle 2024", "Feis Ile 2023")).toEqual([
      "edition",
    ]);
  });

  test("keeps numbers joined by a dot or slash as one marker", () => {
    expect(editionConflicts("Batch 1.1", "Batch 1.2")).toEqual(["edition"]);
    expect(editionConflicts("Batch 1", "Batch 1.1")).toEqual(["edition"]);
    expect(editionConflicts("Batch 22/030", "Batch 22")).toEqual(["edition"]);
    expect(editionConflicts("Batch 1.2a", "Batch 1.2b")).toEqual(["edition"]);
    expect(editionConflicts("22/030A", "22/030")).toEqual(["edition"]);
    expect(editionConflicts("Release 02.1", "2.1")).toEqual([]);
    expect(
      compareBottleFields({ edition: "Batch 1" }, { edition: "Batch 1.1" }),
    ).toMatchObject({ agreements: [] });
  });

  test("ignores a space between letters and a number", () => {
    expect(editionConflicts("Batch3", "Batch 3")).toEqual([]);
    expect(editionConflicts("Release2020", "2020 Release")).toEqual([]);
    expect(editionConflicts("S2B13", "S2 B13")).toEqual([]);
    expect(editionConflicts("Batch03", "Batch 3")).toEqual([]);
    // The same printed code matches itself, even when one side also prints
    // its letter as a word.
    expect(editionConflicts("Cask C12, Batch C", "Cask C12")).toEqual([]);
    expect(editionConflicts("Batch B1 B", "Batch B1")).toEqual([]);
    expect(
      compareBottleFields({ edition: "Batch3" }, { edition: "Batch 3" }),
    ).toMatchObject({ agreements: ["edition"] });
  });

  test("keeps letter codes and separate numbers distinct", () => {
    expect(editionConflicts("Batch3", "Batch 4")).toEqual(["edition"]);
    expect(editionConflicts("A123", "B123")).toEqual(["edition"]);
    expect(editionConflicts("S2B13", "S2B14")).toEqual(["edition"]);
    expect(editionConflicts("Batch 1 2", "Batch 12")).toEqual(["edition"]);
  });

  test("leaves wording without markers to the classifier", () => {
    expect(editionConflicts("First Edition", "Limited Edition")).toEqual([]);
  });
});

describe("compareBottleFields", () => {
  test("sorts supplied facts into agreements, missing facts, and conflicts", () => {
    expect(
      compareBottleFields(
        { abv: 46, releaseYear: 2024, vintageYear: 2011, edition: "Batch 3" },
        bottle,
      ),
    ).toEqual({
      agreements: ["abv", "edition"],
      missing: ["releaseYear"],
      conflicts: ["vintageYear"],
    });
  });

  test("calls editions without matching markers neither agreement nor conflict", () => {
    expect(
      compareBottleFields(
        { edition: "First Edition" },
        { edition: "Limited Edition" },
      ),
    ).toEqual({ agreements: [], missing: [], conflicts: [] });
    expect(
      compareBottleFields(
        { edition: "Cask 2787" },
        { edition: "Cask 2787 2023" },
      ),
    ).toEqual({ agreements: [], missing: [], conflicts: [] });
  });
});

// These tests generate many random inputs and check that each rule in
// "Deterministic Code" (`docs/architecture/bottle-classifier.md`) holds for
// every one. fast-check shrinks a failure to the smallest input that breaks it.
describe("compareBottleFields rules for any input", () => {
  const wordArb = fc.stringMatching(/^[A-Za-zÀ-ÖØ-öø-ÿ]{1,8}$/);
  const markerArb = fc.oneof(
    fc.nat(2030).map(String),
    fc.stringMatching(/^[A-Za-z]{0,2}\d{1,3}(?:[./]\d{1,3}[a-z]?)?$/),
  );
  const editionArb = fc
    .array(fc.oneof(wordArb, markerArb), { minLength: 1, maxLength: 4 })
    .map((words) => words.join(" "));
  const caskNumberArb = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9./ -]{0,7}$/);

  // `undefined`, `null`, and "" are the three ways a field can be empty.
  function optional<T>(arb: fc.Arbitrary<T>) {
    return fc.oneof(
      { arbitrary: arb, weight: 3 },
      fc.constantFrom(undefined, null),
    );
  }
  function optionalText(arb: fc.Arbitrary<string>) {
    return fc.oneof(
      { arbitrary: arb, weight: 3 },
      fc.constantFrom(undefined, null, ""),
    );
  }
  const yearArb = fc.integer({ min: 1900, max: 2030 });
  const fieldsArb: fc.Arbitrary<ComparableBottleFields> = fc.record({
    category: optionalText(
      fc.constantFrom("single_malt", "blend", "bourbon", "rye"),
    ),
    statedAge: optional(fc.integer({ min: 0, max: 60 })),
    noAgeStatement: optional(fc.boolean()),
    abv: optional(fc.double({ min: 0, max: 100, noNaN: true })),
    vintageYear: optional(yearArb),
    releaseYear: optional(yearArb),
    caskStrength: optional(fc.boolean()),
    singleCask: optional(fc.boolean()),
    edition: optionalText(editionArb),
    caskNumber: optionalText(caskNumberArb),
    bottlingYear: optional(yearArb),
    releaseMonth: optional(fc.integer({ min: 1, max: 12 })),
    releaseDay: optional(fc.integer({ min: 1, max: 31 })),
  });
  // Fills each field from either Bottle so both sides often hold the same value.
  const pairArb = fc
    .tuple(fieldsArb, fieldsArb, fc.array(fc.boolean(), { minLength: 13 }))
    .map(([source, other, shared]) => {
      const bottle: ComparableBottleFields = { ...other };
      COMPARABLE_BOTTLE_FIELDS.forEach((field, index) => {
        if (shared[index]) Object.assign(bottle, { [field]: source[field] });
      });
      return [source, bottle] as const;
    });

  const isEmpty = (
    value: ComparableBottleFields[keyof ComparableBottleFields],
  ) => value === undefined || value === null || value === "";
  function outcomeOf(
    comparison: ReturnType<typeof compareBottleFields>,
    field: (typeof COMPARABLE_BOTTLE_FIELDS)[number],
  ) {
    const outcomes = (["agreements", "missing", "conflicts"] as const).filter(
      (key) => comparison[key].includes(field),
    );
    expect(outcomes.length).toBeLessThanOrEqual(1);
    return outcomes[0] ?? "none";
  }
  function editionOutcome(left: string, right: string) {
    return outcomeOf(
      compareBottleFields({ edition: left }, { edition: right }),
      "edition",
    );
  }

  test("an empty field on either side is never a conflict", () => {
    fc.assert(
      fc.property(pairArb, ([source, bottle]) => {
        const comparison = compareBottleFields(source, bottle);
        for (const field of COMPARABLE_BOTTLE_FIELDS) {
          const allowed = isEmpty(source[field])
            ? ["none"]
            : isEmpty(bottle[field])
              ? ["missing"]
              : // Only editions may be neither: wording without markers is
                // left to the classifier.
                field === "edition"
                ? ["agreements", "conflicts", "none"]
                : ["agreements", "conflicts"];
          expect(allowed).toContain(outcomeOf(comparison, field));
        }
      }),
    );
  });

  test("gives the same answer with the sides swapped", () => {
    fc.assert(
      fc.property(pairArb, ([source, bottle]) => {
        const forward = compareBottleFields(source, bottle);
        const backward = compareBottleFields(bottle, source);
        expect(backward.agreements.sort()).toEqual(forward.agreements.sort());
        expect(backward.conflicts.sort()).toEqual(forward.conflicts.sort());
      }),
    );
  });

  test("never finds a conflict between a Bottle and itself", () => {
    fc.assert(
      fc.property(fieldsArb, (fields) => {
        expect(compareBottleFields(fields, fields).conflicts).toEqual([]);
      }),
    );
  });

  test("extra wording without markers never makes a conflict", () => {
    fc.assert(
      fc.property(editionArb, wordArb, (edition, word) => {
        expect(editionOutcome(`${edition} ${word}`, edition)).not.toBe(
          "conflicts",
        );
      }),
    );
  });

  test("ignores a leading # and letter case in cask numbers", () => {
    fc.assert(
      fc.property(caskNumberArb, (caskNumber) => {
        expect(
          compareBottleFields(
            { caskNumber: `#${caskNumber.toUpperCase()}` },
            { caskNumber: caskNumber.toLowerCase() },
          ).agreements,
        ).toEqual(["caskNumber"]);
      }),
    );
  });

  test("never conflicts on an edition marker that only one side records", () => {
    fc.assert(
      fc.property(editionArb, markerArb, (edition, extra) => {
        expect(editionOutcome(edition, `${edition} ${extra}`)).not.toBe(
          "conflicts",
        );
      }),
    );
  });

  test("ignores edition wording that has no digits", () => {
    fc.assert(
      fc.property(
        editionArb,
        editionArb,
        fc.array(wordArb, { minLength: 1, maxLength: 3 }),
        (left, right, words) => {
          expect(editionOutcome(`${words.join(" ")} ${left}`, right)).toBe(
            editionOutcome(left, right),
          );
          expect(editionOutcome(left, `${right} ${words.join(" ")}`)).toBe(
            editionOutcome(left, right),
          );
        },
      ),
    );
  });

  test("reads an edition the same with or without spaces between letters and numbers", () => {
    fc.assert(
      fc.property(editionArb, fc.boolean(), (edition, split) => {
        const respaced = split
          ? edition.replace(/(\p{L})(\d)|(\d)(\p{L})/gu, "$1$3 $2$4")
          : edition.replace(/(\p{L}) (\d)|(\d) (\p{L})/gu, "$1$3$2$4");
        fc.pre(/\d/.test(edition));
        expect(editionOutcome(edition, respaced)).toBe("agreements");
      }),
    );
  });

  test("glued letters never hide a different number", () => {
    fc.assert(
      fc.property(wordArb, fc.nat(999), fc.nat(999), (word, left, right) => {
        fc.pre(left !== right);
        expect(editionOutcome(`${word}${left}`, `${word} ${right}`)).toBe(
          "conflicts",
        );
      }),
    );
  });

  test("ignores accents and letter case in editions", () => {
    fc.assert(
      fc.property(editionArb, editionArb, (left, right) => {
        const plain = left
          .normalize("NFKD")
          .replace(/\p{M}/gu, "")
          .toUpperCase();
        expect(editionOutcome(plain, right)).toBe(editionOutcome(left, right));
      }),
    );
  });

  test("reads leading zeros as the same edition marker", () => {
    fc.assert(
      fc.property(
        wordArb,
        fc.nat(999),
        fc.integer({ min: 1, max: 3 }),
        (word, number, zeros) => {
          expect(
            editionOutcome(
              `${word} ${number}`,
              `${word} ${"0".repeat(zeros)}${number}`,
            ),
          ).toBe("agreements");
        },
      ),
    );
  });

  test("conflicts on different edition numbers", () => {
    fc.assert(
      fc.property(
        wordArb,
        fc.nat(999),
        fc.nat(999),
        fc.option(wordArb, { nil: undefined }),
        (word, left, right, suffix) => {
          fc.pre(left !== right);
          const tail = suffix ? ` ${suffix}` : "";
          expect(
            editionOutcome(`${word} ${left}${tail}`, `${word} ${right}`),
          ).toBe("conflicts");
        },
      ),
    );
  });
});
