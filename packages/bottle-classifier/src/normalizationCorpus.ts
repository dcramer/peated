export type BottleNormalizationReleaseIdentity = {
  edition: string | null;
  releaseYear: number | null;
};

export type BottleNormalizationExpectation = {
  classifierExpectation:
    | "bottle"
    | "bottle_plus_release"
    | "exact_cask"
    | "review_required";
  heuristicExpectation: "none" | "strong_release_marker" | "classifier_only";
  releaseIdentity: BottleNormalizationReleaseIdentity | null;
};

export type BottleNormalizationCorpusExample = {
  id: string;
  inputName: string;
  notes: string;
  expectedBottleName: string;
  expectation: BottleNormalizationExpectation;
};

export const BOTTLE_NORMALIZATION_CORPUS: BottleNormalizationCorpusExample[] = [
  {
    id: "simple-age-bottle",
    inputName: "Aberfeldy 12",
    expectedBottleName: "Aberfeldy 12-year-old",
    expectation: {
      classifierExpectation: "bottle",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Stable bottle identity with no release split.",
  },
  {
    id: "springbank-batch-release",
    inputName: "Springbank 12 Cask Strength Batch 24",
    expectedBottleName: "Springbank 12 Cask Strength",
    expectation: {
      classifierExpectation: "bottle_plus_release",
      heuristicExpectation: "strong_release_marker",
      releaseIdentity: {
        edition: "Batch 24",
        releaseYear: null,
      },
    },
    notes:
      "Numeric batch marker is strong release identity under a stable parent.",
  },
  {
    id: "lagavulin-distillers-edition-parent",
    inputName: "Lagavulin Distillers Edition",
    expectedBottleName: "Lagavulin Distillers Edition",
    expectation: {
      classifierExpectation: "bottle",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Distillers Edition is stable family or bottle identity on its own.",
  },
  {
    id: "lagavulin-distillers-edition-year-release",
    inputName: "Lagavulin Distillers Edition 2011 Release",
    expectedBottleName: "Lagavulin Distillers Edition",
    expectation: {
      classifierExpectation: "bottle_plus_release",
      heuristicExpectation: "strong_release_marker",
      releaseIdentity: {
        edition: null,
        releaseYear: 2011,
      },
    },
    notes: "Annual release under a stable Distillers Edition parent.",
  },
  {
    id: "makers-private-selection-code",
    inputName: "Maker's Mark Private Selection S2B13",
    expectedBottleName: "Maker's Mark Private Selection",
    expectation: {
      classifierExpectation: "bottle_plus_release",
      heuristicExpectation: "classifier_only",
      releaseIdentity: {
        edition: "S2B13",
        releaseYear: null,
      },
    },
    notes:
      "Program code is release identity, but current repair heuristics should leave this to classifier review.",
  },
  {
    id: "traigh-bhan-batch",
    inputName: "Ardbeg Traigh Bhan 19-year-old Batch 5",
    expectedBottleName: "Ardbeg Traigh Bhan 19-year-old",
    expectation: {
      classifierExpectation: "bottle_plus_release",
      heuristicExpectation: "strong_release_marker",
      releaseIdentity: {
        edition: "Batch 5",
        releaseYear: null,
      },
    },
    notes: "Numeric batch marker is canonical release identity.",
  },
  {
    id: "batch-strength-family",
    inputName: "Batch Strength",
    expectedBottleName: "Batch Strength",
    expectation: {
      classifierExpectation: "bottle",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Generic batch wording is part of bottle identity, not a release.",
  },
  {
    id: "batch-proof-family",
    inputName: "Batch Proof",
    expectedBottleName: "Batch Proof",
    expectation: {
      classifierExpectation: "bottle",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Generic batch wording is part of bottle identity, not a release.",
  },
  {
    id: "batch-sherry-family",
    inputName: "Batch Sherry",
    expectedBottleName: "Batch Sherry",
    expectation: {
      classifierExpectation: "review_required",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Generic batch wording is not a release marker, but this raw input is too sparse to safely infer a branded bottle identity.",
  },
  {
    id: "macallan-double-cask",
    inputName: "Macallan Double Cask",
    expectedBottleName: "Macallan Double Cask",
    expectation: {
      classifierExpectation: "bottle",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Stable product wording, not a release split.",
  },
  {
    id: "glenallachie-sherry-cask",
    inputName: "Glenallachie Sherry Cask",
    expectedBottleName: "Glenallachie Sherry Cask",
    expectation: {
      classifierExpectation: "bottle",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Stable product wording, not a release split by itself.",
  },
  {
    id: "elijah-craig-cask-strength",
    inputName: "Elijah Craig Cask Strength",
    expectedBottleName: "Elijah Craig Barrel Proof",
    expectation: {
      classifierExpectation: "bottle",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Common shorthand should normalize to the canonical Elijah Craig Barrel Proof bottle family unless a real batch code is present.",
  },
  {
    id: "elijah-craig-barrel-proof-batch-c923",
    inputName: "Elijah Craig Barrel Proof Batch C923",
    expectedBottleName: "Elijah Craig Barrel Proof",
    expectation: {
      classifierExpectation: "bottle_plus_release",
      heuristicExpectation: "strong_release_marker",
      releaseIdentity: {
        edition: "Batch C923",
        releaseYear: null,
      },
    },
    notes:
      "Canonical batch code is release identity under the reusable Elijah Craig Barrel Proof bottle family.",
  },
  {
    id: "four-roses-single-barrel",
    inputName: "Four Roses Single Barrel",
    expectedBottleName: "Four Roses Single Barrel",
    expectation: {
      classifierExpectation: "bottle",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Generic single-barrel wording is bottle identity here.",
  },
  {
    id: "four-roses-single-barrel-barrel-strength",
    inputName: "Four Roses Single Barrel Barrel Strength",
    expectedBottleName: "Four Roses Single Barrel",
    expectation: {
      classifierExpectation: "review_required",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Needs classifier or moderator review. Strength wording alone should not force a release split.",
  },
  {
    id: "smws-code-bottle",
    inputName: "SMWS 6.53",
    expectedBottleName: "SMWS 6.53",
    expectation: {
      classifierExpectation: "exact_cask",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "SMWS code is marketed exact-cask identity, not bottle plus child release.",
  },
  {
    id: "octomore-dot-expression",
    inputName: "Octomore 13.1",
    expectedBottleName: "Octomore 13.1",
    expectation: {
      classifierExpectation: "bottle",
      heuristicExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Dot expressions are distinct bottles, not child releases of Octomore 13.",
  },
];

export const BOTTLE_NORMALIZATION_CORPUS_BY_ID = new Map(
  BOTTLE_NORMALIZATION_CORPUS.map((example) => [example.id, example]),
);
