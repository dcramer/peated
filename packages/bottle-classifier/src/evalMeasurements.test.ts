import { describe, expect, test } from "vitest";
import {
  buildEvalHarnessMeasurements,
  buildImageExtractionEvalMeasurements,
  formatEvalUsageAnnotation,
} from "./evalMeasurements";
import { resolveOpenAICompatibleConfig } from "./openaiCompatibleConfig";
import {
  getStableOpenAISettings,
  resolveOpenAIReasoningEffort,
} from "./openaiModelSettings";
import { getBottleClassifierRunMetadata } from "./runtime/runMetadata";

describe("eval harness measurements", () => {
  test("reports image extraction usage and its scoped cost", () => {
    const measurements = buildImageExtractionEvalMeasurements({
      model: "gpt-5.6-luna",
      reasoningEffort: "high",
      metadata: {
        durationMs: 125,
        response: {
          id: "resp_123",
          model: "gpt-5.6-luna-2026-07-15",
          serviceTier: "default",
        },
        usage: {
          inputTokens: 1_000,
          cachedInputTokens: 100,
          outputTokens: 200,
          reasoningTokens: 150,
          totalTokens: 1_200,
        },
      },
    });

    expect(measurements).toMatchObject({
      usage: {
        model: "gpt-5.6-luna",
        inputTokens: 1_000,
        outputTokens: 200,
        totalTokens: 1_200,
        metadata: {
          scope: "image_extraction_only",
          costCoverage: "cache_write_unreported_assumed_standard_input",
          estimatedCostUsd: 0.000422,
          cachedInputTokens: 100,
          reasoningTokens: 150,
          reasoningEffort: "high",
        },
      },
      timings: {
        totalMs: 125,
        metadata: { imageExtractionDurationMs: 125 },
      },
    });
    expect(formatEvalUsageAnnotation(measurements.usage)).toBe(
      "input 1,000 tok | output 200 tok | effort high | est. $0.000422 · image extraction only",
    );
  });

  test("prices cached agent usage through the harness boundary", () => {
    const modelMetadata = getBottleClassifierRunMetadata({
      durationMs: 125,
      result: {
        state: {
          usage: {
            requests: 2,
            inputTokens: 1_000_000,
            inputTokensDetails: [
              { cached_tokens: 250_000, cache_write_tokens: 100_000 },
            ],
            outputTokens: 100_000,
            totalTokens: 1_100_000,
          },
        },
      },
    });

    expect(
      buildEvalHarnessMeasurements({
        model: "gpt-5.6-terra",
        modelMetadata,
        totalMs: 150,
      }),
    ).toMatchObject({
      usage: {
        model: "gpt-5.6-terra",
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        totalTokens: 1_100_000,
        metadata: {
          scope: "agent_loop_only",
          costCoverage: "priced_model_tokens",
          estimatedAgentLoopCostUsd: 2.8,
          cachedInputTokens: 250_000,
          cacheWriteTokens: 100_000,
          pricingModel: "gpt-5.6-terra",
          pricingBasis: "standard_short_context",
        },
      },
    });
  });

  test("prices gateway model ids and labels missing cache details", () => {
    const measurements = buildEvalHarnessMeasurements({
      model: "openai/gpt-5.6-luna",
      modelMetadata: {
        agentDurationMs: 10,
        usage: {
          requests: 1,
          inputTokens: 1_000_000,
          outputTokens: 100_000,
          totalTokens: 1_100_000,
        },
        toolCalls: { count: 0, names: [] },
      },
      totalMs: 12,
    });

    expect(measurements.usage?.metadata).toMatchObject({
      costCoverage: "cache_details_unreported_assumed_standard_input",
      estimatedAgentLoopCostUsd: 0.32,
      pricingModel: "gpt-5.6-luna",
    });
    expect(formatEvalUsageAnnotation(measurements.usage)).toBe(
      "input 1,000,000 tok | output 100,000 tok | effort provider default | est. $0.320000 · agent loop only",
    );
  });

  test.each([
    ["gpt-5.4", 17.5, "gpt-5.4"],
    ["gpt-5.6", 35, "gpt-5.6-sol"],
  ])(
    "uses standard pricing for %s",
    (model, expectedCost, expectedPricingModel) => {
      expect(
        buildEvalHarnessMeasurements({
          model,
          modelMetadata: {
            agentDurationMs: 10,
            usage: {
              requests: 1,
              inputTokens: 1_000_000,
              cachedInputTokens: 0,
              cacheWriteTokens: 0,
              outputTokens: 1_000_000,
              totalTokens: 2_000_000,
            },
            toolCalls: { count: 0, names: [] },
          },
          totalMs: 12,
        }).usage?.metadata,
      ).toMatchObject({
        estimatedAgentLoopCostUsd: expectedCost,
        pricingModel: expectedPricingModel,
      });
    },
  );

  test("does not invent a zero-dollar cost for an unsupported model", () => {
    const measurements = buildEvalHarnessMeasurements({
      model: "custom-model",
      modelMetadata: {
        agentDurationMs: 10,
        usage: {
          requests: 1,
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
        },
        toolCalls: { count: 0, names: [] },
      },
      totalMs: 12,
    });

    expect(measurements.usage?.metadata).toMatchObject({
      scope: "agent_loop_only",
      costCoverage: "unsupported_model",
    });
    expect(measurements.usage?.metadata).not.toHaveProperty(
      "estimatedAgentLoopCostUsd",
    );
    expect(formatEvalUsageAnnotation(measurements.usage)).toBe(
      "input 100 tok | output 20 tok | effort provider default | cost unavailable (unsupported model) · agent loop only",
    );
  });

  test("does not report zero cost when provider usage is unavailable", () => {
    const measurements = buildEvalHarnessMeasurements({
      model: "gpt-5.4",
      modelMetadata: getBottleClassifierRunMetadata({
        durationMs: 10,
        result: {},
      }),
      totalMs: 12,
    });

    expect(measurements.usage?.metadata).toMatchObject({
      costCoverage: "usage_unavailable",
    });
    expect(measurements.usage?.metadata).not.toHaveProperty(
      "estimatedAgentLoopCostUsd",
    );
    expect(formatEvalUsageAnnotation(measurements.usage)).toBe(
      "usage unavailable | effort provider default · agent loop only",
    );
  });

  test("formats the scoped estimate for the eval report annotation", () => {
    const measurements = buildEvalHarnessMeasurements({
      model: "gpt-5.4",
      modelMetadata: {
        agentDurationMs: 10,
        usage: {
          requests: 1,
          inputTokens: 1_000,
          cachedInputTokens: 0,
          outputTokens: 100,
          totalTokens: 1_100,
        },
        toolCalls: { count: 0, names: [] },
      },
      totalMs: 12,
    });

    expect(formatEvalUsageAnnotation(measurements.usage)).toBe(
      "input 1,000 tok | output 100 tok | effort provider default | est. $0.004000 · agent loop only",
    );
  });

  test("carries configured effort through runtime settings and eval metadata", () => {
    const config = resolveOpenAICompatibleConfig({
      OPENAI_MODEL: "gpt-5.6-luna",
      OPENAI_REASONING_EFFORT: "high",
    });
    const reasoningEffort = resolveOpenAIReasoningEffort(
      config.model,
      config.reasoningEffort,
    );
    const measurements = buildEvalHarnessMeasurements({
      model: config.model,
      reasoningEffort,
      modelMetadata: {
        agentDurationMs: 10,
        usage: {
          requests: 1,
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
        },
        toolCalls: { count: 0, names: [] },
      },
      totalMs: 12,
    });

    expect(getStableOpenAISettings(config.model, reasoningEffort)).toEqual({
      reasoning: { effort: "high" },
    });
    expect(measurements.usage?.metadata).toMatchObject({
      reasoningEffort: "high",
    });
    expect(formatEvalUsageAnnotation(measurements.usage)).toContain(
      "effort high",
    );
  });
});
