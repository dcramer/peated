import {
  GatewayInternalServerError,
  GatewayResponseError,
} from "@ai-sdk/gateway";
import config from "@peated/server/config";
import * as Sentry from "@sentry/node";
import { createGateway, generateText, RetryError } from "ai";
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

    const applicationClient = createOpenAIClient();
    const scraperClient = createOpenAIClient({ workload: "scraper" });

    expect(applicationClient.apiKey).toBe("application-key");
    expect(scraperClient.apiKey).toBe("scraper-key");
    expect(isAIGatewayConfigured()).toBe(true);
    expect(isAIGatewayConfigured("scraper")).toBe(true);
  });

  test("uses the application credential as the scraper default", () => {
    config.AI_GATEWAY_API_KEY = "application-key";
    config.SCRAPER_AI_GATEWAY_API_KEY = undefined;

    const scraperClient = createOpenAIClient({ workload: "scraper" });

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

  describe("AI SDK errors", () => {
    function gatewayError(statusCode: number) {
      return new GatewayResponseError({ message: "rejected", statusCode });
    }

    test.each([402, 408, 429, 500, 503])(
      "treats a %i response as temporary",
      (status) => {
        expect(isModelServiceUnavailable(gatewayError(status))).toBe(true);
      },
    );

    test.each([400, 401, 404, 422])(
      "treats a %i response as a bug",
      (status) => {
        expect(isModelServiceUnavailable(gatewayError(status))).toBe(false);
      },
    );

    // Jev's rejection of an image arrived this way in a live check.
    test("reads the status, not the gateway class name", () => {
      expect(
        isModelServiceUnavailable(
          new GatewayInternalServerError({
            message: "rejected",
            statusCode: 400,
          }),
        ),
      ).toBe(false);
    });

    // These go through the real SDK so a change in how it wraps failures
    // shows up here.
    async function failedCall(error: Error) {
      const gateway = createGateway({
        apiKey: "test-key",
        fetch: async () => {
          throw error;
        },
      });
      return await generateText({
        model: gateway("openai/gpt-6-luna"),
        prompt: "hi",
        maxRetries: 0,
      }).then(
        () => {
          throw new Error("Expected the call to fail");
        },
        (err: Error) => err,
      );
    }

    test("treats a client timeout as temporary", async () => {
      const error = await failedCall(
        Object.assign(new Error("Headers Timeout Error"), {
          code: "UND_ERR_HEADERS_TIMEOUT",
        }),
      );
      expect(isModelServiceUnavailable(error)).toBe(true);
    });

    // The gateway reports a failure that never got a response as a 500, with
    // the raw error as its only cause.
    test("treats a failure without a response as temporary", async () => {
      const error = await failedCall(new Error("socket hang up"));
      expect(isModelServiceUnavailable(error)).toBe(true);
    });

    test("checks the last error after retries run out", () => {
      const retried = (lastError: Error) =>
        new RetryError({
          message: "Failed after 3 attempts",
          reason: "maxRetriesExceeded",
          errors: [lastError, lastError, lastError],
        });

      expect(isModelServiceUnavailable(retried(gatewayError(503)))).toBe(true);
      expect(isModelServiceUnavailable(retried(gatewayError(401)))).toBe(false);
    });
  });

  test("ignores errors from other sources", () => {
    expect(isModelServiceUnavailable(new Error("Database down"))).toBe(false);
  });
});
