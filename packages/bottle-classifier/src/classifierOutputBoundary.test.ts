import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import type { BottleContext } from "./bottleContextContract";
import {
  prepareBottleAuditAgentRun,
  prepareBottleClassifierAgentRun,
  type PreparedAgentRequest,
} from "./classifierRuntime";
import { runAgent } from "./runtime/agentRun";
import { agentRunResult, createTestLanguageModel } from "./testLanguageModel";

const JsonValueSchema = z.json();
type JsonValue = z.infer<typeof JsonValueSchema>;

function hasFormatAnnotation(value: JsonValue): boolean {
  if (Array.isArray(value)) {
    return value.some(hasFormatAnnotation);
  }
  const objectValue = z.record(z.string(), JsonValueSchema).safeParse(value);
  if (!objectValue.success) {
    return false;
  }

  return Object.entries(objectValue.data).some(
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
    releaseMonth: null,
    releaseDay: null,
    caskNumber: null,
    maturation: null,
    outturn: null,
  },
  siblings: [],
  references: [],
  observations: [],
  publicImages: [],
};

const classifierOptions = {
  languageModel: createTestLanguageModel().languageModel,
  model: "test-model",
  maxSearchQueries: 0,
  adapters: {
    searchBottles: vi.fn(async () => []),
  },
};

const NO_USAGE = {
  inputTokens: {
    total: 0,
    noCache: 0,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

/**
 * Runs a prepared agent against a model that searches for `researchTurns`
 * turns, then answers with `finalOutput`.
 */
async function runWithFakeModel(
  prepared: PreparedAgentRequest,
  finalOutput: JsonValue,
  { researchTurns = 0 }: { researchTurns?: number } = {},
) {
  let turn = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      turn += 1;
      if (turn <= researchTurns) {
        return {
          content: [
            {
              type: "tool-call",
              toolCallId: `call-${turn}`,
              toolName: "search_bottles",
              input: JSON.stringify({ query: `Example query ${turn}` }),
            },
          ],
          finishReason: { unified: "tool-calls", raw: "tool_calls" },
          usage: NO_USAGE,
          warnings: [],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(finalOutput) }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: NO_USAGE,
        warnings: [],
      };
    },
  });

  const result = await runAgent({
    ...prepared,
    model,
    functionId: "output_boundary_test",
    input: prepared.input,
  });
  const responseFormat = z
    .object({ type: z.literal("json"), schema: z.record(z.string(), z.json()) })
    .passthrough()
    .parse(model.doGenerateCalls.at(-1)?.responseFormat);
  return { responseFormat, result, turn };
}

describe("classifier output boundary", () => {
  test("sends the generated reference JSON Schema in the model request", async () => {
    const prepared = await prepareBottleClassifierAgentRun(classifierOptions, {
      reference: {
        id: "listing-1",
        externalSiteId: 7,
        name: "Laphroaig Cairdeas 2022",
      },
      extractedIdentity: null,
      initialCandidates: [],
    });
    const dynamicInput = JSON.parse(prepared.input);

    const { responseFormat, result } = await runWithFakeModel(prepared, {
      action: "no_match",
      rationale: "No safe local match.",
      candidateBottleIds: [],
      identityScope: null,
      referenceScope: null,
      observation: null,
      confidenceBasis: null,
      matchedBottleId: null,
      proposedBottle: null,
    });

    expect(responseFormat).toMatchObject({
      type: "json",
      name: "bottle_reference_output",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { action: expect.any(Object) },
      },
    });
    const schema = responseFormat.schema;
    expect(schema.properties).not.toHaveProperty("proposedOperations");
    expect(schema.properties).not.toHaveProperty("identityBasis");
    expect(schema.properties).not.toHaveProperty("findings");
    expect(schema).toMatchObject({
      properties: {
        proposedBottle: {
          anyOf: expect.arrayContaining([
            expect.objectContaining({
              type: "object",
              properties: expect.objectContaining({
                bottlingYear: expect.any(Object),
              }),
              required: expect.arrayContaining(["bottlingYear"]),
              additionalProperties: false,
            }),
          ]),
        },
      },
    });
    expect(hasFormatAnnotation(schema)).toBe(false);
    expect(prepared.tools.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining([
        "propose_update_bottle",
        "propose_merge_bottles",
        "propose_update_entity",
        "propose_merge_entities",
      ]),
    );
    expect(dynamicInput.reference).not.toHaveProperty("externalSiteId");
    expect(dynamicInput).not.toHaveProperty("availableSourceEvidenceFields");
    expect(prepared.getAgentResult(result)).toMatchObject({
      decision: { action: "no_match" },
    });
  });

  test("sends the generated audit JSON Schema in the model request", async () => {
    const prepared = prepareBottleAuditAgentRun(classifierOptions, {
      audit: { bottleId: 45146, origin: "moderator" },
      currentBottleContext,
      conversationId: "audit-output-schema-test",
    });

    const { responseFormat } = await runWithFakeModel(prepared, {
      summary: "The Bottle is clean.",
      findings: [],
    });

    expect(responseFormat).toMatchObject({
      type: "json",
      name: "bottle_audit_output",
      schema: { type: "object", additionalProperties: false },
    });
    const schema = responseFormat.schema;
    expect(schema.properties).toHaveProperty("summary");
    expect(schema.properties).toHaveProperty("findings");
    expect(schema.required).toEqual(
      expect.arrayContaining(["summary", "findings"]),
    );
    expect(schema.properties).not.toHaveProperty("proposedOperations");
    expect(hasFormatAnnotation(schema)).toBe(false);
    expect(prepared.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "propose_update_bottle",
        "propose_merge_bottles",
        "propose_update_entity",
        "propose_merge_entities",
      ]),
    );
    expect(JSON.parse(prepared.input).availableSourceEvidenceFields).toEqual(
      [],
    );
  });

  test("accepts finding evidence from the preloaded audit Bottle", () => {
    const prepared = prepareBottleAuditAgentRun(classifierOptions, {
      audit: { bottleId: 45146, origin: "moderator" },
      currentBottleContext,
      conversationId: "audit-finding-evidence-test",
    });

    expect(
      prepared.getOutput(
        agentRunResult({
          summary: "The Bottle needs separate moderator attention.",
          findings: [
            {
              scope: "bottle",
              summary: "The inspected Bottle has an unresolved issue.",
              evidenceRefs: [{ kind: "bottle", bottleId: 45146 }],
            },
          ],
        }),
      ),
    ).toMatchObject({
      findings: [
        expect.objectContaining({
          evidenceRefs: [{ kind: "bottle", bottleId: 45146 }],
        }),
      ],
    });
  });

  test("applies canonical defaults to sparse reference JSON", async () => {
    const prepared = await prepareBottleClassifierAgentRun(classifierOptions, {
      reference: { name: "Laphroaig Cairdeas 2022" },
      extractedIdentity: null,
      initialCandidates: [],
    });
    const { result } = await runWithFakeModel(prepared, {
      action: "no_match",
    });

    expect(result.output).toEqual({ action: "no_match" });
    expect(prepared.getAgentResult(result)).toMatchObject({
      decision: {
        action: "no_match",
        rationale: null,
        candidateBottleIds: [],
        identityScope: null,
        referenceScope: null,
        observation: null,
        confidenceBasis: null,
        matchedBottleId: null,
        proposedBottle: null,
      },
    });
  });

  test("returns a decision after 17 research turns", async () => {
    const prepared = await prepareBottleClassifierAgentRun(classifierOptions, {
      reference: { name: "Example Single Malt" },
      extractedIdentity: null,
      initialCandidates: [],
    });

    const { result, turn } = await runWithFakeModel(
      prepared,
      {
        action: "no_match",
        rationale: "No safe local match.",
        candidateBottleIds: [],
        identityScope: "product",
        referenceScope: "none",
        observation: null,
        confidenceBasis: null,
        matchedBottleId: null,
        proposedBottle: null,
      },
      { researchTurns: 17 },
    );

    expect(turn).toBe(18);
    expect(prepared.maxTurns).toBe(turn);
    expect(prepared.getAgentResult(result).decision).toMatchObject({
      action: "no_match",
    });
  });

  test("passes an abort signal to the reference agent run", async () => {
    const signal = AbortSignal.timeout(1_000);
    const prepared = await prepareBottleClassifierAgentRun(classifierOptions, {
      reference: { name: "Example Single Malt" },
      extractedIdentity: null,
      initialCandidates: [],
      signal,
    });

    expect(prepared.signal).toBe(signal);
  });

  test("rejects operation fields in the strict reference result", async () => {
    const prepared = await prepareBottleClassifierAgentRun(classifierOptions, {
      reference: { name: "Laphroaig Cairdeas 2022" },
      extractedIdentity: null,
      initialCandidates: [],
    });

    expect(() =>
      prepared.getAgentResult(
        agentRunResult({
          action: "no_match",
          proposedOperations: [],
          findings: [],
        }),
      ),
    ).toThrow();
  });

  test("rejects operation fields in the strict audit result", () => {
    const prepared = prepareBottleAuditAgentRun(classifierOptions, {
      audit: { bottleId: 45146, origin: "moderator" },
      currentBottleContext,
      conversationId: "audit-invalid-output-test",
    });

    expect(() =>
      prepared.getOutput(
        agentRunResult({
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
        }),
      ),
    ).toThrow();
  });
});
