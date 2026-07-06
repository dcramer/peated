import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  BottleCandidateSchema,
  BottleCandidateSearchInputSchema,
  BottleClassificationDecisionSchema,
  BottleClassifierAgentDecisionSchema,
  BottleExtractedDetailsSchema,
  ProposedBottleSchema,
  ProposedReleaseSchema,
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

  test("accepts legacy decisions without alias metadata", () => {
    const decision = BottleClassificationDecisionSchema.parse({
      action: "no_match",
      candidateBottleIds: [],
    });

    expect(decision.aliasScope).toBeUndefined();
  });

  test("accepts explicit alias scope values", () => {
    expect(
      BottleClassificationDecisionSchema.safeParse({
        action: "match",
        candidateBottleIds: [123],
        matchedBottleId: 123,
        aliasScope: "global_alias",
      }).success,
    ).toBe(true);

    expect(
      BottleClassifierAgentDecisionSchema.safeParse({
        action: "match",
        candidateBottleIds: [123],
        identityScope: "product",
        aliasScope: "none",
        matchedBottleId: 123,
      }).success,
    ).toBe(true);
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
        siblingBottles: [
          {
            bottleId: 101,
            fullName: "Example 21-year-old",
            traitFields: ["statedAge"],
            statedAge: 21,
          },
        ],
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
      rationale: "A second vintage establishes the reusable parent.",
      candidateBottleIds: [100],
      identityScope: "product",
      aliasScope: "none",
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
        positiveEvidence: ["local parent candidate exists"],
        unresolvedRisks: [
          {
            category: "release_ambiguity",
            note: "new vintage release needs review",
          },
        ],
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
    expect(candidate.familyContext?.siblingBottles[0]?.statedAge).toBe(21);
    expect(decision.identityBasis?.yearInterpretation).toBe("vintage_year");
  });

  test("rejects removed structured cask fields at classifier boundaries", () => {
    expect(
      BottleExtractedDetailsSchema.safeParse({ cask_type: "Sherry" }).success,
    ).toBe(false);
    expect(
      BottleCandidateSchema.safeParse({
        bottleId: 1,
        fullName: "Example",
        caskType: "Sherry",
      }).success,
    ).toBe(false);
    expect(
      BottleCandidateSearchInputSchema.safeParse({ cask_type: "Sherry" })
        .success,
    ).toBe(false);
    expect(
      ProposedBottleSchema.safeParse({
        name: "Example",
        brand: { id: null, name: "Example" },
        caskType: "Sherry",
      }).success,
    ).toBe(false);
    expect(
      ProposedReleaseSchema.safeParse({ caskType: "Sherry" }).success,
    ).toBe(false);
  });

  test("parses parent repair plus release creation decisions", () => {
    const decision = BottleClassificationDecisionSchema.parse({
      action: "repair_parent_and_create_release",
      rationale:
        "The existing parent has a bottle-level age that must move before adding the sibling age statement.",
      candidateBottleIds: [44175],
      parentBottleId: 44175,
      proposedBottle: {
        name: "Speyside",
        brand: {
          id: 3943,
          name: "Shieldaig",
        },
        category: "single_malt",
        statedAge: null,
      },
      proposedRelease: {
        statedAge: 21,
      },
    });

    expect(decision).toMatchObject({
      action: "repair_parent_and_create_release",
      parentBottleId: 44175,
      matchedBottleId: null,
      proposedBottle: {
        name: "Speyside",
        statedAge: null,
      },
      proposedRelease: {
        statedAge: 21,
      },
    });
  });
});
