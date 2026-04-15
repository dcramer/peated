/**
 * Shared source of truth for bottle-normalization boundary cases.
 *
 * The key rule is:
 * - keep deterministic fast paths limited to structurally safe, effectively
 *   zero-ambiguity behavior
 * - keep brand-, program-, or wording-dependent behavior classifier-owned
 * - block instead of guessing when the input is too sparse to safely infer a
 *   canonical bottle identity
 *
 * Add positive and negative examples in pairs whenever a bottle family is
 * ambiguous enough to regress.
 */
export type BottleNormalizationReleaseIdentity = {
  edition: string | null;
  releaseYear: number | null;
};

/**
 * Who should own the final bottle/release decision for this input.
 *
 * `deterministic_safe` is reserved for structurally safe cases such as exact
 * coded release markers or exact program codes.
 *
 * `classifier_required` means the deterministic layer must stay conservative
 * and leave the final semantic decision to the classifier.
 *
 * `block_if_uncertain` means even the classifier should avoid inventing a
 * canonical bottle from the bare input unless stronger evidence is available.
 */
export type BottleNormalizationHandlingStrategy =
  | "deterministic_safe"
  | "classifier_required"
  | "block_if_uncertain";

/**
 * What the deterministic legacy release-repair fast path is allowed to do with
 * the input before classifier review.
 */
export type BottleNormalizationDeterministicReleaseExpectation =
  | "none"
  | "strong_release_marker";

/**
 * How an ambiguous family should contrast across examples.
 *
 * `keep_bottle` means the wording should remain bottle-level identity.
 * `split_release` means the wording/code should become bottle + release.
 * `block` means the input is too ambiguous or sparse to infer safely.
 */
export type BottleNormalizationContrastOutcome =
  | "keep_bottle"
  | "split_release"
  | "block";

export type BottleNormalizationExpectation = {
  handlingStrategy: BottleNormalizationHandlingStrategy;
  classifierExpectation:
    | "bottle"
    | "bottle_plus_release"
    | "exact_cask"
    | "review_required";
  deterministicReleaseExpectation: BottleNormalizationDeterministicReleaseExpectation;
  releaseIdentity: BottleNormalizationReleaseIdentity | null;
};

export type BottleNormalizationCorpusExample = {
  id: string;
  inputName: string;
  notes: string;
  expectedBottleName: string;
  /**
   * Optional grouping for ambiguous families that should always be represented
   * by more than one outcome in the corpus.
   */
  contrastGroup?: string;
  contrastOutcome?: BottleNormalizationContrastOutcome;
  /**
   * Optional live Peated bottle pages that motivated the example.
   *
   * These are provenance breadcrumbs, not additional expectations. They make
   * it easier to revisit a real family when the corpus needs to be expanded or
   * debugged later.
   */
  peatedBottleIds?: number[];
  /**
   * Whether this example should be part of the paid live eval surface.
   *
   * Keep this narrow. Only classifier-owned or block-if-uncertain cases that
   * materially improve the quality bar should opt in here.
   */
  liveEvalCoverage: "required" | "skip";
  /**
   * Short summary used by the live eval harness when this example is opted in.
   */
  liveEvalSummary?: string;
  expectation: BottleNormalizationExpectation;
};

export const BOTTLE_NORMALIZATION_CORPUS: BottleNormalizationCorpusExample[] = [
  {
    id: "simple-age-bottle",
    inputName: "Aberfeldy 12",
    expectedBottleName: "Aberfeldy 12-year-old",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "deterministic_safe",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Stable bottle identity with no release split.",
  },
  {
    id: "springbank-batch-release",
    inputName: "Springbank 12 Cask Strength Batch 24",
    expectedBottleName: "Springbank 12 Cask Strength",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "deterministic_safe",
      classifierExpectation: "bottle_plus_release",
      deterministicReleaseExpectation: "strong_release_marker",
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
    contrastGroup: "distillers_edition",
    contrastOutcome: "keep_bottle",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Keep Lagavulin Distillers Edition as bottle identity when no release year is present instead of inventing a child annual release from the family wording alone.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Distillers Edition is stable family or bottle identity on its own.",
  },
  {
    id: "lagavulin-distillers-edition-year-release",
    inputName: "Lagavulin Distillers Edition 2011 Release",
    expectedBottleName: "Lagavulin Distillers Edition",
    contrastGroup: "distillers_edition",
    contrastOutcome: "split_release",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "deterministic_safe",
      classifierExpectation: "bottle_plus_release",
      deterministicReleaseExpectation: "strong_release_marker",
      releaseIdentity: {
        edition: null,
        releaseYear: 2011,
      },
    },
    notes: "Annual release under a stable Distillers Edition parent.",
  },
  {
    id: "makers-private-selection-family",
    inputName: "Maker's Mark Private Selection",
    expectedBottleName: "Maker's Mark Private Selection",
    contrastGroup: "private_selection",
    contrastOutcome: "keep_bottle",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Keep Maker's Mark Private Selection as a bottle family when there is no stave code instead of inventing a child release from the family wording alone.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Private Selection is a bottle family on its own; without a stave code the system should not invent a child release.",
  },
  {
    id: "makers-private-selection-code",
    inputName: "Maker's Mark Private Selection S2B13",
    expectedBottleName: "Maker's Mark Private Selection",
    contrastGroup: "private_selection",
    contrastOutcome: "split_release",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Treat Private Selection as the bottle and the S2B13 code as release identity instead of ignoring the code or folding it into the bottle name.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle_plus_release",
      deterministicReleaseExpectation: "none",
      releaseIdentity: {
        edition: "S2B13",
        releaseYear: null,
      },
    },
    notes:
      "Program code is release identity, but current repair heuristics should leave this to classifier review.",
  },
  {
    id: "traigh-bhan-family",
    inputName: "Ardbeg Traigh Bhan 19-year-old",
    expectedBottleName: "Ardbeg Traigh Bhan 19-year-old",
    contrastGroup: "traigh_bhan",
    contrastOutcome: "keep_bottle",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Keep Traigh Bhan 19-year-old as bottle identity when there is no batch marker instead of inventing a child release from the family alone.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Traigh Bhan is a stable bottle family; a numeric batch marker is what upgrades it into release identity.",
  },
  {
    id: "traigh-bhan-batch",
    inputName: "Ardbeg Traigh Bhan 19-year-old Batch 5",
    expectedBottleName: "Ardbeg Traigh Bhan 19-year-old",
    contrastGroup: "traigh_bhan",
    contrastOutcome: "split_release",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "deterministic_safe",
      classifierExpectation: "bottle_plus_release",
      deterministicReleaseExpectation: "strong_release_marker",
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
    contrastGroup: "generic_batch_wording",
    contrastOutcome: "keep_bottle",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Keep Batch Strength as a bottle-level identity and avoid inventing a fake release split from the word Batch alone.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Generic batch wording is part of bottle identity, not a release.",
  },
  {
    id: "batch-proof-family",
    inputName: "Batch Proof",
    expectedBottleName: "Batch Proof",
    contrastGroup: "generic_batch_wording",
    contrastOutcome: "keep_bottle",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Generic batch wording is part of bottle identity, not a release.",
  },
  {
    id: "batch-sherry-family",
    inputName: "Batch Sherry",
    expectedBottleName: "Batch Sherry",
    contrastGroup: "generic_batch_wording",
    contrastOutcome: "block",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Treat bare Batch Sherry as too sparse for a specific canonical bottle and avoid inventing a branded identity from generic Batch wording.",
    expectation: {
      handlingStrategy: "block_if_uncertain",
      classifierExpectation: "review_required",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Generic batch wording is not a release marker, but this raw input is too sparse to safely infer a branded bottle identity.",
  },
  {
    id: "macallan-double-cask",
    inputName: "Macallan Double Cask",
    expectedBottleName: "Macallan Double Cask",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Keep Double Cask as bottle-level identity and avoid creating a child release from stable marketed family wording.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Stable product wording, not a release split.",
  },
  {
    id: "woodford-double-oaked",
    inputName: "Woodford Reserve Double Oaked",
    expectedBottleName: "Woodford Reserve Double Oaked",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Treat Woodford Reserve Double Oaked as a distinct bottle identity and avoid mutating it into the separate Double Double Oaked sibling.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Real sibling bottle family where the repeated Double token is meaningful bottle identity, not release structure.",
  },
  {
    id: "woodford-double-double-oaked",
    inputName: "Woodford Reserve Double Double Oaked",
    expectedBottleName: "Woodford Reserve Double Double Oaked",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Treat Woodford Reserve Double Double Oaked as its own bottle identity and do not collapse the repeated Double wording into Double Oaked.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Real sibling bottle family where repeated marketed wording must be preserved rather than deduped.",
  },
  {
    id: "glenallachie-sherry-cask",
    inputName: "Glenallachie Sherry Cask",
    expectedBottleName: "Glenallachie Sherry Cask",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Stable product wording, not a release split by itself.",
  },
  {
    id: "elijah-craig-cask-strength",
    inputName: "Elijah Craig Cask Strength",
    expectedBottleName: "Elijah Craig Barrel Proof",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Normalize Elijah Craig Cask Strength shorthand to the canonical Elijah Craig Barrel Proof bottle family unless there is an actual batch code or release marker.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Common shorthand should normalize to the canonical Elijah Craig Barrel Proof bottle family unless a real batch code is present.",
  },
  {
    id: "elijah-craig-barrel-proof-family",
    inputName: "Elijah Craig Barrel Proof",
    expectedBottleName: "Elijah Craig Barrel Proof",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "The Barrel Proof family is bottle identity on its own; only stable batch codes such as C923 should become release identity.",
  },
  {
    id: "elijah-craig-barrel-proof-batch-c923",
    inputName: "Elijah Craig Barrel Proof Batch C923",
    expectedBottleName: "Elijah Craig Barrel Proof",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "deterministic_safe",
      classifierExpectation: "bottle_plus_release",
      deterministicReleaseExpectation: "strong_release_marker",
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
    contrastGroup: "single_barrel_strength_wording",
    contrastOutcome: "keep_bottle",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes: "Generic single-barrel wording is bottle identity here.",
  },
  {
    id: "four-roses-single-barrel-barrel-strength",
    inputName: "Four Roses Single Barrel Barrel Strength",
    expectedBottleName: "Four Roses Single Barrel",
    contrastGroup: "single_barrel_strength_wording",
    contrastOutcome: "block",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Treat Four Roses Single Barrel Barrel Strength as too ambiguous for a confident canonical split and avoid promoting generic strength wording into release identity by itself.",
    expectation: {
      handlingStrategy: "block_if_uncertain",
      classifierExpectation: "review_required",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Needs classifier or moderator review. Strength wording alone should not force a release split.",
  },
  {
    id: "smws-code-bottle",
    inputName: "SMWS 6.53",
    expectedBottleName: "SMWS 6.53",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "deterministic_safe",
      classifierExpectation: "exact_cask",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "SMWS code is marketed exact-cask identity, not bottle plus child release.",
  },
  {
    id: "octomore-dot-expression",
    inputName: "Octomore 13.1",
    expectedBottleName: "Octomore 13.1",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Treat Octomore 13.1 as a distinct bottle identity, not as Octomore 13 with a child release.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Dot expressions are distinct bottles, not child releases of Octomore 13.",
  },
  {
    id: "glen-scotia-double-cask-classic",
    inputName: "Glen Scotia Double Cask Classic",
    expectedBottleName: "Glen Scotia Double Cask Classic",
    peatedBottleIds: [2050],
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Real Peated bottle family showing that Double Cask wording can be stable bottle identity rather than a release split.",
  },
  {
    id: "1792-single-barrel",
    inputName: "1792 Single Barrel",
    expectedBottleName: "1792 Single Barrel",
    peatedBottleIds: [16051],
    contrastGroup: "single_barrel_strength_wording",
    contrastOutcome: "keep_bottle",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Keep 1792 Single Barrel as bottle identity and avoid over-promoting generic single-barrel wording into exact-cask or release identity.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Real Peated bottle family showing that Single Barrel wording alone is still bottle identity.",
  },
  {
    id: "pinhook-vertical-single-barrel-wording",
    inputName: "Pinhook 8-year-old - The Single Barrel / Vertical",
    expectedBottleName: "Pinhook 8-year-old",
    peatedBottleIds: [43683],
    contrastGroup: "single_barrel_strength_wording",
    contrastOutcome: "block",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "review_required",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Real Peated family where freeform single-barrel program wording should not let deterministic repair peel the bottle into a reusable parent plus child release.",
  },
  {
    id: "talisker-distillers-edition-2001",
    inputName: "Talisker 2001 The Distillers Edition",
    expectedBottleName: "Talisker The Distillers Edition",
    peatedBottleIds: [4552],
    contrastGroup: "distillers_edition",
    contrastOutcome: "split_release",
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Treat Talisker 2001 The Distillers Edition as a year-specific release under a stable Distillers Edition bottle family instead of folding the year into the bottle name.",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle_plus_release",
      deterministicReleaseExpectation: "none",
      releaseIdentity: {
        edition: null,
        releaseYear: 2001,
      },
    },
    notes:
      "Real Peated Distillers Edition sibling. The year is release identity, but the year-first wording should stay classifier-owned rather than heuristic-owned.",
  },
  {
    id: "caol-ila-distillers-edition-2003",
    inputName: "Caol Ila 2003 The Distillers Edition",
    expectedBottleName: "Caol Ila The Distillers Edition",
    peatedBottleIds: [3722],
    contrastGroup: "distillers_edition",
    contrastOutcome: "split_release",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle_plus_release",
      deterministicReleaseExpectation: "none",
      releaseIdentity: {
        edition: null,
        releaseYear: 2003,
      },
    },
    notes:
      "Real Peated sibling for the Distillers Edition family. Kept out of live evals because Talisker already covers the same ambiguous year-first pattern.",
  },
  {
    id: "caol-ila-distillers-edition-1998",
    inputName: "Caol Ila 1998 The Distillers Edition",
    expectedBottleName: "Caol Ila The Distillers Edition",
    peatedBottleIds: [4596],
    contrastGroup: "distillers_edition",
    contrastOutcome: "split_release",
    liveEvalCoverage: "skip",
    expectation: {
      handlingStrategy: "classifier_required",
      classifierExpectation: "bottle_plus_release",
      deterministicReleaseExpectation: "none",
      releaseIdentity: {
        edition: null,
        releaseYear: 1998,
      },
    },
    notes:
      "Additional real Peated Distillers Edition sibling. It broadens the corpus without spending more live eval budget on the same family pattern.",
  },
  {
    id: "smws-code-with-name",
    inputName: "SMWS 72.123 Big moves and subtle details",
    expectedBottleName: "SMWS 72.123",
    peatedBottleIds: [43670],
    liveEvalCoverage: "required",
    liveEvalSummary:
      "Preserve the SMWS 72.123 code as the canonical exact-cask bottle identity and treat the cask subtitle as observation-only detail.",
    expectation: {
      handlingStrategy: "deterministic_safe",
      classifierExpectation: "exact_cask",
      deterministicReleaseExpectation: "none",
      releaseIdentity: null,
    },
    notes:
      "Real Peated SMWS bottle showing that the marketed cask name is observation detail, while the SMWS code remains the canonical exact-cask identity.",
  },
];

export const BOTTLE_NORMALIZATION_CORPUS_BY_ID = new Map(
  BOTTLE_NORMALIZATION_CORPUS.map((example) => [example.id, example]),
);
