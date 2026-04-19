import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SearchResponseFixture } from "./classifier.eval.fixtures";
import type { ClassifyBottleReferenceInput } from "./contract";
import {
  buildBottleCandidate,
  buildExtractedIdentity,
} from "./evalFixtureBuilders";
import {
  type BottleNormalizationExpectation,
  type RealWorldNewBottleFixture,
  listFixtureFiles,
  realWorldNewBottleFixtureSchema,
} from "./evalFixtureSchemas";

export type RealWorldNewBottleEvalCase = {
  fixtureId: string;
  name: string;
  input: ClassifyBottleReferenceInput;
  searchResponses?: SearchResponseFixture[];
  expectedBottleName: string;
  expected: BottleNormalizationExpectation;
  summary: string;
  peatedBottleIds: number[];
};

type NewBottleEvalOverride = {
  input?: Omit<Partial<ClassifyBottleReferenceInput>, "reference">;
  searchResponses?: SearchResponseFixture[];
};

const jura12CoreMatch = buildBottleCandidate({
  bottleId: 3233,
  fullName: "Isle of Jura 12-year-old Single Malt Scotch Whisky",
  brand: "Jura",
  distillery: ["Isle of Jura"],
  category: "single_malt",
  statedAge: 12,
  score: 0.93,
  source: ["text"],
});

const juraElixirSibling = buildBottleCandidate({
  bottleId: 4306,
  fullName: "Jura Elixir",
  brand: "Jura",
  distillery: ["Isle of Jura"],
  category: "single_malt",
  score: 0.78,
  source: ["text"],
});

const lagavulinDistillersEditionParent = buildBottleCandidate({
  bottleId: 44006,
  fullName: "Lagavulin Distillers Edition",
  brand: "Lagavulin",
  distillery: ["Lagavulin"],
  category: "single_malt",
  score: 0.91,
  source: ["brand"],
});

const lagavulinDistillersEdition2023Release = buildBottleCandidate({
  bottleId: 44006,
  releaseId: 78,
  kind: "release",
  fullName: "Lagavulin Distillers Edition 2023 Release",
  bottleFullName: "Lagavulin Distillers Edition",
  brand: "Lagavulin",
  distillery: ["Lagavulin"],
  category: "single_malt",
  releaseYear: 2023,
  score: 0.95,
  source: ["brand", "release"],
});

const highlandParkCaskStrengthParent = buildBottleCandidate({
  bottleId: 44080,
  fullName: "Highland Park Cask Strength",
  brand: "Highland Park",
  distillery: ["Highland Park"],
  category: "single_malt",
  score: 0.92,
  source: ["text"],
});

const singleBarrel1792 = buildBottleCandidate({
  bottleId: 16051,
  fullName: "1792 Single Barrel",
  brand: "1792",
  category: "bourbon",
  singleCask: true,
  score: 0.94,
  source: ["text"],
});

const REAL_WORLD_NEW_BOTTLE_EVAL_OVERRIDES: Partial<
  Record<string, NewBottleEvalOverride>
> = {
  "jura-12-brand-distillery": {
    input: {
      extractedIdentity: buildExtractedIdentity({
        brand: "Jura",
        distillery: ["Jura"],
        category: "single_malt",
        stated_age: 12,
      }),
      initialCandidates: [jura12CoreMatch, juraElixirSibling],
    },
    searchResponses: [
      {
        when: ["jura", "12"],
        results: [jura12CoreMatch, juraElixirSibling],
      },
    ],
  },
  "lagavulin-distillers-edition-parent": {
    input: {
      extractedIdentity: buildExtractedIdentity({
        brand: "Lagavulin",
        expression: "Distillers Edition",
        distillery: ["Lagavulin"],
        category: "single_malt",
      }),
      initialCandidates: [lagavulinDistillersEditionParent],
    },
    searchResponses: [
      {
        when: ["lagavulin", "distillers edition"],
        results: [lagavulinDistillersEditionParent],
      },
    ],
  },
  "lagavulin-distillers-edition-2023": {
    input: {
      extractedIdentity: buildExtractedIdentity({
        brand: "Lagavulin",
        expression: "Distillers Edition",
        distillery: ["Lagavulin"],
        category: "single_malt",
        release_year: 2023,
      }),
      initialCandidates: [
        lagavulinDistillersEditionParent,
        lagavulinDistillersEdition2023Release,
      ],
    },
    searchResponses: [
      {
        when: ["lagavulin", "distillers edition"],
        results: [
          lagavulinDistillersEditionParent,
          lagavulinDistillersEdition2023Release,
        ],
      },
    ],
  },
  "highland-park-cask-strength-no-5": {
    input: {
      extractedIdentity: buildExtractedIdentity({
        brand: "Highland Park",
        expression: "Cask Strength",
        distillery: ["Highland Park"],
        category: "single_malt",
        edition: "No. 5",
      }),
      initialCandidates: [highlandParkCaskStrengthParent],
    },
    searchResponses: [
      {
        when: ["highland park", "cask strength"],
        results: [highlandParkCaskStrengthParent],
      },
    ],
  },
  "1792-single-barrel": {
    input: {
      extractedIdentity: buildExtractedIdentity({
        brand: "1792",
        expression: "Single Barrel",
        category: "bourbon",
        single_cask: true,
      }),
      initialCandidates: [singleBarrel1792],
    },
    searchResponses: [
      {
        when: ["1792", "single barrel"],
        results: [singleBarrel1792],
      },
    ],
  },
};

const fixtureDir = fileURLToPath(
  new URL("./eval-fixtures/new-bottles/", import.meta.url),
);

function loadFixtureFiles(): RealWorldNewBottleFixture[] {
  return listFixtureFiles(fixtureDir).map((filename) => {
    const rawFixture = JSON.parse(readFileSync(filename, "utf8"));

    return realWorldNewBottleFixtureSchema.parse(
      rawFixture,
    ) as RealWorldNewBottleFixture;
  });
}

function buildEvalCase(
  fixture: RealWorldNewBottleFixture,
): RealWorldNewBottleEvalCase {
  const override = REAL_WORLD_NEW_BOTTLE_EVAL_OVERRIDES[fixture.id];

  return {
    fixtureId: fixture.id,
    name: fixture.referenceName,
    input: {
      reference: {
        name: fixture.referenceName,
      },
      ...(override?.input ?? {}),
    },
    searchResponses: override?.searchResponses,
    expectedBottleName: fixture.expectedBottleName,
    expected: fixture.expected,
    summary: fixture.summary,
    peatedBottleIds: fixture.peatedBottleIds,
  };
}

export const REAL_WORLD_NEW_BOTTLE_EVAL_CASES =
  loadFixtureFiles().map(buildEvalCase);
