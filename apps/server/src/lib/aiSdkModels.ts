/**
 * Owns AI SDK model setup. Calls go through Vercel AI Gateway with the same
 * keys as the OpenAI client. See docs/development/model-calls.md.
 */
import { createGateway } from "ai";

import config from "../config";
import { getAIGatewayApiKey, type AIGatewayWorkload } from "./openaiClient";

function createGatewayProvider(workload: AIGatewayWorkload) {
  const apiKey = getAIGatewayApiKey(workload);
  // Without a key the gateway falls back to a Vercel OIDC token, which our
  // servers do not have. Fail here so the cause is clear.
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required for AI SDK models");
  }
  return createGateway({ apiKey });
}

/** A text model for `generateText` and similar AI SDK calls. */
export function createLanguageModel({
  model = config.OPENAI_MODEL,
  workload = "application",
}: {
  model?: string;
  workload?: AIGatewayWorkload;
} = {}) {
  return createGatewayProvider(workload)(model);
}

/**
 * A decision model, such as Jev, answers typed questions (yes or no, pick
 * one, or score) with probabilities instead of writing text. Ask questions
 * with `experimental_decide` from `ai`.
 */
export function createDecisionModel({
  workload = "application",
}: {
  workload?: AIGatewayWorkload;
} = {}) {
  return createGatewayProvider(workload).decisionModel(config.DECISION_MODEL);
}
