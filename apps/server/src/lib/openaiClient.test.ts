import config from "@peated/server/config";
import * as Sentry from "@sentry/node";
import { afterEach, describe, expect, test } from "vitest";
import {
  createOpenAIClient,
  isAIGatewayConfigured,
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
