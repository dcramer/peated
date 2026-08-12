import * as Sentry from "@sentry/node";
import OpenAI from "openai";

import config from "../config";

export function createOpenAIClient(): OpenAI {
  // Sentry owns provider telemetry globally; wrapping individual clients would
  // duplicate spans and capture handled provider failures as separate issues.
  return new OpenAI({
    apiKey: config.AI_GATEWAY_API_KEY,
    baseURL: config.AI_GATEWAY_HOST,
  });
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
