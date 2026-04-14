import type { BottleCandidate } from "./classifierTypes";
import type { ClassifyBottleReferenceInput } from "./contract";
import {
  buildBottleCandidate,
  buildExtractedIdentity,
  buildLegacyReleaseRepairParentCandidate,
} from "./evalFixtureBuilders";
import type { LegacyReleaseRepairParentCandidate } from "./legacyReleaseRepairIdentity";
import type { LegacyReleaseRepairClassifierBlockedReason } from "./legacyReleaseRepairResolution";
import {
  BOTTLE_NORMALIZATION_CORPUS_BY_ID,
  type BottleNormalizationCorpusExample,
} from "./normalizationCorpus";

export type LegacyReleaseRepairResolutionEvalCase = {
  corpusExampleId?: string;
  input: ClassifyBottleReferenceInput;
  name: string;
  reviewedParentRows: LegacyReleaseRepairParentCandidate[];
  expected: {
    blockedReason?: LegacyReleaseRepairClassifierBlockedReason;
    parentBottleId?: number;
    resolution: "allow_create_parent" | "blocked" | "reuse_existing_parent";
    summary: string;
  };
};

function requireCorpusExample(id: string): BottleNormalizationCorpusExample {
  const example = BOTTLE_NORMALIZATION_CORPUS_BY_ID.get(id);

  if (!example) {
    throw new Error(`Unknown bottle normalization corpus example: ${id}`);
  }

  return example;
}

function buildReviewedParent(
  candidate: Parameters<typeof buildLegacyReleaseRepairParentCandidate>[0] & {
    brand?: string | null;
  },
): {
  candidate: BottleCandidate;
  parentRow: LegacyReleaseRepairParentCandidate;
} {
  const parentRow = buildLegacyReleaseRepairParentCandidate(candidate);

  return {
    candidate: buildBottleCandidate({
      bottleId: parentRow.id,
      fullName: parentRow.fullName,
      brand: candidate.brand ?? null,
      category: parentRow.category,
      statedAge: parentRow.statedAge,
      edition: parentRow.edition,
      caskStrength: parentRow.caskStrength,
      singleCask: parentRow.singleCask,
      abv: parentRow.abv,
      vintageYear: parentRow.vintageYear,
      releaseYear: parentRow.releaseYear,
      caskType: parentRow.caskType,
      caskSize: parentRow.caskSize,
      caskFill: parentRow.caskFill,
      score: null,
      source: ["repair_parent"],
    }),
    parentRow,
  };
}

function buildRepairEvalCase({
  corpusExampleId,
  expected,
  extractedIdentity,
  initialCandidates,
  name,
  referenceName,
  reviewedParentRows,
}: {
  corpusExampleId?: string;
  expected: LegacyReleaseRepairResolutionEvalCase["expected"];
  extractedIdentity?: ClassifyBottleReferenceInput["extractedIdentity"];
  initialCandidates?: BottleCandidate[];
  name: string;
  referenceName?: string;
  reviewedParentRows: LegacyReleaseRepairParentCandidate[];
}): LegacyReleaseRepairResolutionEvalCase {
  const corpusExample = corpusExampleId
    ? requireCorpusExample(corpusExampleId)
    : null;

  return {
    corpusExampleId,
    input: {
      reference: {
        name: corpusExample?.inputName ?? referenceName ?? name,
      },
      extractedIdentity,
      initialCandidates,
    },
    name,
    reviewedParentRows,
    expected,
  };
}

const makersPrivateSelectionParent = buildReviewedParent({
  id: 730,
  fullName: "Maker's Mark Private Selection",
  brand: "Maker's Mark",
  category: "bourbon",
});

const cadbollDirtyLegacyBottle = buildReviewedParent({
  id: 661,
  fullName: "Glenmorangie The Cadboll Estate 15-year-old (Batch 4)",
  brand: "Glenmorangie",
  category: "single_malt",
  statedAge: 15,
  edition: "Batch 4",
});

const smwsExistingBottle = buildReviewedParent({
  id: 650,
  fullName: "SMWS 41.176 Baristaliscious",
  brand: "The Scotch Malt Whisky Society",
  category: "single_malt",
  statedAge: 17,
  singleCask: true,
});

const taliskerDistillersEditionParent = buildReviewedParent({
  id: 740,
  fullName: "Talisker The Distillers Edition",
  brand: "Talisker",
  category: "single_malt",
});

export const LEGACY_RELEASE_REPAIR_RESOLUTION_EVAL_CASES: LegacyReleaseRepairResolutionEvalCase[] =
  [
    buildRepairEvalCase({
      corpusExampleId: "talisker-distillers-edition-2001",
      name: "repair resolution: reuses a stable Distillers Edition parent for year-first releases",
      extractedIdentity: buildExtractedIdentity({
        brand: "Talisker",
        category: "single_malt",
        release_year: 2001,
      }),
      initialCandidates: [taliskerDistillersEditionParent.candidate],
      reviewedParentRows: [taliskerDistillersEditionParent.parentRow],
      expected: {
        resolution: "reuse_existing_parent",
        parentBottleId: 740,
        summary:
          "A year-first Distillers Edition sibling should resolve to the reusable Talisker The Distillers Edition parent bottle rather than forcing create-parent.",
      },
    }),
    buildRepairEvalCase({
      corpusExampleId: "makers-private-selection-code",
      name: "repair resolution: reuses the Private Selection parent for program-coded releases",
      extractedIdentity: buildExtractedIdentity({
        brand: "Maker's Mark",
        category: "bourbon",
        edition: "S2B13",
      }),
      initialCandidates: [makersPrivateSelectionParent.candidate],
      reviewedParentRows: [makersPrivateSelectionParent.parentRow],
      expected: {
        resolution: "reuse_existing_parent",
        parentBottleId: 730,
        summary:
          "Treat the stave code as release identity under the reusable Maker's Mark Private Selection parent bottle.",
      },
    }),
    buildRepairEvalCase({
      corpusExampleId: "elijah-craig-barrel-proof-batch-c923",
      name: "repair resolution: allows create-parent when no reusable parent bottle exists",
      extractedIdentity: buildExtractedIdentity({
        brand: "Elijah Craig",
        category: "bourbon",
        stated_age: 12,
        cask_strength: true,
        edition: "Batch C923",
      }),
      reviewedParentRows: [],
      expected: {
        resolution: "allow_create_parent",
        summary:
          "When no clean reusable parent bottle is available, the repair boundary may allow create-parent rather than forcing an unsafe reuse.",
      },
    }),
    buildRepairEvalCase({
      corpusExampleId: "smws-code-bottle",
      name: "repair resolution: blocks exact-cask SMWS identity from reusable-parent repair",
      extractedIdentity: buildExtractedIdentity({
        brand: "The Scotch Malt Whisky Society",
        bottler: "The Scotch Malt Whisky Society",
        category: "single_malt",
        single_cask: true,
      }),
      initialCandidates: [smwsExistingBottle.candidate],
      reviewedParentRows: [smwsExistingBottle.parentRow],
      expected: {
        resolution: "blocked",
        blockedReason: "classifier_exact_cask",
        summary:
          "SMWS program codes are exact-cask identity and should block reusable-parent repair logic.",
      },
    }),
    buildRepairEvalCase({
      name: "repair resolution: blocks dirty legacy batch bottles even when the classifier matches them",
      referenceName: "Glenmorangie The Cadboll Estate 15-year-old (Batch 4)",
      extractedIdentity: buildExtractedIdentity({
        brand: "Glenmorangie",
        category: "single_malt",
        stated_age: 15,
        edition: "Batch 4",
      }),
      initialCandidates: [cadbollDirtyLegacyBottle.candidate],
      reviewedParentRows: [cadbollDirtyLegacyBottle.parentRow],
      expected: {
        resolution: "blocked",
        blockedReason: "classifier_dirty_parent_candidate",
        summary:
          "A matched legacy batch bottle is still not a safe reusable parent because it stores release identity on the bottle itself.",
      },
    }),
  ];
