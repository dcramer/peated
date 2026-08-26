import OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";

import type {
  BottleContext,
  BottleContextSource,
} from "./bottleContextContract";
import {
  createBottleClassifier,
  type BottleClassifierAgentResult,
  type RunBottleAuditAgentInput,
} from "./classifierRuntime";
import type { BottleCandidate } from "./classifierTypes";
import { buildBottleClassificationArtifacts } from "./contract";
import { BottleClassificationError } from "./error";

const testClient = new OpenAI({ apiKey: "test-key" });

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
      caskNumber: null,
      maturation: null,
      outturn: null,
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
          caskNumber: null,
          maturation: null,
          outturn: null,
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
    const getBottleContextImageInput = vi.fn(
      async (url: string) =>
        `data:image/webp;base64,${Buffer.from(url).toString("base64")}`,
    );
    const searchBottles = vi.fn(async (): Promise<BottleCandidate[]> => []);
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
      maturation: null,
      cask_number: null,
      outturn: null,
      edition: "Warehouse 1",
    }));
    const extractFromText = vi.fn();
    const runBottleClassifierAgent = vi.fn();
    const runBottleAuditAgent = vi.fn(
      async ({
        audit,
        reference,
        extractedIdentity,
        initialCandidates,
        currentBottleContext,
      }: RunBottleAuditAgentInput) => {
        expect(audit).toEqual({
          bottleId: 45146,
          origin: "moderator",
          note: "Check whether the nearby generic row is a duplicate.",
        });
        expect(reference).toMatchObject({
          name: "Laphroaig Càirdeas 2022 Warehouse 1",
          imageUrl: "https://example.com/bottles/45146.webp",
          currentBottleId: 45146,
        });
        expect(extractedIdentity).toBeNull();
        expect(initialCandidates).toEqual([
          expect.objectContaining({ bottleId: 45146 }),
        ]);
        expect(currentBottleContext).toMatchObject({
          bottleId: 45146,
          groupId: 320,
          aliases: [{ name: "Laphroaig Cairdeas 2022", ignored: false }],
          observations: [{ sourceKey: "warehouse-1" }],
        });
        expect(currentBottleContext.publicImages).toHaveLength(2);
        expect(currentBottleContext.publicImages[0]).toMatchObject({
          source: { kind: "bottle" },
          url: "https://example.com/bottles/45146.webp",
          labelEvidence: {
            sourceImageId: "bottle:45146",
            model: "test-model",
            extractedIdentity: {
              expression: "Càirdeas",
              release_year: 2022,
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
      client: testClient,
      model: "test-model",
      maxSearchQueries: 2,
      adapters: {
        searchBottles,
        getBottleContext,
        getBottleContextImageInput,
      },
      overrides: {
        extractFromImage,
        extractFromText,
        runBottleClassifierAgent,
        runBottleAuditAgent,
      },
    });

    const result = await classifier.auditBottle({
      bottleId: 45146,
      origin: "moderator",
      note: "Check whether the nearby generic row is a duplicate.",
    });

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
                  model: "test-model",
                  extractedIdentity: {
                    expression: "Càirdeas",
                    release_year: 2022,
                  },
                },
              },
              {
                source: { kind: "tasting", tastingId: 901 },
                url: "https://example.com/tastings/901.webp",
                labelEvidence: {
                  sourceImageId: "tasting:901",
                  model: "test-model",
                  extractedIdentity: {
                    expression: "Càirdeas",
                    release_year: 2022,
                  },
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
      `data:image/webp;base64,${Buffer.from(
        "https://example.com/bottles/45146.webp",
      ).toString("base64")}`,
    );
    expect(extractFromImage).toHaveBeenNthCalledWith(
      2,
      `data:image/webp;base64,${Buffer.from(
        "https://example.com/tastings/901.webp",
      ).toString("base64")}`,
    );
    expect(getBottleContextImageInput).toHaveBeenCalledTimes(2);
    expect(extractFromText).not.toHaveBeenCalled();
    expect(runBottleClassifierAgent).not.toHaveBeenCalled();
    expect(searchBottles).toHaveBeenCalledOnce();
    expect(searchBottles).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "Laphroaig Càirdeas 2022 Warehouse 1",
        currentBottleId: 45146,
        edition: null,
      }),
    );
  });

  test("requires the read-only Bottle preload capability", async () => {
    const classifier = createBottleClassifier({
      client: testClient,
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

  test("keeps a missing context image as unavailable label evidence", async () => {
    const auditedBottle = buildAuditedBottleContext();
    const currentBottle = {
      ...auditedBottle,
      imageSources: [auditedBottle.imageSources[0]!],
    };
    const extractFromImage = vi.fn();
    const runBottleAuditAgent = vi.fn(
      async ({ currentBottleContext }: RunBottleAuditAgentInput) => {
        expect(currentBottleContext.publicImages).toEqual([
          expect.objectContaining({
            url: "https://example.com/bottles/45146.webp",
            labelEvidence: expect.objectContaining({
              extractedIdentity: null,
              rawLabelText: null,
            }),
          }),
        ]);
        return {
          summary: "The missing image does not establish a catalog defect.",
          proposedOperations: [],
          findings: [],
        };
      },
    );
    const classifier = createBottleClassifier({
      client: testClient,
      model: "test-model",
      maxSearchQueries: 0,
      adapters: {
        searchBottles: vi.fn(async () => []),
        getBottleContext: vi.fn(async () => currentBottle),
        getBottleContextImageInput: vi.fn(async () => {
          throw new Error("Image object is missing.");
        }),
      },
      overrides: {
        extractFromImage,
        extractFromText: vi.fn(),
        runBottleAuditAgent,
      },
    });

    await expect(
      classifier.auditBottle({ bottleId: 45146, origin: "moderator" }),
    ).resolves.toMatchObject({
      summary: "The missing image does not establish a catalog defect.",
    });
    expect(extractFromImage).not.toHaveBeenCalled();
  });

  test("preserves gathered artifacts when final finding validation fails", async () => {
    const currentBottle = {
      ...buildAuditedBottleContext(),
      imageSources: [],
    };
    const relatedBottleSource = {
      ...currentBottle,
      bottleId: 39096,
      fullName: "Malformed Laphroaig Càirdeas",
    };
    const relatedBottle: BottleContext = {
      bottleId: relatedBottleSource.bottleId,
      fullName: relatedBottleSource.fullName,
      groupId: relatedBottleSource.groupId,
      shared: relatedBottleSource.shared,
      exact: relatedBottleSource.exact,
      siblings: relatedBottleSource.siblings,
      aliases: relatedBottleSource.aliases,
      observations: relatedBottleSource.observations,
      publicImages: [],
    };
    const runAgent = vi.fn(async () => ({
      finalOutput: {
        summary: "The audit returned an unsupported finding citation.",
        findings: [
          {
            scope: "bottle",
            summary: "An uncollected page allegedly establishes a defect.",
            evidenceRefs: [
              {
                kind: "web_result",
                url: "https://example.com/not-collected",
              },
            ],
          },
        ],
      },
      newItems: [
        {
          type: "tool_call_output_item",
          rawItem: {
            name: "get_bottle_context",
            output: JSON.stringify({ context: relatedBottle }),
          },
        },
      ],
    }));
    const classifier = createBottleClassifier({
      client: testClient,
      model: "test-model",
      maxSearchQueries: 0,
      adapters: {
        searchBottles: vi.fn(async () => []),
        getBottleContext: vi.fn(async () => currentBottle),
      },
      overrides: {
        runPreparedBottleAuditAgent: runAgent,
      },
    });

    try {
      await classifier.runBottleAudit({
        bottleId: currentBottle.bottleId,
        origin: "moderator",
      });
      throw new Error("Expected Bottle audit validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(BottleClassificationError);
      expect(error).toMatchObject({
        message: expect.stringContaining(
          "Finding 0 cites evidence that was not collected",
        ),
        artifacts: {
          bottleContexts: expect.arrayContaining([
            expect.objectContaining({ bottleId: currentBottle.bottleId }),
            expect.objectContaining({ bottleId: relatedBottle.bottleId }),
          ]),
        },
      });
    }
  });

  test("accepts any supported audit proposal type", async () => {
    const classifier = createBottleClassifier({
      client: testClient,
      model: "test-model",
      maxSearchQueries: 0,
      adapters: {
        searchBottles: vi.fn(async () => []),
        getBottleContext: vi.fn(async () => ({
          ...buildAuditedBottleContext(),
          imageSources: [],
        })),
      },
      overrides: {
        runBottleAuditAgent: vi.fn(async () => ({
          summary: "The Brand needs review.",
          proposedOperations: [
            {
              type: "update_entity" as const,
              input: {
                entityId: 9,
                patch: { name: "Laphroaig Distillery" },
              },
              rationale: "The Entity name is stale.",
              evidenceRefs: [{ kind: "entity" as const, entityId: 9 }],
            },
          ],
          findings: [],
        })),
      },
    });

    await expect(
      classifier.auditBottle({ bottleId: 45146, origin: "moderator" }),
    ).resolves.toMatchObject({
      proposedOperations: [{ type: "update_entity" }],
    });
  });

  test("keeps catalog review output out of Reference Classification", async () => {
    const classifier = createBottleClassifier({
      client: testClient,
      model: "test-model",
      maxSearchQueries: 0,
      adapters: {
        searchBottles: vi.fn(async () => []),
      },
      overrides: {
        runBottleClassifierAgent: vi.fn(
          async (): Promise<BottleClassifierAgentResult> => ({
            decision: {
              action: "no_match",
              rationale: "The source Bottle remains unresolved.",
              candidateBottleIds: [],
              identityScope: "product",
              observation: null,
              matchedBottleId: null,
              proposedBottle: null,
            },
            artifacts: buildBottleClassificationArtifacts({
              entityContexts: [
                {
                  entityId: 10,
                  name: "Stale Brand",
                  shortName: null,
                  roles: ["brand"],
                  website: null,
                  country: null,
                  region: null,
                  yearEstablished: null,
                  aliases: [],
                  relatedBottles: [],
                },
              ],
            }),
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
        maturation: null,
        cask_number: null,
        outturn: null,
        edition: null,
      },
      initialCandidates: [],
      candidateExpansion: "initial_only",
    });

    expect(result).toMatchObject({
      status: "classified",
      decision: { action: "no_match" },
    });
    expect(result).not.toHaveProperty("proposedOperations");
    expect(result).not.toHaveProperty("findings");
  });
});
