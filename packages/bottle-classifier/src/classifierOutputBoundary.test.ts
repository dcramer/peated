import {
  Runner,
  Usage,
  type Agent,
  type JsonSchemaDefinition,
  type Model,
} from "@openai/agents";
import type OpenAI from "openai";
import { describe, expect, test, vi } from "vitest";

import type { BottleContext } from "./bottleContextContract";
import {
  prepareBottleAuditAgentRun,
  prepareBottleClassifierAgentRun,
} from "./classifierRuntime";

function hasFormatAnnotation(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasFormatAnnotation);
  }
  if (value === null || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(
    ([key, child]) => key === "format" || hasFormatAnnotation(child),
  );
}

const currentBottleContext: BottleContext = {
  bottleId: 45146,
  fullName: "Laphroaig Càirdeas 2022 Warehouse 1",
  groupId: 18105,
  shared: {
    name: "Càirdeas",
    statedAge: null,
    series: null,
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

const classifierOptions = {
  client: {} as OpenAI,
  model: "test-model",
  maxSearchQueries: 0,
  adapters: {
    searchBottles: vi.fn(async () => []),
  },
};

async function runWithFakeModel(
  agent: Agent<unknown, JsonSchemaDefinition>,
  input: string,
  finalOutput: unknown,
): Promise<{ outputType: JsonSchemaDefinition; result: unknown }> {
  let outputType: JsonSchemaDefinition | undefined;
  const model: Model = {
    async getResponse(request) {
      outputType = request.outputType as JsonSchemaDefinition;
      return {
        usage: new Usage(),
        output: [
          {
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: JSON.stringify(finalOutput),
              },
            ],
          },
        ],
      };
    },
    async *getStreamedResponse() {},
  };

  const result = await new Runner({ tracingDisabled: true }).run(
    agent.clone({ model }),
    input,
  );

  if (!outputType) {
    throw new Error("Fake model did not receive an output type");
  }
  return { outputType, result };
}

describe("classifier output boundary", () => {
  test("sends the generated reference JSON Schema in the model request", async () => {
    const prepared = await prepareBottleClassifierAgentRun(classifierOptions, {
      reference: { name: "Laphroaig Cairdeas 2022" },
      extractedIdentity: null,
      initialCandidates: [],
    });

    const { outputType, result } = await runWithFakeModel(
      prepared.agent,
      prepared.input,
      {
        action: "no_match",
        rationale: "No safe local match.",
        candidateBottleIds: [],
        identityScope: null,
        aliasScope: null,
        observation: null,
        identityBasis: null,
        confidenceBasis: null,
        matchedBottleId: null,
        proposedBottle: null,
        findings: [],
      },
    );

    expect(outputType).toMatchObject({
      type: "json_schema",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { action: expect.any(Object) },
      },
    });
    expect(outputType.schema.properties).not.toHaveProperty(
      "proposedOperations",
    );
    expect(outputType.schema.properties).toHaveProperty("findings");
    expect(outputType.schema.required).toContain("findings");
    expect(hasFormatAnnotation(outputType.schema)).toBe(false);
    expect(prepared.agent.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "propose_update_bottle",
        "propose_merge_bottles",
        "propose_update_entity",
        "propose_merge_entities",
      ]),
    );
    expect(prepared.getAgentResult(result)).toMatchObject({
      decision: { action: "no_match" },
      findings: [],
      proposedOperations: [],
    });
  });

  test("sends the generated audit JSON Schema in the model request", async () => {
    const prepared = prepareBottleAuditAgentRun(classifierOptions, {
      audit: { bottleId: 45146, origin: "moderator" },
      currentBottleContext,
      conversationId: "audit-output-schema-test",
    });

    const { outputType } = await runWithFakeModel(
      prepared.agent,
      prepared.input,
      {
        summary: "The Bottle is clean.",
        findings: [],
      },
    );

    expect(outputType).toMatchObject({
      type: "json_schema",
      strict: true,
      schema: { type: "object", additionalProperties: false },
    });
    expect(outputType.schema.properties).toHaveProperty("summary");
    expect(outputType.schema.properties).toHaveProperty("findings");
    expect(outputType.schema.required).toEqual(
      expect.arrayContaining(["summary", "findings"]),
    );
    expect(outputType.schema.properties).not.toHaveProperty(
      "proposedOperations",
    );
    expect(hasFormatAnnotation(outputType.schema)).toBe(false);
    expect(prepared.agent.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "propose_update_bottle",
        "propose_merge_bottles",
        "propose_update_entity",
        "propose_merge_entities",
      ]),
    );
  });

  test("keeps canonical web evidence URL validation", async () => {
    const prepared = await prepareBottleClassifierAgentRun(classifierOptions, {
      reference: { name: "Laphroaig Cairdeas 2022" },
      extractedIdentity: null,
      initialCandidates: [],
    });

    expect(() =>
      prepared.getAgentResult({
        finalOutput: {
          action: "no_match",
          findings: [
            {
              scope: "bottle",
              summary: "The evidence URL is malformed.",
              evidenceRefs: [{ kind: "web_result", url: "not a URL" }],
            },
          ],
        },
      }),
    ).toThrow();
  });

  test("rejects well-formed finding evidence that was not collected", async () => {
    const prepared = await prepareBottleClassifierAgentRun(classifierOptions, {
      reference: { name: "Laphroaig Cairdeas 2022" },
      extractedIdentity: null,
      initialCandidates: [],
    });

    expect(() =>
      prepared.getAgentResult({
        finalOutput: {
          action: "no_match",
          findings: [
            {
              scope: "bottle",
              summary: "An unsupported page allegedly establishes a defect.",
              evidenceRefs: [
                {
                  kind: "web_result",
                  url: "https://example.com/not-collected",
                },
              ],
            },
          ],
        },
      }),
    ).toThrow("Finding 0 cites evidence that was not collected");
  });

  test("accepts finding evidence from the preloaded audit Bottle", () => {
    const prepared = prepareBottleAuditAgentRun(classifierOptions, {
      audit: { bottleId: 45146, origin: "moderator" },
      currentBottleContext,
      conversationId: "audit-finding-evidence-test",
    });

    expect(
      prepared.getOutput({
        finalOutput: {
          summary: "The Bottle needs separate moderator attention.",
          findings: [
            {
              scope: "bottle",
              summary: "The inspected Bottle has an unresolved issue.",
              evidenceRefs: [{ kind: "bottle", bottleId: 45146 }],
            },
          ],
        },
      }),
    ).toMatchObject({
      findings: [
        expect.objectContaining({
          evidenceRefs: [{ kind: "bottle", bottleId: 45146 }],
        }),
      ],
    });
  });

  test("applies canonical defaults after the SDK parses sparse reference JSON", async () => {
    const prepared = await prepareBottleClassifierAgentRun(classifierOptions, {
      reference: { name: "Laphroaig Cairdeas 2022" },
      extractedIdentity: null,
      initialCandidates: [],
    });
    const { result } = await runWithFakeModel(prepared.agent, prepared.input, {
      action: "no_match",
    });

    expect((result as { finalOutput: unknown }).finalOutput).toEqual({
      action: "no_match",
    });
    expect(prepared.getAgentResult(result)).toMatchObject({
      decision: {
        action: "no_match",
        rationale: null,
        candidateBottleIds: [],
        identityScope: null,
        aliasScope: null,
        observation: null,
        identityBasis: null,
        confidenceBasis: null,
        matchedBottleId: null,
        proposedBottle: null,
      },
    });
  });

  test("rejects operation fields in the strict reference result", async () => {
    const prepared = await prepareBottleClassifierAgentRun(classifierOptions, {
      reference: { name: "Laphroaig Cairdeas 2022" },
      extractedIdentity: null,
      initialCandidates: [],
    });

    expect(() =>
      prepared.getAgentResult({
        finalOutput: {
          action: "no_match",
          proposedOperations: [],
          findings: [],
        },
      }),
    ).toThrow();
  });

  test("rejects operation fields in the strict audit result", () => {
    const prepared = prepareBottleAuditAgentRun(classifierOptions, {
      audit: { bottleId: 45146, origin: "moderator" },
      currentBottleContext,
      conversationId: "audit-invalid-output-test",
    });

    expect(() =>
      prepared.getOutput({
        finalOutput: {
          summary: "A malformed operation must not cross the boundary.",
          proposedOperations: [
            {
              type: "merge_entities",
              input: { sourceBottleId: 39096, destinationBottleId: 45146 },
              rationale: "Mismatched operation payload.",
              evidenceRefs: [{ kind: "bottle", bottleId: 39096 }],
            },
          ],
          findings: [],
        },
      }),
    ).toThrow();
  });
});
