import type { JSONValue } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { vi } from "vitest";
import type { AgentRunResult, AgentToolResult } from "./runtime/agentRun";

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

/** A test model whose `generate` mock returns `output` as JSON text. */
export function createTestLanguageModel(output: JSONValue = null) {
  const generate = vi.fn(
    async (): Promise<GenerateResult> => ({
      content: [{ type: "text", text: JSON.stringify(output) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: {
          total: 1_000,
          noCache: 900,
          cacheRead: 100,
          cacheWrite: undefined,
        },
        outputTokens: { total: 200, text: 50, reasoning: 150 },
      },
      response: { id: "resp_123", modelId: "test-model" },
      warnings: [],
    }),
  );
  // Like the gateway model, accept image URLs instead of downloading them.
  const model = new MockLanguageModelV4({
    doGenerate: generate,
    supportedUrls: { "*/*": [/.*/] },
  });
  return { model, languageModel: () => model, generate };
}

/** A finished agent run whose final answer is `output`. */
export function agentRunResult(
  output: JSONValue,
  toolResults: AgentToolResult[] = [],
): AgentRunResult {
  return { output, toolResults, usage: { requests: 1 } };
}
