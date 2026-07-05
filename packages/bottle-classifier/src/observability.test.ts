import * as Sentry from "@sentry/core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  buildAgentSpanContext,
  buildToolSpanContext,
  startAgentSpan,
  startToolSpan,
} from "./observability";

vi.mock("@sentry/core", { spy: true });

describe("observability span contexts", () => {
  beforeEach(() => {
    vi.mocked(Sentry.startSpan).mockClear();
  });

  test("builds agent invocation span metadata with the shared conversation id", () => {
    expect(
      buildAgentSpanContext({
        name: "Bottle Classifier",
        conversationId: "photo_identification:pending-1",
        attributes: {
          "bottle_classifier.reference_id": "pending-1",
        },
      }),
    ).toMatchObject({
      op: "gen_ai.invoke_agent",
      name: "invoke_agent Bottle Classifier",
      attributes: {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": "Bottle Classifier",
        "gen_ai.conversation.id": "photo_identification:pending-1",
        "bottle_classifier.reference_id": "pending-1",
      },
    });
  });

  test("builds tool execution span metadata with compact JSON arguments", () => {
    const context = buildToolSpanContext({
      name: "search_bottles",
      description: "Search local bottles.",
      args: {
        query: "Ardbeg Uigeadail",
      },
    });

    expect(context).toMatchObject({
      op: "gen_ai.execute_tool",
      name: "execute_tool search_bottles",
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": "search_bottles",
        "gen_ai.tool.description": "Search local bottles.",
        "gen_ai.tool.call.arguments": JSON.stringify({
          query: "Ardbeg Uigeadail",
        }),
      },
    });
  });

  test("wraps agent runs in a Sentry agent invocation span", async () => {
    await expect(
      startAgentSpan({
        name: "Bottle Classifier",
        conversationId: "bottle_reference:123",
        attributes: {
          "bottle_classifier.reference_id": "123",
        },
        callback: async () => "done",
      }),
    ).resolves.toBe("done");

    expect(Sentry.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "gen_ai.invoke_agent",
        name: "invoke_agent Bottle Classifier",
        attributes: expect.objectContaining({
          "gen_ai.conversation.id": "bottle_reference:123",
          "bottle_classifier.reference_id": "123",
        }),
      }),
      expect.any(Function),
    );
  });

  test("records tool results on the Sentry tool span", async () => {
    const setAttribute = vi.fn();
    vi.mocked(Sentry.startSpan).mockImplementationOnce(
      async (_context, callback) =>
        await callback({
          setAttribute,
        } as unknown as Parameters<typeof callback>[0]),
    );

    await expect(
      startToolSpan({
        name: "search_bottles",
        description: "Search local bottles.",
        args: {
          query: "Ardbeg",
        },
        callback: async () => ({
          results: [{ bottleId: 1 }],
        }),
      }),
    ).resolves.toEqual({
      results: [{ bottleId: 1 }],
    });

    expect(setAttribute).toHaveBeenCalledWith(
      "gen_ai.tool.call.result",
      JSON.stringify({
        results: [{ bottleId: 1 }],
      }),
    );
  });
});
