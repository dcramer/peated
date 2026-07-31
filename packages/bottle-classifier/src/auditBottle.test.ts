import type OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";

import type {
  BottleContext,
  BottleContextSource,
} from "./bottleContextContract";
import {
  createBottleClassifier,
  type BottleClassifierReasoningResult,
} from "./classifierRuntime";
import type { BottleCandidate } from "./classifierTypes";
import {
  buildBottleClassificationArtifacts,
  type ProposedOperationType,
} from "./contract";

function buildAuditedBottleContext(): BottleContextSource {
  return {
    bottleId: 45146,
    fullName: "Laphroaig Càirdeas 2022 Warehouse 1",
    groupId: 320,
    shared: {
      name: "Càirdeas",
      statedAge: null,
      series: { seriesId: 71, name: "Càirdeas" },
      category: "single_malt",
      brand: { entityId: 9, name: "Laphroaig" },
      distillers: [{ entityId: 9, name: "Laphroaig" }],
      bottler: null,
    },
    exact: {
      edition: "Warehouse 1",
      statedAge: null,
      abv: 52.2,
      singleCask: false,
      caskStrength: true,
      vintageYear: null,
      releaseYear: 2022,
      caskSize: null,
      caskType: null,
      caskFill: null,
    },
    siblings: [
      {
        bottleId: 45145,
        fullName: "Laphroaig Càirdeas 2021 PX Cask",
        exact: {
          edition: "PX Cask",
          statedAge: null,
          abv: 58.9,
          singleCask: false,
          caskStrength: true,
          vintageYear: null,
          releaseYear: 2021,
          caskSize: null,
          caskType: null,
          caskFill: null,
        },
      },
    ],
    aliases: [{ name: "Laphroaig Cairdeas 2022", ignored: false }],
    observations: [
      {
        sourceType: "store_price",
        sourceKey: "warehouse-1",
        sourceName: "Example Store",
        sourceUrl: "https://example.com/laphroaig-cairdeas-2022",
        rawText: "Laphroaig Cairdeas 2022 Warehouse 1",
        parsedIdentity: { releaseYear: 2022 },
        facts: { abv: 52.2 },
      },
    ],
    imageSources: [
      {
        source: { kind: "bottle" },
        url: "https://example.com/bottles/45146.webp",
      },
      {
        source: { kind: "tasting", tastingId: 901 },
        url: "https://example.com/tastings/901.webp",
      },
    ],
  };
}

describe("auditBottle", () => {
  test("preloads the Bottle and keeps origin and note as audit data", async () => {
    const currentBottle = buildAuditedBottleContext();
    const getBottleContext = vi.fn(async () => currentBottle);
    const searchBottles = vi.fn(async () => [] as BottleCandidate[]);
    const extractFromImage = vi.fn(async () => ({
      brand: "Laphroaig",
      bottler: null,
      expression: "Càirdeas",
      series: "Càirdeas",
      distillery: ["Laphroaig"],
      category: "single_malt" as const,
      stated_age: null,
      abv: 52.2,
      release_year: 2022,
      vintage_year: null,
      cask_strength: true,
      single_cask: false,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: "Warehouse 1",
    }));
    const extractFromText = vi.fn();
    const runBottleClassifierAgent = vi.fn();
    const runBottleAuditAgent = vi.fn(
      async ({
        audit,
        availableOperations,
        currentBottleContext,
      }: {
        audit: {
          bottleId: number;
          origin: "moderator" | "post_user_creation";
          note?: string;
        };
        availableOperations?: ProposedOperationType[];
        currentBottleContext: BottleContext;
      }) => {
        expect(audit).toEqual({
          bottleId: 45146,
          origin: "moderator",
          note: "Check whether the nearby generic row is a duplicate.",
        });
        expect(currentBottleContext).toMatchObject({
          bottleId: 45146,
          groupId: 320,
          aliases: [{ name: "Laphroaig Cairdeas 2022", ignored: false }],
          observations: [{ sourceKey: "warehouse-1" }],
        });
        expect(availableOperations).toEqual(["update_bottle", "merge_bottles"]);
        expect(currentBottleContext.publicImages).toHaveLength(2);
        expect(currentBottleContext.publicImages[0]).toMatchObject({
          source: { kind: "bottle" },
          url: "https://example.com/bottles/45146.webp",
          labelEvidence: {
            sourceImageId: "bottle:45146",
            fieldCandidates: {
              expression: { value: "Càirdeas" },
              releaseYear: { value: 2022 },
            },
          },
        });

        return {
          summary:
            "The audited Bottle is canonical; a malformed duplicate exists.",
          proposedOperations: [
            {
              type: "merge_bottles" as const,
              input: {
                sourceBottleId: 39096,
                destinationBottleId: 45146,
              },
              rationale:
                "Both rows represent the exact 2022 Warehouse 1 release.",
              evidenceRefs: [
                { kind: "bottle" as const, bottleId: 39096 },
                { kind: "bottle" as const, bottleId: 45146 },
              ],
            },
          ],
          findings: [],
        };
      },
    );
    const classifier = createBottleClassifier({
      client: {} as OpenAI,
      model: "test-model",
      maxSearchQueries: 2,
      adapters: {
        searchBottles,
        getBottleContext,
      },
      overrides: {
        extractFromImage,
        extractFromText,
        runBottleClassifierAgent,
        runBottleAuditAgent,
      },
    });

    const result = await classifier.auditBottle(
      {
        bottleId: 45146,
        origin: "moderator",
        note: "Check whether the nearby generic row is a duplicate.",
      },
      {
        availableOperations: ["update_bottle", "merge_bottles"],
      },
    );

    expect(getBottleContext).toHaveBeenCalledWith(45146);
    expect(runBottleAuditAgent).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      summary: "The audited Bottle is canonical; a malformed duplicate exists.",
      proposedOperations: [
        {
          type: "merge_bottles",
          input: {
            sourceBottleId: 39096,
            destinationBottleId: 45146,
          },
        },
      ],
      artifacts: {
        extractedIdentity: null,
        candidates: [{ bottleId: 45146 }],
        bottleContexts: [
          {
            bottleId: 45146,
            publicImages: [
              {
                source: { kind: "bottle" },
                url: "https://example.com/bottles/45146.webp",
                labelEvidence: {
                  sourceImageId: "bottle:45146",
                },
              },
              {
                source: { kind: "tasting", tastingId: 901 },
                url: "https://example.com/tastings/901.webp",
                labelEvidence: {
                  sourceImageId: "tasting:901",
                },
              },
            ],
          },
        ],
      },
    });
    expect(result.artifacts.bottleContexts).toHaveLength(1);
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("decision");
    expect(extractFromImage).toHaveBeenCalledTimes(2);
    expect(extractFromImage).toHaveBeenNthCalledWith(
      1,
      "https://example.com/bottles/45146.webp",
    );
    expect(extractFromImage).toHaveBeenNthCalledWith(
      2,
      "https://example.com/tastings/901.webp",
    );
    expect(extractFromText).not.toHaveBeenCalled();
    expect(runBottleClassifierAgent).not.toHaveBeenCalled();
    expect(searchBottles).not.toHaveBeenCalled();
  });

  test("requires the read-only Bottle preload capability", async () => {
    const classifier = createBottleClassifier({
      client: {} as OpenAI,
      model: "test-model",
      maxSearchQueries: 2,
      adapters: {
        searchBottles: vi.fn(async () => []),
      },
    });

    await expect(
      classifier.auditBottle({
        bottleId: 45146,
        origin: "post_user_creation",
      }),
    ).rejects.toThrow(
      "Bottle audits require the getBottleContext data-source capability.",
    );
  });

  test("attaches supplemental operations and findings to reference results", async () => {
    const classifier = createBottleClassifier({
      client: {} as OpenAI,
      model: "test-model",
      maxSearchQueries: 0,
      adapters: {
        searchBottles: vi.fn(async () => []),
      },
      overrides: {
        runBottleClassifierAgent: vi.fn(
          async (): Promise<BottleClassifierReasoningResult> => ({
            decision: {
              action: "no_match",
              rationale: "The source Bottle remains unresolved.",
              candidateBottleIds: [],
              identityScope: "product",
              observation: null,
              matchedBottleId: null,
              proposedBottle: null,
            },
            proposedOperations: [
              {
                type: "update_entity",
                input: {
                  entityId: 10,
                  patch: { name: "Canonical Brand" },
                },
                rationale: "The inspected Entity has a stale name.",
                evidenceRefs: [{ kind: "entity", entityId: 10 }],
              },
            ],
            findings: [
              {
                scope: "series",
                summary: "The related Series needs a workflow outside v1.",
                evidenceRefs: [{ kind: "source", field: "reference.name" }],
              },
            ],
            artifacts: buildBottleClassificationArtifacts({}),
          }),
        ),
      },
    });

    const result = await classifier.classifyBottleReference({
      reference: { name: "Unresolved Whisky Bottle" },
      extractedIdentity: {
        brand: "Unresolved",
        bottler: null,
        expression: "Whisky Bottle",
        series: null,
        distillery: [],
        category: null,
        stated_age: null,
        abv: null,
        release_year: null,
        vintage_year: null,
        cask_strength: null,
        single_cask: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        edition: null,
      },
      initialCandidates: [],
      candidateExpansion: "initial_only",
    });

    expect(result).toMatchObject({
      status: "classified",
      proposedOperations: [{ type: "update_entity" }],
      findings: [{ scope: "series" }],
    });
  });
});
