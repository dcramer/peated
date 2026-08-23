import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  BottleCandidateSchema,
  BottleCandidateSearchInputSchema,
  BottleClassificationDecisionSchema,
  BottleClassifierActionSchema,
  BottleClassifierAgentDecisionSchema,
  BottleExtractedDetailsSchema,
  MAX_BOTTLE_CANDIDATES,
  ProposedBottleFields,
  ProposedBottleSchema,
} from "./classifierTypes";

const AgentDecisionJsonSchema = z
  .object({
    type: z.string().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    required: z.array(z.string()).optional(),
    anyOf: z.array(z.unknown()).optional(),
    oneOf: z.array(z.unknown()).optional(),
    additionalProperties: z.boolean().optional(),
  })
  .passthrough();

describe("BottleClassifierAgentDecisionSchema", () => {
  test("defines proposed Bottle names at the field boundary", () => {
    expect(ProposedBottleFields.name.description).toContain(
      "Stable marketed expression relative to the Brand",
    );
    expect(ProposedBottleFields.name.description).toContain(
      "When no separate expression is marketed, use the source-supported product or style phrase",
    );
  });

  test("uses a flat structured-output schema at the root", () => {
    const jsonSchema = AgentDecisionJsonSchema.parse(
      z.toJSONSchema(BottleClassifierAgentDecisionSchema),
    );

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

  test("asks for evidence and rationale before the decision", () => {
    const jsonSchema = AgentDecisionJsonSchema.parse(
      z.toJSONSchema(BottleClassifierAgentDecisionSchema),
    );
    const fields = Object.keys(jsonSchema.properties ?? {});

    expect(fields.slice(0, 3)).toEqual([
      "confidenceBasis",
      "rationale",
      "action",
    ]);
    expect(fields.indexOf("action")).toBeLessThan(
      fields.indexOf("matchedBottleId"),
    );
    expect(fields.indexOf("action")).toBeLessThan(
      fields.indexOf("proposedBottle"),
    );
  });

  test("exposes only the three identity results", () => {
    expect(BottleClassifierActionSchema.options).toEqual([
      "match",
      "create_bottle",
      "no_match",
    ]);
  });

  test("rejects model-reported tool telemetry", () => {
    expect(
      BottleClassifierAgentDecisionSchema.safeParse({
        action: "no_match",
        confidenceBasis: {
          unresolvedRisks: [],
          toolsUsed: ["search_bottles"],
          webEvidence: "not_used",
        },
      }).success,
    ).toBe(false);
  });

  test("rejects model-reported positive evidence", () => {
    expect(
      BottleClassifierAgentDecisionSchema.safeParse({
        action: "no_match",
        confidenceBasis: {
          positiveEvidence: ["The source title supports the decision."],
          unresolvedRisks: [],
          webEvidence: "not_used",
        },
      }).success,
    ).toBe(false);
  });

  test.each([
    ["bottleNumber", "144 of 240"],
    ["outturn", 240],
    ["market", "US"],
    ["exclusive", "travel retail"],
  ] as const)("rejects obsolete observation field %s", (field, value) => {
    expect(
      BottleClassifierAgentDecisionSchema.safeParse({
        action: "no_match",
        observation: { [field]: value },
      }).success,
    ).toBe(false);
    expect(
      BottleClassificationDecisionSchema.safeParse({
        action: "no_match",
        candidateBottleIds: [],
        observation: { [field]: value },
      }).success,
    ).toBe(false);
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

  test("parses candidate family context and confidence evidence", () => {
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
      confidenceBasis: {
        unresolvedRisks: [
          {
            category: "release_ambiguity",
            note: "new vintage release needs review",
          },
        ],
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
    expect(decision.confidenceBasis?.unresolvedRisks).toEqual([
      {
        category: "release_ambiguity",
        note: "new vintage release needs review",
      },
    ]);
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

  test.each([
    "identityBasis",
    "matchedReleaseId",
    "parentBottleId",
    "proposedRelease",
  ] as const)("rejects obsolete decision field %s", (field) => {
    const agentDecision = {
      action: "no_match" as const,
      rationale: null,
      candidateBottleIds: [],
      identityScope: null,
      aliasScope: null,
      observation: null,
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
  });

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
