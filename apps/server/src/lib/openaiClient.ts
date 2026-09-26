/**
 * Owns OpenAI client setup and model-call tracing. Trace delivery failures do
 * not change model-call behavior.
 */
import * as Sentry from "@sentry/node";
import OpenAI from "openai";

import config from "../config";

export type AIGatewayWorkload = "application" | "scraper";

function getAIGatewayApiKey(workload: AIGatewayWorkload) {
  return workload === "scraper"
    ? (config.SCRAPER_AI_GATEWAY_API_KEY ?? config.AI_GATEWAY_API_KEY)
    : config.AI_GATEWAY_API_KEY;
}

export function isAIGatewayConfigured(
  workload: AIGatewayWorkload = "application",
) {
  return Boolean(getAIGatewayApiKey(workload));
}

export function createOpenAIClient({
  instrumentWithSentry = true,
  recordFullContent = false,
  workload = "application",
}: {
  instrumentWithSentry?: boolean;
  recordFullContent?: boolean;
  workload?: AIGatewayWorkload;
} = {}): OpenAI {
  const apiKey = getAIGatewayApiKey(workload);
  const client = new OpenAI({
    apiKey,
    baseURL: config.AI_GATEWAY_HOST,
  });

  if (!instrumentWithSentry) {
    return client;
  }

  return Sentry.instrumentOpenAiClient(client, {
    enableTruncation: !recordFullContent,
    recordInputs: true,
    recordOutputs: true,
  });
}

/**
 * AI service rule: a spent budget (402), timeout (408), rate limit (429),
 * outage (5xx), or lost connection is temporary, so callers wait and retry.
 * Any other rejection is a bug. Wrapped causes are checked too, because the
 * classifier wraps provider errors.
 */
export function isModelServiceUnavailable(error: Error): boolean {
  let cause: unknown = error;
  for (let depth = 0; depth < 5 && cause instanceof Error; depth++) {
    if (cause instanceof OpenAI.APIConnectionError) return true;
    if (cause instanceof OpenAI.APIError) {
      const status = cause.status;
      return (
        status === undefined ||
        status === 402 ||
        status === 408 ||
        status === 429 ||
        status >= 500
      );
    }
    cause = cause.cause;
  }
  return false;
}

/** Agent clients always record complete model input and output in Sentry. */
export function createOpenAIAgentClient({
  workload = "application",
}: {
  workload?: AIGatewayWorkload;
} = {}): OpenAI {
  return createOpenAIClient({ recordFullContent: true, workload });
}

/** Run an AI conversation scope without clearing inherited Sentry attribution. */
export async function withSentryConversation<T>(
  conversationId: string,
  callback: () => Promise<T>,
): Promise<T> {
  return await Sentry.withIsolationScope(async (scope) => {
    scope.setConversationId(conversationId);
    return await callback();
  });
}
