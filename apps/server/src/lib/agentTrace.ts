/** Records agent traces. Failures mark the trace but do not create issues. */
import type { Span, SpanAttributes } from "@sentry/core";
import * as Sentry from "@sentry/node";
import { withSentryConversation } from "./openaiClient";

type Prompt = { name: string; version: string };

async function recordFailure<T>(span: Span, run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    span.setAttribute(
      "error.type",
      error instanceof Error ? error.name : "Error",
    );
    throw error;
  }
}

function inputMessage(content: string) {
  return JSON.stringify([
    {
      role: "user",
      parts: [{ type: "text", content }],
    },
  ]);
}

function outputMessage(content: string) {
  return JSON.stringify([
    {
      role: "assistant",
      parts: [{ type: "text", content }],
      finish_reason: "stop",
    },
  ]);
}

export function agentFields(input: {
  conversationId: string;
  details?: SpanAttributes;
  input: string;
  instructions: string;
  name: string;
  prompt: Prompt;
  tools?: string;
}): SpanAttributes {
  const fields: SpanAttributes = {
    ...input.details,
    "gen_ai.agent.name": input.name,
    "gen_ai.conversation.id": input.conversationId,
    "gen_ai.input.messages": inputMessage(input.input),
    "gen_ai.operation.name": "invoke_agent",
    "gen_ai.prompt.name": input.prompt.name,
    "gen_ai.prompt.version": input.prompt.version,
    "gen_ai.system_instructions": JSON.stringify([
      { type: "text", content: input.instructions },
    ]),
  };
  if (input.tools) fields["gen_ai.tool.definitions"] = input.tools;
  return fields;
}

export function toolFields(input: {
  agent: string;
  callId: string;
  description: string;
  details?: SpanAttributes;
  input: string;
  name: string;
}): SpanAttributes {
  return {
    ...input.details,
    "gen_ai.agent.name": input.agent,
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.tool.call.arguments": input.input,
    "gen_ai.tool.call.id": input.callId,
    "gen_ai.tool.description": input.description,
    "gen_ai.tool.name": input.name,
    "gen_ai.tool.type": "function",
  };
}

export function runAgent<T>(input: {
  conversationId: string;
  details?: SpanAttributes;
  input: string;
  instructions: string;
  name: string;
  prompt: Prompt;
  run: () => Promise<{ model: string; output: string; result: T }>;
  tools?: string;
}): Promise<T> {
  return withSentryConversation(input.conversationId, () =>
    Sentry.startSpan(
      {
        name: `invoke_agent ${input.name}`,
        op: "gen_ai.invoke_agent",
        attributes: agentFields(input),
      },
      async (span) => {
        const value = await recordFailure(span, input.run);
        span.setAttributes({
          "gen_ai.output.messages": outputMessage(value.output),
          "gen_ai.response.model": value.model,
        });
        return value.result;
      },
    ),
  );
}

export function runTool<T>(input: {
  agent: string;
  callId: string;
  description: string;
  details?: SpanAttributes;
  input: string;
  name: string;
  run: () => Promise<{ output: string; result: T }>;
}): Promise<T> {
  return Sentry.startSpan(
    {
      name: `execute_tool ${input.name}`,
      op: "gen_ai.execute_tool",
      attributes: toolFields(input),
    },
    async (span) => {
      const value = await recordFailure(span, input.run);
      span.setAttribute("gen_ai.tool.call.result", value.output);
      return value.result;
    },
  );
}
