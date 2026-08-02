import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  BottleCandidateSchema,
  BottleCandidateSearchInputSchema,
  BottleClassificationDecisionSchema,
  BottleClassifierAgentDecisionSchema,
  BottleExtractedDetailsSchema,
  MAX_BOTTLE_CANDIDATES,
  ProposedBottleSchema,
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
    expect(jsonSchema.properties?.parentBottleId).toBeUndefined();
    expect(jsonSchema.properties?.proposedRelease).toBeUndefined();
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

  test("bounds model-declared candidate ids to the existing search ceiling", () => {
    const candidateBottleIds = Array.from(
      { length: MAX_BOTTLE_CANDIDATES + 1 },
      (_, index) => index + 1,
    );

    expect(
      BottleClassifierAgentDecisionSchema.safeParse({
        action: "no_match",
        candidateBottleIds,
      }).success,
    ).toBe(false);
    expect(
      BottleClassificationDecisionSchema.safeParse({
        action: "no_match",
        candidateBottleIds,
      }).success,
    ).toBe(false);
  });

  test("parses identity basis and candidate family context", () => {
    const candidate = BottleCandidateSchema.parse({
      bottleId: 100,
      fullName: "Example 18-year-old",
      familyContext: {
        siblingBottles: [
          {
            bottleId: 101,
            fullName: "Example 21-year-old",
            traitFields: ["statedAge"],
            statedAge: 21,
          },
        ],
      },
    });
    const decision = BottleClassifierAgentDecisionSchema.parse({
      action: "create_bottle",
      rationale: "The source identifies a complete 1994 Vintage Bottle.",
      candidateBottleIds: [100],
      identityScope: "product",
      aliasScope: "none",
      observation: null,
      identityBasis: {
        bottleTraits: ["brand", "18-year-old"],
        releaseTraits: ["1994 vintage"],
        observationTraits: [],
        yearInterpretation: "vintage_year",
        siblingEvidence: "existing_sibling_bottles",
        uncertainties: [],
      },
      confidenceBasis: {
        positiveEvidence: ["local related Bottle candidate exists"],
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
      proposedBottle: {
        name: "18-year-old 1994 Vintage",
        brand: { id: null, name: "Example" },
        statedAge: 18,
        vintageYear: 1994,
      },
    });

    expect(candidate.familyContext?.siblingBottles[0]?.statedAge).toBe(21);
    expect(decision.identityBasis?.yearInterpretation).toBe("vintage_year");
  });

  test("preserves structured cask fields at classifier boundaries", () => {
    expect(
      BottleExtractedDetailsSchema.parse({
        cask_type: "oloroso",
        cask_size: "hogshead",
        cask_fill: "1st_fill",
      }),
    ).toMatchObject({
      cask_type: "oloroso",
      cask_size: "hogshead",
      cask_fill: "1st_fill",
    });
    expect(
      BottleCandidateSchema.parse({
        bottleId: 1,
        fullName: "Example",
        caskType: "oloroso",
        caskSize: "hogshead",
        caskFill: "1st_fill",
      }),
    ).toMatchObject({
      caskType: "oloroso",
      caskSize: "hogshead",
      caskFill: "1st_fill",
    });
    expect(
      BottleCandidateSearchInputSchema.parse({
        cask_type: "oloroso",
        cask_size: "hogshead",
        cask_fill: "1st_fill",
      }),
    ).toMatchObject({
      cask_type: "oloroso",
      cask_size: "hogshead",
      cask_fill: "1st_fill",
    });
    expect(
      ProposedBottleSchema.parse({
        name: "Example",
        brand: { id: null, name: "Example" },
        caskType: "oloroso",
        caskSize: "hogshead",
        caskFill: "1st_fill",
      }),
    ).toMatchObject({
      caskType: "oloroso",
      caskSize: "hogshead",
      caskFill: "1st_fill",
    });
  });

  test.each(["matchedReleaseId", "parentBottleId", "proposedRelease"] as const)(
    "rejects obsolete decision field %s",
    (field) => {
      const agentDecision = {
        action: "no_match" as const,
        rationale: null,
        candidateBottleIds: [],
        identityScope: null,
        aliasScope: null,
        observation: null,
        identityBasis: null,
        confidenceBasis: null,
        matchedBottleId: null,
        proposedBottle: null,
      };
      const finalizedDecision = {
        action: "no_match" as const,
        candidateBottleIds: [],
        matchedBottleId: null,
        proposedBottle: null,
      };

      expect(
        BottleClassifierAgentDecisionSchema.safeParse({
          ...agentDecision,
          [field]: null,
        }).success,
      ).toBe(false);
      expect(
        BottleClassificationDecisionSchema.safeParse({
          ...finalizedDecision,
          [field]: null,
        }).success,
      ).toBe(false);
    },
  );

  test.each([
    "create_release",
    "create_bottle_and_release",
    "repair_parent_and_create_release",
  ])("rejects obsolete live action %s", (action) => {
    const otherwiseValidAgentDecision = {
      action: "no_match" as const,
      rationale: null,
      candidateBottleIds: [],
      identityScope: null,
      aliasScope: null,
      observation: null,
      identityBasis: null,
      confidenceBasis: null,
      matchedBottleId: null,
      proposedBottle: null,
    };
    const otherwiseValidPersistedDecision = {
      ...otherwiseValidAgentDecision,
      identityScope: "product" as const,
      aliasScope: undefined,
    };

    expect(
      BottleClassifierAgentDecisionSchema.safeParse(otherwiseValidAgentDecision)
        .success,
    ).toBe(true);
    expect(
      BottleClassificationDecisionSchema.safeParse(
        otherwiseValidPersistedDecision,
      ).success,
    ).toBe(true);
    expect(
      BottleClassifierAgentDecisionSchema.safeParse({
        ...otherwiseValidAgentDecision,
        action,
      }).success,
    ).toBe(false);
    expect(
      BottleClassificationDecisionSchema.safeParse({
        ...otherwiseValidPersistedDecision,
        action,
      }).success,
    ).toBe(false);
  });
});
