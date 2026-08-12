import * as Sentry from "@sentry/node";
import OpenAI from "openai";

import config from "../config";

export function createOpenAIClient({
  instrumentWithSentry = true,
}: {
  instrumentWithSentry?: boolean;
} = {}): OpenAI {
  const client = new OpenAI({
    apiKey: config.AI_GATEWAY_API_KEY,
    baseURL: config.AI_GATEWAY_HOST,
  });

  if (!instrumentWithSentry) {
    return client;
  }

  return Sentry.instrumentOpenAiClient(client, {
    recordInputs: true,
    recordOutputs: true,
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
