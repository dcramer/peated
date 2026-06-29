import * as Sentry from "@sentry/node";
import OpenAI from "openai";

import config from "../config";

export function createOpenAIClient(): OpenAI {
  const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_HOST,
    organization: config.OPENAI_ORGANIZATION,
    project: config.OPENAI_PROJECT,
  });

  return Sentry.instrumentOpenAiClient(client, {
    recordInputs: true,
    recordOutputs: true,
  });
}

export async function withSentryConversation<T>(
  conversationId: string,
  callback: () => Promise<T>,
): Promise<T> {
  return await Sentry.withIsolationScope(async () => {
    Sentry.setConversationId(conversationId);
    return await callback();
  });
}
