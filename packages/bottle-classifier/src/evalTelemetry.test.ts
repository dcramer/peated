import { describe, expect, test } from "vitest";
import { createHarness } from "vitest-evals";
import { spansByKind } from "vitest-evals/harness";
import {
  buildEvalModelCallTrace,
  getEvalModelCall,
  recordEvalOpenAIResponse,
  summarizeEvalModelCalls,
  withEvalModelCallCapture,
} from "./evalTelemetry";

const startedAt = new Date("2026-08-02T12:00:00.000Z");
const finishedAt = new Date("2026-08-02T12:00:01.250Z");

function modelCall() {
  return getEvalModelCall({
    request: { model: "openai/gpt-5.6-terra" },
    response: {
      id: "resp_123",
      model: "gpt-5.6-terra-2026-08-01",
      usage: {
        input_tokens: 100,
        input_tokens_details: {
          cached_tokens: 40,
          cache_write_tokens: 5,
        },
        output_tokens: 20,
        output_tokens_details: { reasoning_tokens: 7 },
        total_tokens: 120,
      },
    },
    startedAt,
    finishedAt,
  });
}

describe("eval GenAI telemetry", () => {
  test("normalizes OpenAI response models and token details", () => {
    expect(modelCall()).toEqual({
      operationName: "chat",
      providerName: "openai",
      requestModel: "openai/gpt-5.6-terra",
      responseModel: "gpt-5.6-terra-2026-08-01",
      responseId: "resp_123",
      inputTokens: 100,
      cachedInputTokens: 40,
      cacheWriteTokens: 5,
      outputTokens: 20,
      reasoningTokens: 7,
      totalTokens: 120,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: 1_250,
    });
  });

  test("captures calls within one async eval boundary", async () => {
    const capture = await withEvalModelCallCapture(async () => {
      recordEvalOpenAIResponse({
        request: { model: "gpt-5.6-terra" },
        response: {
          model: "gpt-5.6-terra",
          usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
        },
        startedAt,
        finishedAt,
      });
      return "done";
    });

    expect(capture.result).toBe("done");
    expect(capture.modelCalls).toHaveLength(1);
  });

  test("builds Vitest Evals model spans with OTel operation names", () => {
    const call = modelCall();
    expect(call).not.toBeNull();
    const usage = summarizeEvalModelCalls([call!]);
    const traces = buildEvalModelCallTrace({
      name: "Bottle Classifier",
      operationName: "invoke_agent",
      modelCalls: [call!],
    });

    expect(usage).toMatchObject({
      provider: "openai",
      model: "gpt-5.6-terra-2026-08-01",
      inputTokens: 100,
      outputTokens: 20,
      reasoningTokens: 7,
      totalTokens: 120,
      metadata: {
        scope: "full_llm_run",
        requests: 1,
        cachedInputTokens: 40,
        cacheWriteTokens: 5,
      },
    });
    expect(traces?.[0]?.spans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "invoke_agent Bottle Classifier",
          kind: "agent",
          attributes: expect.objectContaining({
            "gen_ai.operation.name": "invoke_agent",
            "gen_ai.provider.name": "openai",
          }),
        }),
        expect.objectContaining({
          name: "chat openai/gpt-5.6-terra",
          kind: "model",
          attributes: expect.objectContaining({
            "gen_ai.operation.name": "chat",
            "gen_ai.request.model": "openai/gpt-5.6-terra",
            "gen_ai.response.model": "gpt-5.6-terra-2026-08-01",
            "gen_ai.usage.input_tokens": 100,
            "gen_ai.usage.output_tokens": 20,
          }),
        }),
      ]),
    );
  });

  test("survives Vitest Evals 0.15 harness normalization", async () => {
    const call = modelCall();
    expect(call).not.toBeNull();
    const harness = createHarness<string, string>({
      name: "otel-conformance",
      run: async ({ input }) => ({
        output: "done",
        events: [
          { type: "message", role: "user", content: input },
          { type: "message", role: "assistant", content: "done" },
        ],
        usage: summarizeEvalModelCalls([call!]),
        traces: buildEvalModelCallTrace({
          name: "Bottle Classifier",
          operationName: "invoke_agent",
          modelCalls: [call!],
        }),
      }),
    });
    const run = await harness.run("classify this bottle", {
      artifacts: {},
      setArtifact: () => undefined,
    });

    expect(spansByKind(run, "model")).toEqual([
      expect.objectContaining({
        name: "chat openai/gpt-5.6-terra",
        attributes: expect.objectContaining({
          "gen_ai.operation.name": "chat",
          "gen_ai.provider.name": "openai",
          "gen_ai.request.model": "openai/gpt-5.6-terra",
          "gen_ai.response.model": "gpt-5.6-terra-2026-08-01",
          "gen_ai.usage.input_tokens": 100,
          "gen_ai.usage.output_tokens": 20,
        }),
      }),
    ]);
  });
});
