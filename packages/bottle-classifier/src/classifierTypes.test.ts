import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  BottleCandidateSchema,
  BottleClassificationDecisionSchema,
  BottleClassifierAgentDecisionSchema,
} from "./classifierTypes";

describe("BottleClassifierAgentDecisionSchema", () => {
  test("uses a flat structured-output schema at the root", () => {
    const jsonSchema = z.toJSONSchema(BottleClassifierAgentDecisionSchema) as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
      anyOf?: unknown[];
      oneOf?: unknown[];
      additionalProperties?: boolean;
    };

    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.additionalProperties).toBe(false);
    expect(jsonSchema.oneOf).toBeUndefined();
    expect(jsonSchema.anyOf).toBeUndefined();
    expect(jsonSchema.properties?.decision).toBeUndefined();
    expect((jsonSchema.required ?? []).sort()).toEqual(
      Object.keys(jsonSchema.properties ?? {}).sort(),
    );
  });

  test("parses first-class existing-bottle repair decisions", () => {
    const decision = BottleClassificationDecisionSchema.parse({
      action: "repair_bottle",
      confidence: 91,
      rationale: "Bottle identity matches, but distillery metadata is wrong.",
      candidateBottleIds: [123],
      matchedBottleId: 123,
      proposedBottle: {
        name: "Bodega Cask",
        brand: {
          id: 456,
          name: "The Whistler",
        },
        distillers: [
          {
            id: 789,
            name: "Boann Distillery",
          },
        ],
      },
    });

    expect(decision).toMatchObject({
      action: "repair_bottle",
      matchedBottleId: 123,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedRelease: null,
      proposedBottle: {
        category: null,
        distillers: [
          {
            name: "Boann Distillery",
          },
        ],
      },
    });
  });

  test("parses identity basis and candidate family context", () => {
    const candidate = BottleCandidateSchema.parse({
      kind: "bottle",
      bottleId: 100,
      releaseId: null,
      fullName: "Example 18-year-old",
      familyContext: {
        parentBottleReleaseTraits: ["vintageYear"],
        childReleaseCount: 2,
        siblingReleases: [
          {
            releaseId: 200,
            fullName: "Example 18-year-old 1993 Vintage",
            traitFields: ["vintageYear"],
            vintageYear: 1993,
          },
        ],
      },
    });
    const decision = BottleClassifierAgentDecisionSchema.parse({
      action: "create_release",
      confidence: 88,
      rationale: "A second vintage establishes the reusable parent.",
      candidateBottleIds: [100],
      identityScope: "product",
      observation: null,
      identityBasis: {
        bottleTraits: ["brand", "18-year-old"],
        releaseTraits: ["1994 vintage"],
        observationTraits: [],
        yearInterpretation: "vintage_year",
        siblingEvidence: "existing_child_releases",
        uncertainties: [],
      },
      confidenceBasis: {
        band: "review",
        positiveEvidence: ["local parent candidate exists"],
        unresolvedRisks: ["new vintage release needs review"],
        toolsUsed: ["initial_local_candidates"],
        webEvidence: "not_used",
      },
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: 100,
      proposedBottle: null,
      proposedRelease: {
        vintageYear: 1994,
      },
    });

    expect(candidate.familyContext?.siblingReleases[0]?.vintageYear).toBe(1993);
    expect(decision.identityBasis?.yearInterpretation).toBe("vintage_year");
    expect(decision.confidenceBasis?.band).toBe("review");
  });
});
