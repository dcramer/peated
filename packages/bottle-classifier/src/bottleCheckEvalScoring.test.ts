import { describe, expect, test } from "vitest";

import { AUDIT_BOTTLE_EVAL_CASES } from "./auditBottle.eval.fixtures";
import type { Finding, ProposedOperation } from "./bottleCheckContract";
import {
  scoreBottleCheckGrounding,
  scoreBottleCheckSemanticOutput,
  type BottleCheckGroundingScore,
} from "./bottleCheckEvalScoring";
import {
  BottleContextSchema,
  EntityContextSchema,
} from "./bottleContextContract";
import { BottleClassificationArtifactsSchema } from "./contract";

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
      caskNumber: null,
      maturation: null,
      outturn: null,
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
    missingRequiredEvidence: [],
  });
}

function findingExpectation(
  summary: string,
  evidenceRefs: Finding["evidenceRefs"],
): Finding {
  return {
    scope: "bottle_group",
    summary,
    evidenceRefs,
  };
}

function scoreRequiredWebEvidence(expectedUrl: string, actualUrl: string) {
  const expectedOperation: ProposedOperation = {
    type: "merge_bottles",
    input: { sourceBottleId: 1, destinationBottleId: 2 },
    rationale: "The records are exact duplicates.",
    evidenceRefs: [{ kind: "web_result", url: expectedUrl }],
  };
  const actualOperation: ProposedOperation = {
    ...expectedOperation,
    evidenceRefs: [{ kind: "web_result", url: actualUrl }],
  };
  const artifacts = BottleClassificationArtifactsSchema.parse({
    bottleContexts: [
      inspectedBottleContext(1, { brandId: 10 }),
      inspectedBottleContext(2, { brandId: 10 }),
    ],
    searchEvidence: [
      {
        query: "official source",
        results: [
          { title: "Expected source", url: expectedUrl },
          { title: "Actual citation", url: actualUrl },
        ],
      },
    ],
  });

  return scoreBottleCheckGrounding(
    {
      artifacts,
      proposedOperations: [actualOperation],
      findings: [],
    },
    [],
    [expectedOperation],
  );
}

describe("Bottle-check eval scoring", () => {
  test("keeps missing audit cleanup hard-gating under exact scoring", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      ({ id }) =>
        id === "audit-production-laphroaig-cairdeas-2022-malformed-duplicate",
    );
    expect(fixture).toBeDefined();

    expect(
      scoreBottleCheckSemanticOutput(fixture!.expected, {
        proposedOperations: [],
        findings: [],
      }).operations,
    ).toMatchObject({
      score: 0,
      recall: 0,
      missingCount: 1,
      extraCount: 0,
    });
  });

  test("reports operation precision and recall separately and heavily penalizes extras", () => {
    const expectedOperations: ProposedOperation[] = [
      {
        type: "update_entity",
        input: { entityId: 10, patch: { name: "Updated Entity" } },
        rationale: "Update the inspected Entity.",
        evidenceRefs: [{ kind: "entity", entityId: 10 }],
      },
      {
        type: "merge_entities",
        input: { sourceEntityId: 20, destinationEntityId: 10 },
        rationale: "Merge the inspected duplicate Entity.",
        evidenceRefs: [
          { kind: "entity", entityId: 20 },
          { kind: "entity", entityId: 10 },
        ],
      },
    ];

    const expected = { proposedOperations: expectedOperations, findings: [] };
    const missingScore = scoreBottleCheckSemanticOutput(expected, {
      proposedOperations: expectedOperations.slice(0, 1),
      findings: [],
    });
    expect(missingScore.operations).toMatchObject({
      precision: 1,
      recall: 0.5,
      missingCount: 1,
      extraCount: 0,
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
    const extraScore = scoreBottleCheckSemanticOutput(expected, {
      proposedOperations: [...expectedOperations, extraOperation],
      findings: [],
    });
    expect(extraScore.operations).toMatchObject({
      score: 0,
      precision: 2 / 3,
      recall: 1,
      extraCount: 1,
    });
  });

  test("keeps unenumerated operations informational while grounding their actual targets", () => {
    const operation: ProposedOperation = {
      type: "update_entity",
      input: {
        entityId: 10,
        patch: { name: "Supported Entity Name" },
      },
      rationale: "Inspected evidence supports this additional cleanup.",
      evidenceRefs: [{ kind: "entity", entityId: 10 }],
    };
    const actual = {
      artifacts: BottleClassificationArtifactsSchema.parse({
        entityContexts: [inspectedEntityContext(10)],
      }),
      proposedOperations: [operation],
      findings: [],
    };

    expectGrounded(scoreBottleCheckGrounding(actual));
    expect(
      scoreBottleCheckSemanticOutput(
        { proposedOperations: [], findings: [] },
        actual,
      ).operations,
    ).toMatchObject({
      score: 0,
      extraCount: 1,
    });
  });

  test("uses finding scope and sorted evidence refs as the deterministic signature", () => {
    const expectedFinding = findingExpectation(
      "The two records may be duplicates.",
      [
        { kind: "bottle", bottleId: 1 },
        { kind: "bottle", bottleId: 2 },
      ],
    );
    const paraphrasedFinding = findingExpectation(
      "Their exact relationship remains unresolved.",
      [
        { kind: "bottle", bottleId: 2 },
        { kind: "bottle", bottleId: 1 },
      ],
    );

    const score = scoreBottleCheckSemanticOutput(
      { proposedOperations: [], findings: [expectedFinding] },
      { proposedOperations: [], findings: [paraphrasedFinding] },
    );

    expect(score.findings).toMatchObject({
      score: 1,
      matchedCount: 1,
      extraCount: 0,
    });
  });

  test("rejects extra findings and findings with different evidence refs", () => {
    const expectedFinding = findingExpectation("Expected issue.", [
      { kind: "bottle", bottleId: 1 },
    ]);
    const extraFinding = findingExpectation("Unrelated issue.", [
      { kind: "bottle", bottleId: 2 },
    ]);
    const expected = { proposedOperations: [], findings: [expectedFinding] };

    expect(
      scoreBottleCheckSemanticOutput(expected, {
        proposedOperations: [],
        findings: [expectedFinding, extraFinding],
      }).findings,
    ).toMatchObject({
      score: 0,
      matchedCount: 1,
      extraCount: 1,
    });
    expect(
      scoreBottleCheckSemanticOutput(expected, {
        proposedOperations: [],
        findings: [extraFinding],
      }).findings,
    ).toMatchObject({
      score: 0,
      matchedCount: 0,
      missingCount: 1,
      extraCount: 1,
    });
  });

  test("treats a reversed current-to-matched merge as both missing and harmful", () => {
    const fixture = AUDIT_BOTTLE_EVAL_CASES.find(
      (candidate) =>
        candidate.id ===
        "audit-production-laphroaig-cairdeas-2022-malformed-duplicate",
    );
    expect(fixture).toBeDefined();
    const expectedMerge = fixture!.expected.proposedOperations[0];
    expect(expectedMerge?.type).toBe("merge_bottles");
    if (expectedMerge?.type !== "merge_bottles") {
      throw new Error("Expected the correction fixture to contain a merge.");
    }

    const reversedMerge: ProposedOperation = {
      ...expectedMerge,
      input: {
        sourceBottleId: expectedMerge.input.destinationBottleId,
        destinationBottleId: expectedMerge.input.sourceBottleId,
      },
    };
    const score = scoreBottleCheckSemanticOutput(fixture!.expected, {
      proposedOperations: [reversedMerge],
      findings: [],
    });

    expect(score.operations).toMatchObject({
      score: 0,
      precision: 0,
      recall: 0,
      missingCount: 1,
      extraCount: 1,
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
      extraCount: 1,
    });
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
                  seriesId: 100,
                  brand: { kind: "existing", entityId: 10 },
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

  test.each([
    {
      name: "Bottle reference",
      keepEvidence: (ref: ProposedOperation["evidenceRefs"][number]) =>
        ref.kind !== "bottle" || ref.bottleId !== 2,
      missingEvidenceRef: { kind: "bottle" as const, bottleId: 2 },
    },
    {
      name: "web result",
      keepEvidence: (ref: ProposedOperation["evidenceRefs"][number]) =>
        ref.kind !== "web_result",
      missingEvidenceRef: {
        kind: "web_result" as const,
        url: "https://example.com/source",
      },
    },
  ])("scores expected $name evidence only when enabled", (testCase) => {
    const artifacts = BottleClassificationArtifactsSchema.parse({
      bottleContexts: [
        inspectedBottleContext(1, { brandId: 10 }),
        inspectedBottleContext(2, { brandId: 10 }),
      ],
      searchEvidence: [
        {
          query: "official source",
          results: [{ title: "Official", url: "https://example.com/source" }],
        },
      ],
    });
    const expectedOperation: ProposedOperation = {
      type: "merge_bottles",
      input: { sourceBottleId: 1, destinationBottleId: 2 },
      rationale: "The records are exact duplicates.",
      evidenceRefs: [
        { kind: "bottle", bottleId: 1 },
        { kind: "bottle", bottleId: 2 },
        { kind: "web_result", url: "https://example.com/source" },
      ],
    };
    const filteredEvidence = expectedOperation.evidenceRefs.filter(
      testCase.keepEvidence,
    );
    const firstEvidence = filteredEvidence[0];
    if (!firstEvidence) throw new Error("Expected retained operation evidence");
    const actual = {
      artifacts,
      proposedOperations: [
        {
          ...expectedOperation,
          evidenceRefs: [firstEvidence, ...filteredEvidence.slice(1)],
        } satisfies ProposedOperation,
      ],
      findings: [],
    };

    expectGrounded(scoreBottleCheckGrounding(actual));

    const score = scoreBottleCheckGrounding(actual, [], [expectedOperation]);

    expect(score.score).toBe(0);
    expect(score.uninspectedTargets).toEqual([]);
    expect(score.uncollectedEvidence).toEqual([]);
    expect(score.missingRequiredEvidence).toEqual([
      {
        operationType: "merge_bottles",
        missingEvidenceRefs: [testCase.missingEvidenceRef],
      },
    ]);
  });

  test("does not turn an omitted expected operation into a grounding failure", () => {
    const expectedOperation: ProposedOperation = {
      type: "merge_bottles",
      input: { sourceBottleId: 1, destinationBottleId: 2 },
      rationale: "The records are exact duplicates.",
      evidenceRefs: [
        { kind: "bottle", bottleId: 1 },
        { kind: "bottle", bottleId: 2 },
        { kind: "web_result", url: "https://example.com/source" },
      ],
    };
    const actual = {
      artifacts: BottleClassificationArtifactsSchema.parse({}),
      proposedOperations: [],
      findings: [],
    };

    expectGrounded(scoreBottleCheckGrounding(actual, [], [expectedOperation]));
    expect(
      scoreBottleCheckSemanticOutput(
        { proposedOperations: [expectedOperation], findings: [] },
        actual,
      ).operations,
    ).toMatchObject({
      score: 0,
      recall: 0,
      missingCount: 1,
    });
  });

  test.each([
    {
      name: "query and fragment variants",
      expectedUrl: "https://www.example.com/products/example-bottle",
      actualUrl:
        "https://example.com/products/example-bottle/?utm_source=search#details",
      grounded: true,
    },
    {
      name: "Google organic search tracking",
      expectedUrl: "https://example.com/products/example-bottle",
      actualUrl:
        "https://example.com/products/example-bottle?srsltid=AfmBOoqExample",
      grounded: true,
    },
    {
      name: "the same terminal slug on a different path",
      expectedUrl: "https://www.example.com/products/example-bottle",
      actualUrl: "https://example.com/archive/example-bottle",
      grounded: false,
    },
    {
      name: "a different terminal slug on the same host",
      expectedUrl: "https://www.example.com/products/example-bottle",
      actualUrl: "https://example.com/products/different-bottle",
      grounded: false,
    },
    {
      name: "different non-tracking query parameters",
      expectedUrl:
        "https://www.example.com/products/example-bottle?variant=warehouse-1",
      actualUrl:
        "https://example.com/products/example-bottle?variant=warehouse-2",
      grounded: false,
    },
    {
      name: "the same terminal slug on a different host",
      expectedUrl: "https://www.example.com/products/example-bottle",
      actualUrl: "https://retailer.example/products/example-bottle",
      grounded: false,
    },
  ])(
    "matches required web evidence across $name only when equivalent",
    ({ expectedUrl, actualUrl, grounded }) => {
      const score = scoreRequiredWebEvidence(expectedUrl, actualUrl);

      expect(score.score).toBe(grounded ? 1 : 0);
      expect(score.uncollectedEvidence).toEqual([]);
      expect(score.missingRequiredEvidence).toHaveLength(grounded ? 0 : 1);
    },
  );

  test("grounds collected web evidence across equivalent URL variants", () => {
    const artifacts = BottleClassificationArtifactsSchema.parse({
      searchEvidence: [
        {
          query: "official source",
          results: [
            {
              title: "Collected source",
              url: "https://www.example.com/products/example-bottle/",
            },
          ],
        },
      ],
    });

    expectGrounded(
      scoreBottleCheckGrounding({
        artifacts,
        proposedOperations: [],
        findings: [
          findingExpectation("Equivalent citation URL.", [
            {
              kind: "web_result",
              url: "https://example.com/products/example-bottle?utm_source=search",
            },
          ]),
        ],
      }),
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
              seriesId: 999,
              brand: { kind: "existing", entityId: 30 },
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
      missingRequiredEvidence: [],
    });
  });
});
