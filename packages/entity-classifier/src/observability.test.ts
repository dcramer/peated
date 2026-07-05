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
        name: "Entity Classifier",
        conversationId: "entity:42",
        attributes: {
          "entity_classifier.entity_id": "42",
        },
      }),
    ).toMatchObject({
      op: "gen_ai.invoke_agent",
      name: "invoke_agent Entity Classifier",
      attributes: {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": "Entity Classifier",
        "gen_ai.conversation.id": "entity:42",
        "entity_classifier.entity_id": "42",
      },
    });
  });

  test("builds tool execution span metadata with compact JSON arguments", () => {
    const context = buildToolSpanContext({
      name: "search_entities",
      description: "Search local entities.",
      args: {
        query: "Ardbeg",
      },
    });

    expect(context).toMatchObject({
      op: "gen_ai.execute_tool",
      name: "execute_tool search_entities",
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": "search_entities",
        "gen_ai.tool.description": "Search local entities.",
        "gen_ai.tool.call.arguments": JSON.stringify({
          query: "Ardbeg",
        }),
      },
    });
  });

  test("wraps agent runs in a Sentry agent invocation span", async () => {
    await expect(
      startAgentSpan({
        name: "Entity Classifier",
        conversationId: "entity:42",
        attributes: {
          "entity_classifier.entity_id": "42",
        },
        callback: async () => "done",
      }),
    ).resolves.toBe("done");

    expect(Sentry.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "gen_ai.invoke_agent",
        name: "invoke_agent Entity Classifier",
        attributes: expect.objectContaining({
          "gen_ai.conversation.id": "entity:42",
          "entity_classifier.entity_id": "42",
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
        name: "search_entities",
        description: "Search local entities.",
        args: {
          query: "Ardbeg",
        },
        callback: async () => ({
          results: [{ entityId: 1 }],
        }),
      }),
    ).resolves.toEqual({
      results: [{ entityId: 1 }],
    });

    expect(setAttribute).toHaveBeenCalledWith(
      "gen_ai.tool.call.result",
      JSON.stringify({
        results: [{ entityId: 1 }],
      }),
    );
  });
});
