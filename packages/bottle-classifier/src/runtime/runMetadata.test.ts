import { describe, expect, test } from "vitest";
import {
  BottleClassifierRunMetadataSchema,
  getBottleClassifierRunMetadata,
} from "./runMetadata";

describe("getBottleClassifierRunMetadata", () => {
  test("extracts aggregate usage and tool calls from an agent run", () => {
    expect(
      getBottleClassifierRunMetadata({
        durationMs: 123.6,
        result: {
          output: null,
          usage: {
            requests: 3,
            inputTokens: 100,
            cachedInputTokens: 60,
            cacheWriteTokens: 10,
            outputTokens: 20,
            reasoningTokens: 10,
            totalTokens: 120,
          },
          toolResults: [
            { name: "search_bottles", output: { results: [] } },
            { name: "get_bottle_context", output: { context: null } },
            { name: "web_search", output: { evidence: [] } },
          ],
        },
      }),
    ).toEqual({
      agentDurationMs: 124,
      usage: {
        requests: 3,
        inputTokens: 100,
        cachedInputTokens: 60,
        cacheWriteTokens: 10,
        outputTokens: 20,
        reasoningTokens: 10,
        totalTokens: 120,
      },
      toolCalls: {
        count: 3,
        names: ["search_bottles", "get_bottle_context", "web_search"],
      },
    });
  });

  test("returns explicit zeroes when a run has no provider measurements", () => {
    expect(
      getBottleClassifierRunMetadata({
        durationMs: -1,
        result: { output: null, toolResults: [], usage: { requests: 0 } },
      }),
    ).toEqual({
      agentDurationMs: 0,
      usage: {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      toolCalls: {
        count: 0,
        names: [],
      },
    });
  });

  test("captures the estimated agent token cost with its pricing basis", () => {
    expect(
      getBottleClassifierRunMetadata({
        durationMs: 50,
        model: "gpt-5.6-terra",
        result: {
          output: null,
          toolResults: [],
          usage: {
            requests: 1,
            inputTokens: 1_000,
            cachedInputTokens: 400,
            outputTokens: 100,
            totalTokens: 1_100,
          },
        },
      }),
    ).toMatchObject({
      usage: { totalTokens: 1_100 },
      cost: {
        scope: "agent_loop_only",
        costCoverage: "cache_write_unreported_assumed_standard_input",
        estimatedAgentLoopCostUsd: 0.00248,
        pricingModel: "gpt-5.6-terra",
        pricingEffectiveDate: "2026-09-22",
        pricingBasis: "standard_short_context",
      },
    });
  });

  test("rejects incomplete persisted run metadata", () => {
    expect(() =>
      BottleClassifierRunMetadataSchema.parse({
        agentDurationMs: 10,
        usage: {
          inputTokens: 4,
          outputTokens: 2,
          totalTokens: 6,
        },
        toolCalls: { count: 1, names: [] },
      }),
    ).toThrow();
  });
});
