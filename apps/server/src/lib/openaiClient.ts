/**
 * Owns OpenAI client setup and model-call tracing. Trace delivery failures do
 * not change model-call behavior.
 */
import * as Sentry from "@sentry/node";
import { APICallError, RetryError } from "ai";
import OpenAI from "openai";

import config from "../config";

export type AIGatewayWorkload = "application" | "scraper";

export function getAIGatewayApiKey(workload: AIGatewayWorkload) {
  return workload === "scraper"
    ? (config.SCRAPER_AI_GATEWAY_API_KEY ?? config.AI_GATEWAY_API_KEY)
    : config.AI_GATEWAY_API_KEY;
}

export function isAIGatewayConfigured(
  workload: AIGatewayWorkload = "application",
) {
  return Boolean(getAIGatewayApiKey(workload));
}

/**
 * Sentry traces every OpenAI client on its own and records complete model
 * input and output. To keep a call's content out of Sentry (sensitive-data
 * rule, docs/policies/sensitive-data.md), run it inside
 * `Sentry.suppressTracing` and record a content-free span around it.
 */
export function createOpenAIClient({
  workload = "application",
}: {
  workload?: AIGatewayWorkload;
} = {}): OpenAI {
  return new OpenAI({
    apiKey: getAIGatewayApiKey(workload),
    baseURL: config.AI_GATEWAY_HOST,
  });
}

function isTemporaryStatus(status: number): boolean {
  return status === 402 || status === 408 || status === 429 || status >= 500;
}

/**
 * AI service rule: a spent budget (402), timeout (408), rate limit (429),
 * outage (5xx), or lost connection is temporary, so callers wait and retry.
 * Any other rejection is a bug. Wrapped causes are checked too, because the
 * classifier wraps provider errors. AI SDK errors carry the status on an
 * `APICallError` in their cause chain, and spent retries keep the last error.
 */
export function isModelServiceUnavailable(error: Error): boolean {
  let cause: unknown = error;
  for (let depth = 0; depth < 5 && cause instanceof Error; depth++) {
    if (cause instanceof OpenAI.APIConnectionError) return true;
    if (cause instanceof OpenAI.APIError) {
      return cause.status === undefined || isTemporaryStatus(cause.status);
    }
    if (APICallError.isInstance(cause)) {
      // A call with no status never reached the service.
      return cause.statusCode === undefined
        ? cause.isRetryable
        : isTemporaryStatus(cause.statusCode);
    }
    cause = RetryError.isInstance(cause) ? cause.lastError : cause.cause;
  }
  return false;
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
