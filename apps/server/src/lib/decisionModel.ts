/**
 * Owns decision model setup. A decision model, such as Jev, answers typed
 * questions (yes or no, pick one, or score) with probabilities instead of
 * writing text. Ask questions with `experimental_decide` from `ai`, passing
 * this model. Calls go through Vercel AI Gateway with the same keys as other
 * model calls.
 */
import { createGateway } from "ai";

import config from "../config";
import { getAIGatewayApiKey, type AIGatewayWorkload } from "./openaiClient";

export function createDecisionModel({
  workload = "application",
}: {
  workload?: AIGatewayWorkload;
} = {}) {
  const apiKey = getAIGatewayApiKey(workload);
  // Without a key the gateway falls back to a Vercel OIDC token, which our
  // servers do not have. Fail here so the cause is clear.
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required for decision models");
  }

  return createGateway({ apiKey }).decisionModel(config.DECISION_MODEL);
}
