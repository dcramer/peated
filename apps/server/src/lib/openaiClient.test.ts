import * as Sentry from "@sentry/node";
import { describe, expect, test } from "vitest";
import { withSentryConversation } from "./openaiClient";

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
