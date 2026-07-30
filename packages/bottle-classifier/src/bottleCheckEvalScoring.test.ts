import type OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";

import { AUDIT_BOTTLE_EVAL_CASES } from "./auditBottle.eval.fixtures";
import type { ProposedOperation } from "./bottleCheckContract";
import {
  scoreBottleCheckGrounding,
  scoreBottleCheckSemanticOutput,
  type BottleCheckGroundingScore,
  type BottleCheckSemanticScore,
} from "./bottleCheckEvalScoring";
import {
  BottleContextSchema,
  EntityContextSchema,
  type BottleContextSource,
} from "./bottleContextContract";
import { EVAL_CASES } from "./classifier.eval.fixtures";
import { createBottleClassifier } from "./classifierRuntime";
import { BottleClassificationArtifactsSchema } from "./contract";

function expectPerfectScore(score: BottleCheckSemanticScore) {
  expect(score.operations).toMatchObject({
    score: 1,
    precision: 1,
    recall: 1,
    harmfulExtraCount: 0,
  });
  expect(score.findings).toMatchObject({
    score: 1,
    precision: 1,
    recall: 1,
    harmfulExtraCount: 0,
  });
}

function inspectedBottleContext(
  bottleId: number,
  {
    brandId,
    seriesId = null,
  }: {
    brandId: number;
    seriesId?: number | null;
  },
) {
  return BottleContextSchema.parse({
    bottleId,
    fullName: `Bottle ${bottleId}`,
    groupId: bottleId,
    shared: {
      name: `Bottle ${bottleId}`,
      statedAge: null,
      series: seriesId ? { seriesId, name: `Series ${seriesId}` } : null,
      category: null,
      brand: { entityId: brandId, name: `Entity ${brandId}` },
      distillers: [],
      bottler: null,
    },
    exact: {
      edition: null,
      statedAge: null,
      abv: null,
      singleCask: null,
      caskStrength: null,
      vintageYear: null,
      releaseYear: null,
      caskSize: null,
      caskType: null,
      caskFill: null,
    },
    siblings: [],
    aliases: [],
    observations: [],
    publicImages: [],
  });
}

function inspectedEntityContext(entityId: number) {
  return EntityContextSchema.parse({
    entityId,
    name: `Entity ${entityId}`,
    shortName: null,
    roles: ["brand"],
    website: null,
    country: null,
    region: null,
    yearEstablished: null,
    aliases: [],
    relatedBottles: [],
  });
}

function expectGrounded(score: BottleCheckGroundingScore) {
  expect(score).toEqual({
    score: 1,
    uninspectedTargets: [],
    uncollectedEvidence: [],
  });
}

describe("Bottle-check eval scoring", () => {
  test("scores the exact semantic output of every audit fixture independently of prose", () => {
    for (const fixture of AUDIT_BOTTLE_EVAL_CASES) {
      const actual = {
        ...fixture.expected,
        summary: "Different valid narrative wording is not exact-scored.",
      };
      expectPerfectScore(
        scoreBottleCheckSemanticOutput(fixture.expected, actual),
      );
    }
  });

  test("reports operation precision and recall separately and heavily penalizes extras", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      (candidate) => candidate.scenario === "entity_operations",
    );
    expect(fixture).toBeDefined();

    const missingScore = scoreBottleCheckSemanticOutput(fixture!.expected, {
      proposedOperations: fixture!.expected.proposedOperations.slice(0, 1),
      findings: [],
    });
    expect(missingScore.operations).toMatchObject({
      precision: 1,
      recall: 0.5,
      missingCount: 1,
      harmfulExtraCount: 0,
    });

    const extraOperation: ProposedOperation = {
      type: "update_entity",
      input: {
        entityId: 9999,
        patch: { name: "Unrelated Entity" },
      },
      rationale: "Unrelated cleanup must be penalized.",
      evidenceRefs: [{ kind: "entity", entityId: 9999 }],
    };
    const extraScore = scoreBottleCheckSemanticOutput(fixture!.expected, {
      proposedOperations: [
        ...fixture!.expected.proposedOperations,
        extraOperation,
      ],
      findings: [],
    });
    expect(extraScore.operations).toMatchObject({
      score: 0,
      precision: 2 / 3,
      recall: 1,
      harmfulExtraCount: 1,
    });
  });

  test("treats a reversed post-primary merge as both missing and harmful", () => {
    const fixture = EVAL_CASES.find(
      (candidate) =>
        candidate.fixtureId ===
        "generalized-current-bottle-requires-post-primary-merge",
    );
    expect(fixture).toBeDefined();
    expect(fixture!.expected.operationPreparation).toBe("after_primary");

    const expectedMerge = fixture!.expected.proposedOperations[0];
    expect(expectedMerge?.type).toBe("merge_bottles");
    if (expectedMerge?.type !== "merge_bottles") {
      throw new Error("Expected the correction fixture to contain a merge.");
    }

    const score = scoreBottleCheckSemanticOutput(fixture!.expected, {
      proposedOperations: [
        {
          ...expectedMerge,
          input: {
            sourceBottleId: expectedMerge.input.destinationBottleId,
            destinationBottleId: expectedMerge.input.sourceBottleId,
          },
        },
      ],
      findings: [],
    });

    expect(score.operations).toMatchObject({
      score: 0,
      precision: 0,
      recall: 0,
      missingCount: 1,
      harmfulExtraCount: 1,
    });
  });

  test("penalizes unsupported findings without coupling them to operation scoring", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      (candidate) => candidate.scenario === "clean",
    );
    expect(fixture).toBeDefined();

    const score = scoreBottleCheckSemanticOutput(fixture!.expected, {
      proposedOperations: [],
      findings: [
        {
          scope: "other",
          summary: "Unsupported unrelated cleanup.",
          evidenceRefs: [{ kind: "bottle", bottleId: 50601 }],
        },
      ],
    });

    expect(score.operations.score).toBe(1);
    expect(score.findings).toMatchObject({
      score: 0,
      precision: 0,
      recall: 1,
      harmfulExtraCount: 1,
    });
  });

  test("loads a fixture through the public audit boundary before scoring it", async () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      (candidate) => candidate.scenario === "bottle_merge",
    );
    expect(fixture).toBeDefined();
    const currentBottle = fixture!.input.context.currentBottle;
    const currentBottleContext: BottleContextSource = {
      bottleId: currentBottle.bottleId,
      fullName: currentBottle.fullName,
      groupId: 5901,
      shared: {
        name: currentBottle.fullName,
        statedAge: currentBottle.statedAge,
        series: null,
        category: currentBottle.category,
        brand: {
          entityId: 5901,
          name: currentBottle.brand ?? "Synthetic Brand",
        },
        distillers: currentBottle.distillery.map((name, index) => ({
          entityId: 5902 + index,
          name,
        })),
        bottler: null,
      },
      exact: {
        edition: currentBottle.edition,
        statedAge: currentBottle.statedAge,
        abv: currentBottle.abv,
        singleCask: currentBottle.singleCask,
        caskStrength: currentBottle.caskStrength,
        vintageYear: currentBottle.vintageYear,
        releaseYear: currentBottle.releaseYear,
        caskSize: currentBottle.caskSize,
        caskType: currentBottle.caskType,
        caskFill: currentBottle.caskFill,
      },
      siblings: [],
      aliases: [],
      observations: [],
      imageSources: [],
    };

    const classifier = createBottleClassifier({
      client: {} as OpenAI,
      model: "test-model",
      maxSearchQueries: 0,
      adapters: {
        searchBottles: vi.fn(async () => []),
        getBottleContext: vi.fn(async () => currentBottleContext),
      },
      overrides: {
        runBottleAuditAgent: vi.fn(async ({ currentBottleContext }) => {
          expect(currentBottleContext.bottleId).toBe(currentBottle.bottleId);
          return fixture!.expected;
        }),
      },
    });

    const result = await classifier.auditBottle(fixture!.input.audit);

    expectPerfectScore(
      scoreBottleCheckSemanticOutput(fixture!.expected, result),
    );
  });

  test("grounds operation targets in inspected contexts while allowing shallow evidence", () => {
    const artifacts = BottleClassificationArtifactsSchema.parse({
      candidates: [
        {
          bottleId: 3,
          fullName: "Shallow candidate",
          brand: "Resolved entity",
        },
      ],
      resolvedEntities: [
        {
          entityId: 30,
          name: "Resolved entity",
          type: ["brand"],
        },
      ],
      bottleContexts: [
        inspectedBottleContext(1, { brandId: 10, seriesId: 100 }),
        inspectedBottleContext(2, { brandId: 20 }),
      ],
      entityContexts: [inspectedEntityContext(10), inspectedEntityContext(20)],
      searchEvidence: [
        {
          query: "official source",
          results: [{ title: "Official", url: "https://example.com/source" }],
        },
      ],
    });

    expectGrounded(
      scoreBottleCheckGrounding(
        {
          artifacts,
          proposedOperations: [
            {
              type: "update_bottle",
              input: {
                bottleId: 1,
                patch: {
                  shared: {
                    seriesId: 100,
                    brand: { kind: "existing", entityId: 10 },
                  },
                },
              },
              rationale: "Grounded update.",
              evidenceRefs: [
                { kind: "bottle", bottleId: 3 },
                { kind: "entity", entityId: 30 },
                {
                  kind: "web_result",
                  url: "https://example.com/source",
                },
              ],
            },
            {
              type: "merge_bottles",
              input: { sourceBottleId: 1, destinationBottleId: 2 },
              rationale: "Grounded merge.",
              evidenceRefs: [{ kind: "bottle", bottleId: 1 }],
            },
            {
              type: "merge_entities",
              input: { sourceEntityId: 10, destinationEntityId: 20 },
              rationale: "Grounded entity merge.",
              evidenceRefs: [{ kind: "entity", entityId: 30 }],
            },
          ],
          findings: [
            {
              scope: "other",
              summary: "Grounded note.",
              evidenceRefs: [{ kind: "source", field: "audit.note" }],
            },
          ],
        },
        ["audit.note"],
      ),
    );
  });

  test("reports uninspected targets and fabricated evidence independently", () => {
    const artifacts = BottleClassificationArtifactsSchema.parse({
      candidates: [{ bottleId: 3, fullName: "Shallow candidate" }],
      resolvedEntities: [
        {
          entityId: 30,
          name: "Shallow entity",
          type: ["brand"],
        },
      ],
      bottleContexts: [inspectedBottleContext(1, { brandId: 10 })],
      entityContexts: [inspectedEntityContext(10)],
    });

    const score = scoreBottleCheckGrounding({
      artifacts,
      proposedOperations: [
        {
          type: "update_bottle",
          input: {
            bottleId: 3,
            patch: {
              shared: {
                seriesId: 999,
                brand: { kind: "existing", entityId: 30 },
              },
            },
          },
          rationale: "Targets only shallow resources.",
          evidenceRefs: [
            { kind: "bottle", bottleId: 3 },
            { kind: "entity", entityId: 999 },
          ],
        },
      ],
      findings: [
        {
          scope: "other",
          summary: "Fabricated web evidence.",
          evidenceRefs: [
            { kind: "web_result", url: "https://example.com/fabricated" },
          ],
        },
      ],
    });

    expect(score).toEqual({
      score: 0,
      uninspectedTargets: [
        { operationIndex: 0, kind: "bottle", id: 3 },
        { operationIndex: 0, kind: "series", id: 999 },
        { operationIndex: 0, kind: "entity", id: 30 },
      ],
      uncollectedEvidence: [
        {
          owner: "operation",
          itemIndex: 0,
          evidenceRef: { kind: "entity", entityId: 999 },
        },
        {
          owner: "finding",
          itemIndex: 0,
          evidenceRef: {
            kind: "web_result",
            url: "https://example.com/fabricated",
          },
        },
      ],
    });
  });
});
