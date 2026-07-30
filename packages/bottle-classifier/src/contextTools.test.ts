import type OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";

import type {
  BottleContext,
  BottleContextSource,
  EntityContext,
} from "./bottleContextContract";
import { prepareBottleClassifierAgentRun } from "./classifierRuntime";

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
  test("offers only bounded read tools and retains each loaded context once", async () => {
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
    expect(toolNames).not.toContain("update_bottle");
    expect(toolNames).not.toContain("merge_bottles");
    expect(toolNames).not.toContain("update_entity");
    expect(toolNames).not.toContain("merge_entities");

    const bottle = bottleContext();
    const entity = entityContext();
    const reasoning = prepared.getReasoningResult({
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
});
