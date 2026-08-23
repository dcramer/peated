import { describe, expect, test } from "vitest";

import {
  PriceMatchCandidateSchema,
  PriceMatchSearchEvidenceSchema,
  StorePriceMatchDecisionSchema,
  StorePriceMatchProposalSchema,
  StorePriceMatchQueueItemSchema,
} from "./priceMatches";

const baseProposedBottle = {
  name: "Example Bottle",
  series: null,
  category: "single_malt" as const,
  edition: null,
  statedAge: null,
  caskStrength: null,
  singleCask: null,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
  brand: {
    id: null,
    name: "Example Brand",
  },
  distillers: [],
  bottler: null,
};

describe("PriceMatchCandidateSchema", () => {
  test("accepts independently complete Bottle candidates", () => {
    const candidate = PriceMatchCandidateSchema.parse({
      bottleId: 10,
      fullName: "Example Bottle Batch 2",
      edition: "Batch 2",
      familyContext: {
        siblingBottles: [
          {
            bottleId: 11,
            fullName: "Example Bottle Batch 1",
            traitFields: ["edition"],
            edition: "Batch 1",
          },
        ],
      },
    });

    expect(candidate).toMatchObject({
      bottleId: 10,
      edition: "Batch 2",
      familyContext: {
        siblingBottles: [{ bottleId: 11, edition: "Batch 1" }],
      },
    });
  });

  test.each([
    { kind: "release" },
    {
      familyContext: {
        siblingBottles: [],
        siblingReleases: [{ fullName: "Legacy release" }],
      },
    },
  ])("rejects legacy release candidate shape %o", (legacyFields) => {
    expect(
      PriceMatchCandidateSchema.safeParse({
        bottleId: 10,
        fullName: "Current Bottle",
        ...legacyFields,
      }).success,
    ).toBe(false);
  });

  test("rejects unknown candidate fields", () => {
    expect(
      PriceMatchCandidateSchema.safeParse({
        bottleId: 10,
        fullName: "Current Bottle",
        caskTyp: "bourbon",
      }).success,
    ).toBe(false);
  });
});

describe("StorePriceMatchDecisionSchema", () => {
  test("normalizes retained Brave search evidence providers on read", () => {
    const parsed = PriceMatchSearchEvidenceSchema.parse({
      provider: "brave",
      query: "example bottle",
      summary: "Retained search evidence",
      results: [],
    });

    expect(parsed.provider).toBe("openai");
  });

  test("accepts the four direct-Bottle decisions", () => {
    expect(
      StorePriceMatchDecisionSchema.parse({
        action: "match_existing",
        suggestedBottleId: 123,
        aliasScope: "global_alias",
      }),
    ).toMatchObject({
      action: "match_existing",
      suggestedBottleId: 123,
      proposedBottle: null,
    });
    expect(
      StorePriceMatchDecisionSchema.parse({
        action: "correction",
        suggestedBottleId: 123,
        proposedBottle: baseProposedBottle,
      }),
    ).toMatchObject({
      action: "correction",
      suggestedBottleId: 123,
      proposedBottle: baseProposedBottle,
    });
    expect(
      StorePriceMatchDecisionSchema.parse({
        action: "create_new",
        proposedBottle: baseProposedBottle,
      }),
    ).toMatchObject({
      action: "create_new",
      suggestedBottleId: null,
      proposedBottle: baseProposedBottle,
    });
    expect(
      StorePriceMatchDecisionSchema.parse({
        action: "no_match",
      }),
    ).toMatchObject({
      action: "no_match",
      suggestedBottleId: null,
      proposedBottle: null,
    });
  });

  test.each([
    "suggestedReleaseId",
    "parentBottleId",
    "creationTarget",
    "proposedRelease",
  ])("rejects obsolete release decision field %s", (field) => {
    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "no_match",
        [field]: null,
      }).success,
    ).toBe(false);
  });

  test.each([
    "create_release",
    "create_bottle_and_release",
    "repair_parent",
    "repair_parent_and_create_release",
  ])("rejects obsolete decision action %s", (action) => {
    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action,
        suggestedBottleId: null,
        proposedBottle: null,
      }).success,
    ).toBe(false);
  });

  test("requires a Bottle id for existing matches and corrections", () => {
    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "match_existing",
      }).success,
    ).toBe(false);
    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "correction",
        proposedBottle: null,
      }).success,
    ).toBe(false);
  });

  test("requires one complete Bottle draft for creation", () => {
    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "create_new",
        proposedBottle: null,
      }).success,
    ).toBe(false);
    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "create_new",
        proposedBottle: baseProposedBottle,
      }).success,
    ).toBe(true);
  });

  test("parses correction age as a direct Bottle field", () => {
    const repair = StorePriceMatchDecisionSchema.parse({
      action: "correction",
      suggestedBottleId: 1,
      proposedBottle: {
        ...baseProposedBottle,
        statedAge: 12,
      },
    });

    expect(repair.proposedBottle).toMatchObject({ statedAge: 12 });
  });

  test("rejects fractional entity ids in Bottle drafts", () => {
    const result = StorePriceMatchDecisionSchema.safeParse({
      action: "create_new",
      proposedBottle: {
        ...baseProposedBottle,
        series: {
          id: 0.92,
          name: "Example Series",
        },
        brand: {
          id: 1,
          name: "Example Brand",
        },
        distillers: [
          {
            id: 0.92,
            name: "Example Distillery",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected Bottle draft validation to fail.");
    }
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["proposedBottle", "series", "id"],
        }),
        expect.objectContaining({
          path: ["proposedBottle", "distillers", 0, "id"],
        }),
      ]),
    );
  });
});

describe("StorePriceMatchQueueItemSchema", () => {
  test("exposes only direct Bottle identities", () => {
    const queueItemFields = StorePriceMatchQueueItemSchema.keyof().options;
    const proposalFields = StorePriceMatchProposalSchema.keyof().options;

    expect(queueItemFields).toContain("currentBottle");
    expect(queueItemFields).toContain("suggestedBottle");

    for (const field of [
      "currentTarget",
      "currentRelease",
      "suggestedTarget",
      "suggestedRelease",
      "parentBottle",
    ]) {
      expect(queueItemFields).not.toContain(field);
    }
    for (const field of [
      "currentBottleId",
      "currentReleaseId",
      "currentTargetId",
      "suggestedBottleId",
      "suggestedReleaseId",
      "suggestedTargetId",
      "parentBottleId",
      "creationTarget",
      "proposedRelease",
    ]) {
      expect(proposalFields).not.toContain(field);
    }
  });
});
