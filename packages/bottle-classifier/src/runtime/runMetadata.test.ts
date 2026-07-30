import { describe, expect, test } from "vitest";
import { getBottleClassifierRunMetadata } from "./runMetadata";

describe("getBottleClassifierRunMetadata", () => {
  test("extracts aggregate usage and tool calls from a native agent result", () => {
    expect(
      getBottleClassifierRunMetadata({
        durationMs: 123.6,
        result: {
          state: {
            usage: {
              requests: 3,
              inputTokens: 100,
              outputTokens: 20,
              totalTokens: 120,
            },
          },
          newItems: [
            {
              type: "tool_call_output_item",
              rawItem: { name: "search_bottles" },
            },
            {
              type: "tool_call_output_item",
              name: "get_bottle_context",
            },
            {
              type: "tool_call_output_item",
            },
            { type: "message_output_item" },
          ],
        },
      }),
    ).toEqual({
      agentDurationMs: 124,
      usage: {
        requests: 3,
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
      },
      toolCalls: {
        count: 3,
        names: ["search_bottles", "get_bottle_context"],
      },
    });
  });

  test("returns explicit zeroes when a run has no provider measurements", () => {
    expect(
      getBottleClassifierRunMetadata({
        durationMs: -1,
        result: {},
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
});
