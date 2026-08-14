import { RunContext } from "@openai/agents";
import type OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";

import type {
  BottleContext,
  BottleContextSource,
  EntityContext,
} from "./bottleContextContract";
import {
  prepareBottleAuditAgentRun,
  prepareBottleClassifierAgentRun,
} from "./classifierRuntime";

type PreparedRun =
  | Awaited<ReturnType<typeof prepareBottleClassifierAgentRun>>
  | ReturnType<typeof prepareBottleAuditAgentRun>;

async function invokePreparedTool(
  prepared: PreparedRun,
  name: string,
  input: unknown,
) {
  const selected = prepared.agent.tools.find((tool) => tool.name === name);
  if (!selected || selected.type !== "function") {
    throw new Error(`Tool ${name} was not found.`);
  }
  return await selected.invoke(new RunContext(), JSON.stringify(input));
}

function bottleContext(): BottleContext {
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
    siblings: [],
    aliases: [],
    observations: [],
    publicImages: [],
  };
}

function entityContext(): EntityContext {
  return {
    entityId: 9,
    name: "Laphroaig",
    shortName: null,
    roles: ["brand", "distiller"],
    website: "https://www.laphroaig.com",
    country: "Scotland",
    region: "Islay",
    yearEstablished: 1815,
    aliases: ["D. Johnston & Co."],
    relatedBottles: [
      {
        bottleId: 45146,
        fullName: "Laphroaig Càirdeas 2022 Warehouse 1",
        relationships: ["brand", "distiller"],
      },
    ],
  };
}

describe("Bottle-check context tools", () => {
  test("does not return cask-metadata-only proposals from an audit run", async () => {
    const currentBottleContext = bottleContext();
    const prepared = prepareBottleAuditAgentRun(
      {
        client: {} as OpenAI,
        model: "test-model",
        maxSearchQueries: 0,
        adapters: {
          searchBottles: vi.fn(async () => []),
          getBottleContext: vi.fn(async () => null),
        },
      },
      {
        audit: {
          bottleId: currentBottleContext.bottleId,
          origin: "moderator",
        },
        currentBottleContext,
        conversationId: "test-audit",
      },
    );

    expect(
      await invokePreparedTool(prepared, "propose_update_bottle", {
        bottleId: currentBottleContext.bottleId,
        patch: { caskType: "oloroso" },
        rationale: "Fill optional cask metadata.",
        evidenceRefs: [
          { kind: "bottle", bottleId: currentBottleContext.bottleId },
        ],
      }),
    ).toMatchObject({ status: "rejected" });

    expect(
      prepared.getOutput({
        finalOutput: { summary: "No material Bottle repair is needed." },
      }).proposedOperations,
    ).toEqual([]);
  });

  test("does not let one label extraction overwrite populated Bottle fields", async () => {
    const currentBottleContext: BottleContext = {
      ...bottleContext(),
      publicImages: [
        {
          source: { kind: "bottle" },
          url: "https://example.com/bottles/45146.webp",
          labelEvidence: {
            sourceImageId: "bottle:45146",
            model: "test-model",
            extractedIdentity: {
              brand: "Laphroaig",
              bottler: null,
              expression: "Càirdeas",
              series: "Càirdeas",
              distillery: ["Laphroaig"],
              category: "single_malt",
              stated_age: null,
              abv: 56.4,
              release_year: 2022,
              vintage_year: null,
              cask_strength: true,
              single_cask: false,
              cask_type: null,
              cask_size: null,
              cask_fill: null,
              edition: "Cask 7445",
            },
            rawLabelText: "CASK 7445 56.4% ABV",
          },
        },
      ],
    };
    const prepared = prepareBottleAuditAgentRun(
      {
        client: {} as OpenAI,
        model: "test-model",
        maxSearchQueries: 0,
        adapters: {
          searchBottles: vi.fn(async () => []),
          getBottleContext: vi.fn(async () => null),
        },
      },
      {
        audit: {
          bottleId: currentBottleContext.bottleId,
          origin: "post_user_creation",
        },
        extractedIdentity: null,
        currentBottleContext,
        conversationId: "single-image-replacement",
      },
    );

    expect(
      await invokePreparedTool(prepared, "propose_update_bottle", {
        bottleId: currentBottleContext.bottleId,
        patch: { edition: "Cask 7445", abv: 56.4 },
        rationale: "The single image extraction conflicts with stored fields.",
        evidenceRefs: [
          { kind: "bottle", bottleId: currentBottleContext.bottleId },
        ],
      }),
    ).toMatchObject({
      status: "rejected",
      reason: expect.stringContaining('field "edition"'),
    });
    expect(
      prepared.getOutput({
        finalOutput: { summary: "No supported replacement remains." },
      }).proposedOperations,
    ).toEqual([]);
  });

  test("offers bounded reference context without catalog-change tools", async () => {
    const prepared = await prepareBottleClassifierAgentRun(
      {
        client: {} as OpenAI,
        model: "test-model",
        maxSearchQueries: 0,
        adapters: {
          searchBottles: vi.fn(async () => []),
          getBottleContext: vi.fn(
            async () => null as BottleContextSource | null,
          ),
          getEntityContext: vi.fn(async () => null),
        },
      },
      {
        reference: { name: "Laphroaig Cairdeas 2022" },
        extractedIdentity: null,
        initialCandidates: [],
      },
    );

    const toolNames = prepared.agent.tools.map((tool) => tool.name);
    expect(toolNames).toContain("get_bottle_context");
    expect(toolNames).toContain("get_entity_context");
    expect(toolNames).not.toEqual(
      expect.arrayContaining([
        "propose_update_bottle",
        "propose_merge_bottles",
        "propose_update_entity",
        "propose_merge_entities",
      ]),
    );

    const bottle = bottleContext();
    const entity = entityContext();
    const reasoning = prepared.getAgentResult({
      finalOutput: {
        action: "no_match",
        rationale: "The source Bottle remains unresolved.",
        candidateBottleIds: [],
        identityScope: "product",
        observation: null,
        matchedBottleId: null,
        proposedBottle: null,
      },
      newItems: [
        {
          type: "tool_call_output_item",
          rawItem: {
            name: "get_bottle_context",
            output: JSON.stringify({ context: bottle }),
          },
        },
        {
          type: "tool_call_output_item",
          rawItem: {
            name: "get_bottle_context",
            output: JSON.stringify({ context: bottle }),
          },
        },
        {
          type: "tool_call_output_item",
          rawItem: {
            name: "get_entity_context",
            output: JSON.stringify({ context: entity }),
          },
        },
        {
          type: "tool_call_output_item",
          rawItem: {
            name: "get_entity_context",
            output: JSON.stringify({ context: entity }),
          },
        },
      ],
    });

    expect(reasoning.artifacts.bottleContexts).toEqual([bottle]);
    expect(reasoning.artifacts.entityContexts).toEqual([entity]);
    expect(reasoning.artifacts.candidates).toContainEqual(
      expect.objectContaining({ bottleId: bottle.bottleId }),
    );
  });

  test("omits context tools when their adapters are not configured", async () => {
    const prepared = await prepareBottleClassifierAgentRun(
      {
        client: {} as OpenAI,
        model: "test-model",
        maxSearchQueries: 0,
        adapters: {
          searchBottles: vi.fn(async () => []),
        },
      },
      {
        reference: { name: "Unknown Whisky" },
        extractedIdentity: null,
        initialCandidates: [],
      },
    );

    expect(prepared.agent.tools.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining(["get_bottle_context", "get_entity_context"]),
    );
  });

  test("keeps known-target inspection usable without candidate expansion", async () => {
    const canonical = bottleContext();
    const duplicate = {
      ...canonical,
      bottleId: 39096,
      fullName: "Laphroaig Càirdeas - 2022 Release",
    };
    const { publicImages: _canonicalImages, ...canonicalSource } = canonical;
    const { publicImages: _duplicateImages, ...duplicateSource } = duplicate;
    const contexts = new Map<number, BottleContextSource>([
      [canonical.bottleId, { ...canonicalSource, imageSources: [] }],
      [duplicate.bottleId, { ...duplicateSource, imageSources: [] }],
    ]);
    const prepared = await prepareBottleClassifierAgentRun(
      {
        client: {} as OpenAI,
        model: "test-model",
        maxSearchQueries: 2,
        adapters: {
          searchBottles: vi.fn(async () => []),
          searchEntities: vi.fn(async () => []),
          getBottleContext: vi.fn(
            async (bottleId) => contexts.get(bottleId) ?? null,
          ),
          getEntityContext: vi.fn(async () => null),
        },
      },
      {
        reference: { name: "Laphroaig Cairdeas 2022" },
        extractedIdentity: null,
        initialCandidates: [],
        candidateExpansion: "initial_only",
      },
    );

    expect(prepared.agent.tools.map((tool) => tool.name)).toEqual([
      "get_bottle_context",
      "get_entity_context",
    ]);
    expect(JSON.parse(prepared.input)).not.toHaveProperty("candidateExpansion");

    await invokePreparedTool(prepared, "get_bottle_context", {
      bottleId: duplicate.bottleId,
    });
    await invokePreparedTool(prepared, "get_bottle_context", {
      bottleId: canonical.bottleId,
    });
    expect(
      prepared.getAgentResult({ finalOutput: { action: "no_match" } }).artifacts
        .bottleContexts,
    ).toEqual(expect.arrayContaining([canonical, duplicate]));
  });

  test("lets Bottle Review ground a proposal with replayed web evidence", async () => {
    const canonical = bottleContext();
    const duplicate = {
      ...canonical,
      bottleId: 39096,
      fullName: "Laphroaig Càirdeas - 2022 Release",
    };
    const { publicImages: _canonicalImages, ...canonicalSource } = canonical;
    const { publicImages: _duplicateImages, ...duplicateSource } = duplicate;
    const contexts = new Map<number, BottleContextSource>([
      [canonical.bottleId, { ...canonicalSource, imageSources: [] }],
      [duplicate.bottleId, { ...duplicateSource, imageSources: [] }],
    ]);
    const officialUrl =
      "https://www.laphroaig.com/whiskies/cairdeas-2022-warehouse-1-whisky";
    const events: string[] = [];
    const prepared = prepareBottleAuditAgentRun(
      {
        client: {} as OpenAI,
        model: "test-model",
        maxSearchQueries: 2,
        firecrawlApiKey: "firecrawl-test-key",
        executeWebSearch: async ({ toolName, args }) => {
          expect(toolName).toBe("firecrawl_web_search");
          if (!("queries" in args)) {
            throw new Error("Expected Firecrawl search arguments");
          }
          events.push("web_replayed");
          return {
            evidence: [
              {
                provider: "firecrawl",
                query: args.queries[0],
                summary: "Laphroaig confirms the 2022 Warehouse 1 release.",
                results: [
                  {
                    title: "Càirdeas 2022 Warehouse 1 Whisky",
                    url: officialUrl,
                    domain: "laphroaig.com",
                    description: null,
                    extraSnippets: [],
                  },
                ],
              },
            ],
            errors: [],
          };
        },
        adapters: {
          searchBottles: vi.fn(async () => []),
          getBottleContext: vi.fn(
            async (bottleId) => contexts.get(bottleId) ?? null,
          ),
        },
      },
      {
        audit: { bottleId: duplicate.bottleId, origin: "moderator" },
        currentBottleContext: duplicate,
        conversationId: "catalog-review-web-evidence",
      },
    );

    await invokePreparedTool(prepared, "get_bottle_context", {
      bottleId: canonical.bottleId,
    });
    await invokePreparedTool(prepared, "firecrawl_web_search", {
      queries: ["Laphroaig Cairdeas Warehouse 1 2022 official"],
    });
    events.push("web_result");
    const proposalResult = await invokePreparedTool(
      prepared,
      "propose_merge_bottles",
      {
        sourceBottleId: duplicate.bottleId,
        destinationBottleId: canonical.bottleId,
        rationale:
          "Both inspected rows and official evidence identify the same marketed Bottle.",
        evidenceRefs: [
          { kind: "bottle", bottleId: duplicate.bottleId },
          { kind: "bottle", bottleId: canonical.bottleId },
          { kind: "web_result", url: officialUrl },
        ],
      },
    );
    events.push("proposal_result");

    expect(proposalResult).toMatchObject({
      status: "recorded",
      proposalIndex: 0,
    });
    expect(events).toEqual(["web_replayed", "web_result", "proposal_result"]);
    expect(
      prepared.getOutput({
        finalOutput: { summary: "The duplicate can be merged.", findings: [] },
      }).proposedOperations,
    ).toEqual([
      expect.objectContaining({
        type: "merge_bottles",
        evidenceRefs: expect.arrayContaining([
          { kind: "web_result", url: officialUrl },
        ]),
      }),
    ]);
  });
});
