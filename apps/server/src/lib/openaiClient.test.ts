import config from "@peated/server/config";
import * as Sentry from "@sentry/node";
import OpenAI from "openai";
import { afterEach, describe, expect, test } from "vitest";
import {
  createOpenAIClient,
  isAIGatewayConfigured,
  isModelServiceUnavailable,
  withSentryConversation,
} from "./openaiClient";

const originalApplicationApiKey = config.AI_GATEWAY_API_KEY;
const originalScraperApiKey = config.SCRAPER_AI_GATEWAY_API_KEY;

afterEach(() => {
  config.AI_GATEWAY_API_KEY = originalApplicationApiKey;
  config.SCRAPER_AI_GATEWAY_API_KEY = originalScraperApiKey;
});

describe("createOpenAIClient", () => {
  test("selects independent application and scraper credentials", () => {
    config.AI_GATEWAY_API_KEY = "application-key";
    config.SCRAPER_AI_GATEWAY_API_KEY = "scraper-key";

    const applicationClient = createOpenAIClient({
      instrumentWithSentry: false,
    });
    const scraperClient = createOpenAIClient({
      instrumentWithSentry: false,
      workload: "scraper",
    });

    expect(applicationClient.apiKey).toBe("application-key");
    expect(scraperClient.apiKey).toBe("scraper-key");
    expect(isAIGatewayConfigured()).toBe(true);
    expect(isAIGatewayConfigured("scraper")).toBe(true);
  });

  test("uses the application credential as the scraper default", () => {
    config.AI_GATEWAY_API_KEY = "application-key";
    config.SCRAPER_AI_GATEWAY_API_KEY = undefined;

    const scraperClient = createOpenAIClient({
      instrumentWithSentry: false,
      workload: "scraper",
    });

    expect(isAIGatewayConfigured("scraper")).toBe(true);
    expect(scraperClient.apiKey).toBe("application-key");
  });
});

describe("withSentryConversation", () => {
  test("preserves Sentry user attribution in the conversation scope", async () => {
    await Sentry.withIsolationScope(async (scope) => {
      scope.setUser({
        id: "123",
        username: "dcramer",
      });

      await withSentryConversation("bottle_details:11868", async () => {
        expect(Sentry.getIsolationScope().getUser()).toEqual({
          id: "123",
          username: "dcramer",
        });
        expect(Sentry.getIsolationScope().getScopeData().conversationId).toBe(
          "bottle_details:11868",
        );
      });
    });
  });
});

describe("isModelServiceUnavailable", () => {
  function apiError(status: number) {
    return new OpenAI.APIError(status, undefined, "rejected", new Headers());
  }

  test.each([402, 408, 429, 500, 503])(
    "treats a %i response as temporary",
    (status) => {
      expect(isModelServiceUnavailable(apiError(status))).toBe(true);
    },
  );

  test.each([400, 401, 404, 422])("treats a %i response as a bug", (status) => {
    expect(isModelServiceUnavailable(apiError(status))).toBe(false);
  });

  test("treats a lost connection as temporary", () => {
    expect(isModelServiceUnavailable(new OpenAI.APIConnectionError({}))).toBe(
      true,
    );
  });

  test("finds a temporary failure wrapped by another error", () => {
    const wrapped = new Error("Classification failed", {
      cause: apiError(402),
    });
    expect(isModelServiceUnavailable(wrapped)).toBe(true);
  });

  test("ignores errors from other sources", () => {
    expect(isModelServiceUnavailable(new Error("Database down"))).toBe(false);
  });
});
