import { describe, expect, test } from "vitest";
import {
  buildAgentSpanAttributes,
  buildAgentToolSpanAttributes,
} from "./agentTelemetry";

describe("agent telemetry", () => {
  test("builds the standard agent span contract", () => {
    expect(
      buildAgentSpanAttributes({
        attributes: { "scraper.run.id": 380 },
        conversationId: "scrape_source:1",
        instructions: "Build page rules.",
        name: "Scrape source setup",
        prompt: { name: "scrape-source-setup", version: "v6" },
        task: '{"kind":"review"}',
        toolDefinitions: '[{"name":"check_rules"}]',
      }),
    ).toEqual({
      "gen_ai.agent.name": "Scrape source setup",
      "gen_ai.conversation.id": "scrape_source:1",
      "gen_ai.input.messages": JSON.stringify([
        {
          role: "user",
          parts: [{ type: "text", content: '{"kind":"review"}' }],
        },
      ]),
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.prompt.name": "scrape-source-setup",
      "gen_ai.prompt.version": "v6",
      "gen_ai.system_instructions": JSON.stringify([
        { type: "text", content: "Build page rules." },
      ]),
      "gen_ai.tool.definitions": '[{"name":"check_rules"}]',
      "scraper.run.id": 380,
      "sentry.op": "gen_ai.invoke_agent",
    });
  });

  test("builds the standard tool span contract", () => {
    expect(
      buildAgentToolSpanAttributes({
        agentName: "Scrape source setup",
        argumentsJson: '{"listPageUrl":"https://example.com"}',
        callId: "call_123",
        description: "Check the page rules.",
        name: "check_rules",
      }),
    ).toEqual({
      "gen_ai.agent.name": "Scrape source setup",
      "gen_ai.operation.name": "execute_tool",
      "gen_ai.tool.call.arguments": '{"listPageUrl":"https://example.com"}',
      "gen_ai.tool.call.id": "call_123",
      "gen_ai.tool.description": "Check the page rules.",
      "gen_ai.tool.name": "check_rules",
      "gen_ai.tool.type": "function",
      "sentry.op": "gen_ai.execute_tool",
    });
  });
});
