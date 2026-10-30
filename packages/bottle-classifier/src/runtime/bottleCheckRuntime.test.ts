import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { runAgent, strictAgentTool } from "./agentRun";
import {
  observeAgentTools,
  type BottleClassifierToolEvent,
} from "./bottleCheckRuntime";

const NO_USAGE = {
  inputTokens: {
    total: 0,
    noCache: 0,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

describe("observeAgentTools", () => {
  test("reports a result for a tool call that throws, and the run goes on", async () => {
    let turn = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        turn += 1;
        if (turn === 1) {
          return {
            content: [
              {
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "search_bottles",
                input: JSON.stringify({ query: "Example Single Malt" }),
              },
            ],
            finishReason: { unified: "tool-calls", raw: "tool_calls" },
            usage: NO_USAGE,
            warnings: [],
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify({ done: true }) }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: NO_USAGE,
          warnings: [],
        };
      },
    });
    const events: BottleClassifierToolEvent[] = [];
    const tools = observeAgentTools(
      [
        strictAgentTool({
          name: "search_bottles",
          description: "Search Bottles.",
          parameters: z.object({ query: z.string() }),
          execute: async () => {
            throw new Error("search is down");
          },
        }),
      ],
      (event) => events.push(event),
    );

    const result = await runAgent({
      model,
      functionId: "observe_tools_test",
      instructions: "Search, then answer.",
      input: "Example Single Malt",
      tools,
      output: {
        name: "test_output",
        schema: {
          type: "object",
          properties: { done: { type: "boolean" } },
          required: ["done"],
          additionalProperties: false,
        },
      },
      maxTurns: 3,
    });

    expect(result.output).toEqual({ done: true });
    expect(events).toEqual([
      expect.objectContaining({
        type: "tool_call",
        phase: "agent",
        id: "call-1",
        name: "search_bottles",
      }),
      {
        type: "tool_result",
        phase: "agent",
        toolCallId: "call-1",
        name: "search_bottles",
        result: { error: "search is down" },
      },
    ]);
  });
});
