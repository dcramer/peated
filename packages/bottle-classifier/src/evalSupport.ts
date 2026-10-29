import { createMemoryCache, createPeatedBot } from "@peated/bot";
import OpenAI from "openai";
import type {
  BottleClassifierDataSource,
  CreateBottleClassifierOptions,
} from "./classifierRuntime";
import {
  getActiveEvalModelCallStore,
  recordEvalOpenAIResponse,
} from "./evalTelemetry";
import { resolveOpenAICompatibleConfig } from "./openaiCompatibleConfig";
import { resolveOpenAIReasoningEffort } from "./openaiModelSettings";

const evalGatewayConfig = resolveOpenAICompatibleConfig(process.env);

export const evalClassifierModel = evalGatewayConfig.bottleClassifierModel;
export const evalClassifierReasoningEffort = resolveOpenAIReasoningEffort(
  evalClassifierModel,
  evalGatewayConfig.bottleClassifierReasoningEffort,
);
export const evalImageExtractionModel = evalGatewayConfig.imageExtractionModel;
export const evalImageExtractionReasoningEffort = resolveOpenAIReasoningEffort(
  evalImageExtractionModel,
  evalGatewayConfig.imageExtractionReasoningEffort,
);
export const hasEvalAIGatewayCredentials = Boolean(evalGatewayConfig.apiKey);

export function createEvalOpenAIClient() {
  const client = new OpenAI({
    apiKey: evalGatewayConfig.apiKey,
    baseURL: evalGatewayConfig.baseURL,
  });
  const originalCreate = client.responses.create.bind(client.responses);

  const instrumentedCreate = (...args: Parameters<typeof originalCreate>) => {
    const request = args[0];
    const store = getActiveEvalModelCallStore();
    const startedAt = new Date();
    const requestPromise = originalCreate(...args);

    if (store && request?.stream !== true) {
      void requestPromise.then(
        (response) => {
          recordEvalOpenAIResponse({
            request,
            response,
            startedAt,
            store,
          });
        },
        () => undefined,
      );
    }

    return requestPromise;
  };

  Object.defineProperty(client.responses, "create", {
    configurable: true,
    // SAFETY: The wrapper accepts and forwards the exact original parameters and return value.
    value: instrumentedCreate as typeof client.responses.create,
  });

  return client;
}

/**
 * PeatedBot for live model checks: Firecrawl when a key is set, an in-memory
 * cache, and no stored website settings.
 */
export function createEvalWeb() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  return createPeatedBot({
    cache: createMemoryCache(),
    getSite: async () => ({ robotsException: false, blocked: false }),
    onBotWall: async () => {},
    firecrawl: { apiKey, apiUrl: process.env.FIRECRAWL_API_URL ?? null },
    privateJwk: null,
  });
}

export function createEvalClassifierOptions(
  dataSource: BottleClassifierDataSource,
): CreateBottleClassifierOptions {
  return {
    client: createEvalOpenAIClient(),
    model: evalClassifierModel,
    reasoningEffort: evalClassifierReasoningEffort,
    imageExtractionModel: evalImageExtractionModel,
    imageExtractionReasoningEffort: evalImageExtractionReasoningEffort,
    maxSearchQueries: Number(
      process.env.BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES ?? 2,
    ),
    web: createEvalWeb(),
    dataSource,
  };
}
