import { describe, expect, test } from "vitest";
import {
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
  isIgnoredBottleClassification,
} from "./contract";

describe("bottleClassifier contract", () => {
  test("parses the generic classifier input shape", () => {
    const parsed = ClassifyBottleReferenceInputSchema.parse({
      reference: {
        id: "listing-1",
        name: "Glenmorangie Quinta Ruban 14-year-old",
        url: "https://example.com/products/quinta-ruban",
        currentBottleId: null,
        currentReleaseId: null,
      },
    });

    expect(parsed.reference.name).toBe("Glenmorangie Quinta Ruban 14-year-old");
    expect(parsed.candidateExpansion).toBe("open");
  });

  test("parses closed-set candidate expansion mode", () => {
    const parsed = ClassifyBottleReferenceInputSchema.parse({
      reference: {
        name: "Warehouse Session (Batch 2)",
      },
      candidateExpansion: "initial_only",
    });

    expect(parsed.candidateExpansion).toBe("initial_only");
  });

  test("builds discriminated results with normalized artifacts", () => {
    const ignored = createIgnoredBottleClassification({
      reason: "non-whisky",
      artifacts: {},
    });
    const classified = createDecidedBottleClassification({
      decision: {
        action: "no_match",
        confidence: 72,
        rationale: "Not enough identity evidence.",
        candidateBottleIds: [],
        identityScope: "product",
        observation: null,
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      },
      artifacts: {
        candidates: [],
      },
    });

    expect(isIgnoredBottleClassification(ignored)).toBe(true);
    expect(BottleClassificationResultSchema.parse(classified)).toMatchObject({
      status: "classified",
      artifacts: {
        candidates: [],
        searchEvidence: [],
      },
    });
  });
});
